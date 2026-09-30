# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
"""Restore authored cornea geometry from the isolated AI_Pond_EyeRepair_20260930 scene.
The live scene must already contain source AmberIris/ClearCornea objects. Source blend stays unchanged.
"""
import bpy, json, struct
from pathlib import Path
from mathutils import Matrix, Vector
scene = bpy.data.scenes['AI_Pond_EyeRepair_20260930']
previous = bpy.context.window.scene
folder = Path('/Users/yuhitomi/Documents/Antigravity/Wonderworks/projects/pond/public/models')
output = folder / 'aib-goldfish-v5-cornea.glb'
assert not output.exists(), 'Do not overwrite an earlier cornea export'
try:
    bpy.context.window.scene = scene
    scene.view_layers[0].update()
    raw = (folder / 'aib-goldfish-v5.glb').read_bytes()
    gltf = json.loads(raw[20:20+struct.unpack_from('<I', raw, 12)[0]])
    node = next(n for n in gltf['nodes'] if 'L_AmberIris' in n['name'])
    acc = gltf['accessors'][gltf['meshes'][node['mesh']]['primitives'][0]['attributes']['POSITION']]
    iris = next(o for o in scene.objects if 'L_AmberIris' in o.name)
    points = [iris.matrix_world @ v.co for v in iris.data.vertices]
    lo = [min(v[i] for v in points) for i in range(3)]
    hi = [max(v[i] for v in points) for i in range(3)]
    scale = (acc['max'][1]-acc['min'][1])/(hi[2]-lo[2])
    center_x = (lo[0]+hi[0])/2-(acc['min'][0]+acc['max'][0])/2/scale
    transform = Matrix.Scale(scale, 4) @ Matrix.Translation(Vector((-center_x, 0, 0)))
    material = bpy.data.materials.new('AIB_Web_ClearCornea')
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (.12, .12, .12, 1)
    bsdf.inputs['Roughness'].default_value = .07
    bsdf.inputs['Alpha'].default_value = .16
    bsdf.inputs['Coat Weight'].default_value = 1
    bsdf.inputs['Coat Roughness'].default_value = .04
    static = []
    deps = bpy.context.evaluated_depsgraph_get()
    for source in list(scene.objects):
        if 'ClearCornea' not in source.name: continue
        mesh = bpy.data.meshes.new_from_object(source.evaluated_get(deps))
        mesh.transform(transform @ source.matrix_world)
        mesh.materials.clear(); mesh.materials.append(material)
        obj = bpy.data.objects.new('eye_cornea_' + source.name, mesh)
        scene.collection.objects.link(obj); static.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in static: obj.select_set(True)
    scene.view_layers[0].objects.active = static[0]
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
        use_active_scene=True, export_animations=False, export_yup=True, export_cameras=False,
        export_lights=False, export_copyright='© 2026 AIB Inc. https://www.aib.vote')
    print(json.dumps({'scale':scale, 'center_x':center_x, 'bytes':output.stat().st_size,'meshes':len(static)}))
finally:
    bpy.context.window.scene = previous
