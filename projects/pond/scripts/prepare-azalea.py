# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
"""Blender Local: reduce the isolated imported azalea scene without changing source assets."""
import bpy
from mathutils import Vector, Matrix
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
previous=bpy.context.window.scene
if 'AI_Azalea_Web_20260930' in bpy.data.scenes:
 raise RuntimeError('Prepared azalea scene already exists; export it instead of rebuilding.')
source=bpy.data.scenes.get('AI_Azalea_Study_20260930')
if source is None:
 source=bpy.data.scenes.new('AI_Azalea_Study_20260930')
 try:
  bpy.context.window.scene=source
  bpy.ops.import_scene.gltf(filepath=str(ROOT/'assets/pink azalea 3d model.glb'))
 finally:
  bpy.context.window.scene=previous
output=bpy.data.scenes.new('AI_Azalea_Web_20260930')
objects=[o for o in source.objects if o.type=='MESH']
points=[o.matrix_world@Vector(c) for o in objects for c in o.bound_box]
lo=Vector([min(v[i] for v in points) for i in range(3)])
hi=Vector([max(v[i] for v in points) for i in range(3)])
base=Vector(((lo.x+hi.x)*.5,(lo.y+hi.y)*.5,lo.z))
normalise=Matrix.Scale(1/(hi.z-lo.z),4)@Matrix.Translation(-base)
try:
 bpy.context.window.scene=output
 for level,ratio,minimum in [('Near',.006,32),('Far',.0018,16)]:
  parent=bpy.data.objects.new('AI_Azalea_'+level,None);output.collection.objects.link(parent)
  total=0
  for i,src in enumerate(objects):
   mesh=src.data.copy();mesh.transform(normalise@src.matrix_world)
   obj=bpy.data.objects.new('Azalea_'+level+'_'+str(i),mesh);output.collection.objects.link(obj);obj.parent=parent
   bpy.context.view_layer.objects.active=obj
   mod=obj.modifiers.new('Web flower reduction','DECIMATE');mod.ratio=max(ratio,minimum/len(mesh.polygons));mod.use_collapse_triangulate=True
   bpy.ops.object.modifier_apply(modifier=mod.name)
   for face in mesh.polygons:face.use_smooth=True
   total+=len(mesh.polygons)
  print(level,total,'triangles')
finally:
 bpy.context.window.scene=previous
