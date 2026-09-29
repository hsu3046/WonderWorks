# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
# Run in Blender. Creates a separate scene; existing scenes and assets are preserved.
import bpy, math, json
from mathutils import Vector, Quaternion
name='AI_Stillwater_Frog_20260929'
assert name not in bpy.data.scenes, 'A frog scene already exists; inspect it before re-running.'
scene=bpy.data.scenes.new(name)
bpy.context.window.scene=scene
parts=[]
def ellipsoid(label,location,scale,skin=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16,location=location)
    o=bpy.context.object;o.name='SW_Frog_'+label;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if skin:parts.append(o)
    return o

def segment(label,a,b,radius):
    a,b=Vector(a),Vector(b);o=ellipsoid(label,(a+b)/2,(radius,radius,(b-a).length/2+radius*.5))
    o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    return o

ellipsoid('Trunk',(0,.045,.158),(.213,.30,.135))
ellipsoid('Head',(0,-.20,.203),(.237,.195,.112))
ellipsoid('Muzzle',(0,-.326,.177),(.184,.098,.070))
ellipsoid('Throat',(0,-.247,.118),(.176,.14,.067))
for side in [-1,1]:
    ellipsoid('Brow',(side*.145,-.222,.285),(.084,.105,.069))
    ellipsoid('Haunch',(side*.236,.119,.124),(.143,.229,.115))
    segment('Shin',(side*.32,-.005,.074),(side*.29,.305,.039),.055)
    segment('HindFoot',(side*.29,.305,.039),(side*.385,.165,.022),.030)
    segment('UpperArm',(side*.189,-.164,.165),(side*.279,-.103,.074),.049)
    segment('Forearm',(side*.279,-.103,.074),(side*.296,-.329,.030),.032)
    ellipsoid('Palm',(side*.296,-.341,.023),(.049,.045,.019))
    for j in range(4):
        x=side*(.260+j*.024);tip=(side*(.238+j*.046),-.444-.023*math.sin(j),.012)
        segment('Finger',(x,-.360,.020),tip,.009)
        ellipsoid('FingerTip',tip,(.012,.014,.007))
    for j in range(5):
        a=(side*(.35+j*.012),.180,.024);b=(side*(.295+j*.047),.025+abs(j-2)*.028,.012)
        segment('HindToe',a,b,.010)
        ellipsoid('ToeTip',b,(.013,.016,.007))
    # Dorsolateral folds follow the back instead of forming separate decorative spots.
    for j in range(8):
        y=-.11+j*.045;z=.248-((y-.02)/.34)**2*.045
        ellipsoid('BackFold',(side*(.130-.016*j/8),y,z),(.018,.033,.019))
# Join only the newly authored body parts and fuse their intersections.
for o in bpy.context.selected_objects:o.select_set(False)
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join();body=bpy.context.object;body.name='SW_Frog_Skin'
rem=body.modifiers.new('Continuous skin','REMESH');rem.mode='VOXEL';rem.voxel_size=.007;rem.use_smooth_shade=True
bpy.ops.object.modifier_apply(modifier=rem.name)
smooth=body.modifiers.new('Organic transitions','SMOOTH');smooth.factor=.7;smooth.iterations=4
bpy.ops.object.modifier_apply(modifier=smooth.name)
for p in body.data.polygons:p.use_smooth=True
print(json.dumps({'scene':scene.name,'body':body.name,'vertices':len(body.data.vertices),'dimensions':list(body.dimensions)}))
