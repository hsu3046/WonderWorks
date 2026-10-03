# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
"""Run in Blender's Python console or with blender --background --python.
Isolate all operations from the open scene and never overwrite a source file.
"""
from pathlib import Path
import bpy
ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / 'assets/hydrangea flower 3d model.glb'
WORK = ROOT / 'docs/validation/hydrangea'
WORK.mkdir(parents=True, exist_ok=True)
previous = bpy.context.window.scene
try:
    for name, ratio, minimum, filename in [
        ('Near', .024, 140, 'near.glb'), ('Far', .006, 80, 'reduced.glb')
    ]:
        scene = bpy.data.scenes.new('AI_Hydrangea_Export_' + name)
        bpy.context.window.scene = scene
        bpy.ops.import_scene.gltf(filepath=str(SOURCE))
        meshes = [o for o in scene.objects if o.type == 'MESH']
        for obj in meshes:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('Web reduction', 'DECIMATE')
            modifier.ratio = max(ratio, min(1, minimum / len(obj.data.polygons)))
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
            for polygon in obj.data.polygons:
                polygon.use_smooth = True
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:
            obj.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(WORK / filename), export_format='GLB',
                                  use_selection=True, use_active_scene=True)
finally:
    bpy.context.window.scene = previous
