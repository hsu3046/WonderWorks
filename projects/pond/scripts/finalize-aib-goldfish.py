# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
"""Finalize the isolated export meshes; preserve authored tail alpha and limit GLB to this scene."""
import bpy
import numpy as np
import json
from pathlib import Path

scene = bpy.data.scenes['AI_Pond_Goldfish_v5_Export']
previous = bpy.context.window.scene
try:
    bpy.context.window.scene = scene
    objects = [o for o in scene.collection.objects if o.type == 'MESH' and o.name.endswith('_PondV5')]
    assert len(objects) == 32
    material = next(m for o in objects for m in o.data.materials if 'Caudal_Ivory' in m.name)
    nt = material.node_tree
    base = nt.nodes['Image Texture'].image
    mask = nt.nodes['GF_WhiteOnly_Transparency'].image
    pixels = np.array(base.pixels[:], dtype=np.float32).reshape(-1, 4)
    pixels[:, 3] = 1.0 - np.array(mask.pixels[:], dtype=np.float32).reshape(-1, 4)[:, 0]
    rgba = bpy.data.images.new('AI_Pond_v5_IvoryTail_RGBA', width=base.size[0], height=base.size[1], alpha=True)
    rgba.pixels.foreach_set(pixels.ravel()); rgba.update(); rgba.pack()
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = rgba
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    material.surface_render_method = 'DITHERED'
    for obj in objects:
        ratio = .25 if 'FinRays' in obj.name else .5 if 'eye_' in obj.name else .65 if obj.name.startswith('fin_') else 1
        if ratio < 1:
            mod = obj.modifiers.new('AI_Web_Detail', 'DECIMATE'); mod.ratio = ratio
            with bpy.context.temp_override(object=obj, active_object=obj):
                bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    scene.view_layers[0].objects.active = objects[0]
    outpath = Path('/Users/yuhitomi/Documents/Antigravity/Wonderworks/projects/pond/public/models/aib-goldfish-v5.glb')
    bpy.ops.export_scene.gltf(filepath=str(outpath), export_format='GLB', use_selection=True, use_active_scene=True,
        export_animations=False, export_morph=False, export_yup=True, export_apply=True,
        export_cameras=False, export_lights=False, export_copyright='© 2026 AIB Inc. https://www.aib.vote')
    print(json.dumps({'bytes':outpath.stat().st_size,'meshes':len(objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects)}))
finally:
    bpy.context.window.scene = previous
