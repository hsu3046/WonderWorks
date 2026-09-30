# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
"""Run in Blender Local after appending v5 into AI_Pond_Goldfish_v5_Export.

Only the isolated export scene is changed. Original .blend files are not saved.
Authored base color is baked for attribute-driven body/scale materials.
"""
import bpy
import json
from pathlib import Path
from mathutils import Matrix, Vector

scene = bpy.data.scenes['AI_Pond_Goldfish_v5_Export']
original_scene = bpy.context.window.scene
folder = Path('/Users/yuhitomi/Documents/Antigravity/Wonderworks/projects/pond/public/models')
output = folder / 'aib-goldfish-v5.glb'
assert not output.exists(), 'Refuse to overwrite a previous export'
try:
    bpy.context.window.scene = scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.margin = 8
    for part in ('Body_UnifiedSilhouette', 'Scales_Overlapping_Pearl'):
        obj = next(o for o in scene.objects if part in o.name)
        material = obj.data.materials[0]
        nodes, links = material.node_tree.nodes, material.node_tree.links
        bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        out = next(n for n in nodes if n.type == 'OUTPUT_MATERIAL')
        color_socket = bsdf.inputs['Base Color'].links[0].from_socket
        emission = nodes.new('ShaderNodeEmission')
        links.new(color_socket, emission.inputs['Color'])
        links.new(emission.outputs[0], out.inputs['Surface'])
        image = bpy.data.images.new('AI_Pond_v5_' + part + '_Color', width=2048, height=1024, alpha=False)
        target = nodes.new('ShaderNodeTexImage'); target.image = image
        nodes.active = target
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True); scene.view_layers[0].objects.active = obj
        bpy.ops.object.bake(type='EMIT', margin=8)
        image.pack()
        links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        links.new(target.outputs['Color'], bsdf.inputs['Base Color'])
        nodes.remove(emission)
        # glTF has no Blender per-plate attribute roughness socket.
        if 'Scales' in part:
            for link in list(bsdf.inputs['Roughness'].links): links.remove(link)
            bsdf.inputs['Roughness'].default_value = .38
        print('Baked original pigment:', part, flush=True)

    originals = list(scene.objects)
    deps = bpy.context.evaluated_depsgraph_get()
    static = []
    for obj in originals:
        if obj.type not in {'MESH', 'CURVE'} or 'Cornea' in obj.name: continue
        # Keep the relief scales intact; simplify only the already dense body/rays.
        if obj.type == 'CURVE':
            obj.data.resolution_u = 3; obj.data.bevel_resolution = 0
        if obj.type == 'MESH' and 'Body_Unified' in obj.name:
            mod = obj.modifiers.new('AI_Web_Body', 'DECIMATE'); mod.ratio = .35
        scene.view_layers[0].update()
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
        mesh.transform(obj.matrix_world)
        name = obj.name.split('.')[0]
        if any(p in name for p in ('VeilTail', 'Pectoral', 'Pelvic', 'Anal', 'Dorsal')):
            kind = 'caudal' if 'VeilTail' in name else 'dorsal' if 'Dorsal' in name else 'pectoral' if 'Pectoral' in name else 'pelvic' if 'Pelvic' in name else 'anal'
            name = 'fin_' + kind + '_' + name
        elif any(p in name for p in ('AmberIris', 'GlossyPupil')):
            name = ('eye_lens_' if 'Pupil' in name else 'eye_iris_') + name
        copy = bpy.data.objects.new('AI_' + name, mesh)
        # Runtime recognizes semantic fin/eye names without the authoring prefix.
        copy.name = name + '_PondV5'
        scene.collection.objects.link(copy); static.append(copy)
    lo = min(v.co.x for o in static for v in o.data.vertices)
    hi = max(v.co.x for o in static for v in o.data.vertices)
    transform = Matrix.Scale(2.2 / (hi-lo), 4) @ Matrix.Translation(Vector((-(lo+hi)/2, 0, 0)))
    for obj in static: obj.data.transform(transform)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in static: obj.select_set(True)
    scene.view_layers[0].objects.active = static[0]
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True, use_active_scene=True,
        export_animations=False, export_morph=False, export_yup=True, export_apply=True,
        export_cameras=False, export_lights=False, export_copyright='© 2026 AIB Inc. https://www.aib.vote')
    triangles = 0
    for obj in static:
        obj.data.calc_loop_triangles(); triangles += len(obj.data.loop_triangles)
    print(json.dumps({'path':str(output),'bytes':output.stat().st_size,'meshes':len(static),'triangles':triangles,'length':2.2}), flush=True)
finally:
    bpy.context.window.scene = original_scene
