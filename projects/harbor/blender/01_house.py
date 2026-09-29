# Run common.py first in the same execution namespace.
if SCENE in bpy.data.scenes: raise RuntimeError('Scene already exists: do not overwrite manual edits')
s=bpy.data.scenes.new(SCENE);s.unit_settings.system='METRIC';s.unit_settings.scale_length=1
bpy.context.window.scene=s
# Two-storey timber tea house; front faces +Z in web coordinates.
box((0,3.4,0),(7.8,4.7,5.2),'plaster')
for floor in [1.18,3.6,5.7]:box((0,floor,0),(8.1,.24,5.45),'dark')
for x in [-3.9,-2.6,-1.3,0,1.3,2.6,3.9]:
 for z in [-2.64,2.64]:box((x,3.5,z),(.18,4.85,.18),'cedar')
for x in [-3.95,3.95]:
 for z in [-1.8,-.6,.6,1.8]:box((x,3.45,z),(.18,4.85,.18),'wood')
for x in [-3.25,-1.95,-.65,.65,1.95,3.25]:
 window(x,4.62,2.7,1.08,1.65)
 if abs(x)>1:window(x,2.2,2.7,1.06,1.5)
for x in [-3.99,3.99]:
 for z in [-1.85,-.6,.65,1.85]:
  for y in [2.15,4.62]:window(x,y,z,1.04,1.65,True)
# Dark entrance and open noren curtains.
box((0,2.15,2.7),(1.2,1.88,.10),'dark')
for x in [-.42,0,.42]:box((x,2.7,2.85),(.39,.75,.035),'red')
roof(0,5.7,0,9,6.8,1.55)
roof(0,3.5,2.0,8.9,2.5,.40)
# Eaves with visible timber rafters.
for x in [i*.43-4.3 for i in range(21)]:rod((x,5.75,-3.25),(x,5.75,3.25),.057,'wood')
# Signboard; artwork is layered as a canvas texture by the web renderer.
box((0,3.44,3.02),(3.7,.57,.16),'dark')
box((0,6.31,1.10),(3.0,.75,.12),'dark')
# Board-and-batten lower cladding.
for i in range(61):
 x=-3.85+i*.128
 for z in [-2.68,2.68]:box((x,1.35,z),(.117,.38,.06),'wood' if i%4 else 'cedar')
for x in [-3.5,-2.1,2.1,3.5]:lantern(x,2.82,3.2,.95)
for x in [-4.4,4.4]:
 box((x,2.08,3.35),(.13,2.25,.13),'dark');lantern(x,3.12,3.35,.85)
root=flush('Teahouse')
print('Created',root.name,'meshes',len(root.children),'bounds: 9m wide, 7.25m high')
