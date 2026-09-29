# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
# Run in connected Blender after prepare-supplied-assets.py. Uses source CC BY rig weights.
import bpy, math
from mathutils import Vector, Matrix
source=bpy.data.scenes['AI_Stillwater_Asset_frog']
web=bpy.data.scenes['AI_Stillwater_Web_frog']
original=next(o for o in source.objects if o.type=='MESH' and 'Montane' in o.name)
rig=next(o for o in source.objects if o.type=='ARMATURE')
points=[o.matrix_world@v.co for o in source.objects if o.type=='MESH' for v in o.data.vertices]
lo=Vector([min(v[i] for v in points) for i in range(3)])
hi=Vector([max(v[i] for v in points) for i in range(3)])
center=(lo+hi)*.5;center.z=lo.z
transform=Matrix.Scale(1.1/max(hi.x-lo.x,hi.y-lo.y),4)@Matrix(((0,1,0,0),(-1,0,0,0),(0,0,1,0),(0,0,0,1)))@Matrix.Translation(-center)
base=next(o for o in web.objects if 'Montane' in o.name)
assert len(base.data.vertices)==len(original.data.vertices)
error=max((base.data.vertices[v.index].co-transform@original.matrix_world@v.co).length for v in original.data.vertices)
assert error<.0001, ('Vertex correspondence changed',error)
name='AI_Stillwater_FrogHop_20260930'
assert name not in bpy.data.scenes, 'Inspect existing output before rerun'
out=bpy.data.scenes.new(name)
clones=[]
for obj in web.objects:
 clone=obj.copy();clone.data=obj.data.copy();clone.name='SW_Hop_'+obj.name;out.collection.objects.link(clone);clones.append(clone)
body=next(o for o in clones if 'Montane' in o.name)
body.shape_key_add(name='Basis')
weights=[]
for vertex in original.data.vertices:
 weights.append({original.vertex_groups[g.group].name:g.weight for g in vertex.groups})
def joint(name):return transform@rig.matrix_world@rig.data.bones[name].head_local
# Each limb uses the supplied thigh/shin/foot or arm/forearm weights, not a spatial mask.
for pose in ['Crouch','Kick','Tuck','Reach']:
 key=body.shape_key_add(name=pose,from_mix=False);key.value=0
 for i,v in enumerate(base.data.vertices):key.data[i].co=v.co
 for side in ['L','R']:
  sign=1 if side=='L' else -1
  for hind in [True,False]:
   upper='thigh' if hind else 'upper_arm';lower='shin' if hind else 'forearm';distal='foot' if hind else 'hand'
   hip,knee,ankle=[joint('DEF-'+n+'.'+side) for n in [upper,lower,distal]]
   if hind:
    dirs={'Crouch':((sign*.7,-.25,.25),(-sign*.65,.62,.05)), 'Kick':((sign*.16,1,-.18),(sign*.08,1,-.12)), 'Tuck':((sign*.8,.05,.28),(-sign*.30,-.95,.18)), 'Reach':((sign*.55,.2,-.1),(-sign*.35,.85,-.25))}
   else:
    dirs={'Crouch':((sign*.7,.05,-.4),(-sign*.15,-.45,.1)), 'Kick':((sign*.45,.55,.1),(-sign*.1,.65,.25)), 'Tuck':((sign*.6,.5,.1),(-sign*.2,.5,.3)), 'Reach':((sign*.3,-.45,-.65),(sign*.1,-.65,-.4))}
   a,b=map(Vector,dirs[pose]);q1=(knee-hip).rotation_difference(a);newKnee=hip+q1@(knee-hip);q2=(q1@(ankle-knee)).rotation_difference(b)
   prefixes=['DEF-'+upper,'DEF-'+lower,'DEF-'+distal,'DEF-r_' if hind else 'DEF-f_']
   for i,v in enumerate(base.data.vertices):
    groups=weights[i];leg=sum(w for n,w in groups.items() if any(n.startswith(p) for p in prefixes) and ('.'+side) in n)
    if leg<.00001:continue
    lowerWeight=sum(w for n,w in groups.items() if any(n.startswith(p) for p in prefixes[1:]) and ('.'+side) in n)
    p1=hip+q1@(v.co-hip);p2=newKnee+q2@(p1-newKnee)
    value=p1.lerp(p2,min(1,lowerWeight/max(leg,.0001)))
    key.data[i].co+=(value-v.co)*min(1,leg)
print('Created',name,'objects',[o.name for o in clones],'vertex error',error,'morphs',list(body.data.shape_keys.key_blocks.keys()))
bpy.context.window.scene=out
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.region_3d.view_location=Vector((0,0,.20));area.spaces.active.region_3d.view_distance=2.4
  area.spaces.active.shading.type='MATERIAL'
