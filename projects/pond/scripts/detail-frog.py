# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
import bpy, math, json
from mathutils import Vector, Quaternion, noise
scene=bpy.data.scenes['AI_Stillwater_Frog_20260929']
body=bpy.data.objects['SW_Frog_Skin']
# Vertex pigmentation survives GLB export without a large texture or per-frame CPU work.
colors=body.data.color_attributes.new(name='SkinPigment',type='FLOAT_COLOR',domain='POINT')
for v,item in zip(body.data.vertices,colors.data):
    p=body.matrix_world@v.co
    n=noise.noise_vector(p*27)[0]*.5+.5
    pores=noise.noise_vector(p*110)[1]*.5+.5
    top=max(0,min(1,(p.z-.09)/.13))
    base=Vector((.31,.30,.13)).lerp(Vector((.11,.19,.035)),top)
    blot=max(0,min(1,(n-.52)*5))*.65
    base*=1-blot
    base*=.88+pores*.22
    # Broken pale folds and a subdued spinal wash, rather than painted round dots.
    stripe=math.exp(-((abs(p.x)-.128)/.018)**2)*max(0,1-abs(p.y-.05)/.34)*top
    base=base.lerp(Vector((.34,.34,.095)),stripe*.55)
    item.color=(*base,1)
mat=bpy.data.materials.new('SW_Frog_OliveMottle');mat.use_nodes=True
bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='SkinPigment'
mat.node_tree.links.new(vc.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.48
body.data.materials.clear();body.data.materials.append(mat)

def material(name,color,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True
    n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough
    return m
iris=material('SW_Frog_BronzeIris',(.28,.20,.048),.32)
black=material('SW_Frog_Pupil',(.004,.009,.006),.13)
rim=material('SW_Frog_MouthSeam',(.029,.041,.014),.59)
throat=material('SW_Frog_Throat',(.40,.40,.23),.53)

def ellipsoid(name,location,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=16,location=location)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o
for side in [-1,1]:
    ellipsoid('SW_Frog_Iris',(side*.148,-.270,.304),(.049,.046,.045),iris)
    ellipsoid('SW_Frog_Pupil',(side*.148,-.299,.327),(.032,.022,.015),black)
    ellipsoid('SW_Frog_Nostril',(side*.07,-.403,.204),(.008,.003,.004),rim)
    ellipsoid('SW_Frog_Tympanum',(side*.224,-.166,.216),(.007,.040,.034),mat)
    # Mouth is a shallow crease following the muzzle, not a cartoon smile.
    curve=bpy.data.curves.new('SW_Frog_LipLine','CURVE');curve.dimensions='3D';curve.bevel_depth=.0025;curve.bevel_resolution=2
    spline=curve.splines.new('POLY');spline.points.add(18)
    for i,point in enumerate(spline.points):
        t=i/18;point.co=(side*(.022+.19*t),-.409+.115*t*t,.155+.012*t,1)
    o=bpy.data.objects.new('SW_Frog_Mouth',curve);scene.collection.objects.link(o);curve.materials.append(rim)
ellipsoid('SW_Frog_ThroatBreath',(0,-.333,.124),(.111,.053,.041),throat)
# Keep smooth detail but reduce redundant remesh triangles before web export.
bpy.context.view_layer.objects.active=body
mod=body.modifiers.new('Web density','DECIMATE');mod.ratio=.42
bpy.ops.object.modifier_apply(modifier=mod.name)
for o in bpy.context.selected_objects:o.select_set(False)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        v=area.spaces.active;v.region_3d.view_location=(0,-.02,.14);v.region_3d.view_distance=1.7
        v.region_3d.view_rotation=Quaternion((1,0,0),math.radians(63));v.shading.type='MATERIAL';v.overlay.show_overlays=False
print(json.dumps({'objects':[o.name for o in scene.objects],'bodyVertices':len(body.data.vertices)}))
