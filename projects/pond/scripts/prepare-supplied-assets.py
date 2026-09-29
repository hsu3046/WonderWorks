# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
# Run in Blender after appending source objects into AI_Stillwater_Asset_{species}.
# Source blend files stay unchanged. Only copied meshes/materials/images are exported.
import bpy
from mathutils import Matrix, Vector

key = bpy.context.scene.get('prepare_species')
assert key in ('frog', 'ryukin', 'shubunkin')
source = bpy.data.scenes['AI_Stillwater_Asset_' + key]
bpy.context.window.scene = source
source.frame_set(1)
for o in source.objects:
    for modifier in o.modifiers:
        if modifier.type == 'CLOTH':
            modifier.show_viewport = False
    if o.type == 'ARMATURE':
        o.data.pose_position = 'REST'
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
objects = [o for o in source.objects if o.type == 'MESH' and
           (key == 'frog' or ((o.name.startswith(('body', 'fin', 'eye'))) and 'CS' not in o.name and not o.name.startswith('eyes_')))]
# Evaluate the actual source surface, including fin thickness and subdivision.
copies = []
for obj in objects:
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph), depsgraph=depsgraph)
    mesh.transform(obj.matrix_world)
    copies.append((obj, mesh))
points = [v.co.copy() for _, mesh in copies for v in mesh.vertices]
lo = Vector([min(v[i] for v in points) for i in range(3)])
hi = Vector([max(v[i] for v in points) for i in range(3)])
center = (lo + hi) * .5
# glTF converts Blender Z-up to Y-up. Fish: -Y nose -> +X; frog: +X nose -> -Y.
if key == 'frog':
    scale = 1.1 / max(hi.x-lo.x, hi.y-lo.y)
    center.z = lo.z
    rotation = Matrix(((0,1,0,0),(-1,0,0,0),(0,0,1,0),(0,0,0,1)))
else:
    scale = 2.2 / (hi.y-lo.y)
    rotation = Matrix(((0,-1,0,0),(1,0,0,0),(0,0,1,0),(0,0,0,1)))
transform = Matrix.Scale(scale,4) @ rotation @ Matrix.Translation(-center)
name = 'AI_Stillwater_Web_' + key
assert name not in bpy.data.scenes
out = bpy.data.scenes.new(name)
material_copies, image_copies = {}, {}
for obj, mesh in copies:
    mesh.transform(transform)
    for poly in mesh.polygons: poly.use_smooth = True
    label = obj.name.split('.')[0]
    if key != 'frog':
        label = label.replace('finTail','fin_caudal').replace('finBack','fin_dorsal').replace('finFront','fin_pectoral').replace('finMiddle','fin_pelvic')
    clone = bpy.data.objects.new('SW_' + key + '_' + label,mesh)
    out.collection.objects.link(clone)
    for index, old in enumerate(list(mesh.materials)):
        if not old: continue
        if old not in material_copies:
            material = old.copy(); material.name = 'SW_' + key + '_' + old.name
            material_copies[old] = material
            for node in material.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    image = node.image
                    if image not in image_copies:
                        image_copy = image.copy(); image_copy.name = 'SW_' + key + '_' + image.name
                        limit = 2048 if key == 'frog' else 1024
                        if max(image_copy.size) > limit: image_copy.scale(limit,limit)
                        image_copies[image] = image_copy
                    node.image = image_copies[image]
                if node.type == 'BSDF_PRINCIPLED':
                    for socket_name in ('Transmission Weight','Specular Tint'):
                        socket=node.inputs.get(socket_name)
                        if socket:
                            for link in list(socket.links): material.node_tree.links.remove(link)
                    node.inputs['Transmission Weight'].default_value=0
                    node.inputs['Roughness'].default_value=.46 if key=='frog' else .38
        mesh.materials[index] = material_copies[old]
bpy.context.window.scene=out
bpy.context.view_layer.update()
for a in bpy.context.screen.areas:
    if a.type=='VIEW_3D':
        a.spaces.active.region_3d.view_location=Vector((0,0,.18 if key=='frog' else 0))
        a.spaces.active.region_3d.view_distance=2.1 if key=='frog' else 4
        a.spaces.active.shading.type='MATERIAL'
print('PREPARED',key,[(o.name,len(o.data.vertices)) for o in out.objects])
