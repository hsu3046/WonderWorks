# SPDX-License-Identifier: GPL-3.0-only
# Original parametric harbor assets. © 2026 AIB Inc.
import bpy, math, random
from mathutils import Vector
from collections import defaultdict
random.seed(299)
SCENE='AI_Tidelight_260929'
# Model in web coordinates (Y up), then convert to Blender (Z up).
def xyz(p): return (p[0],-p[2],p[1])
buckets=defaultdict(lambda:[[],[]])
def mat(name,c,rough=.72,emit=0):
    m=bpy.data.materials.get('TL_'+name)
    if m: return m
    m=bpy.data.materials.new('TL_'+name); m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*c,1); p.inputs['Roughness'].default_value=rough
    if emit: p.inputs['Emission Color'].default_value=(*c,1); p.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=(*c,1)
    return m
M={
'wood':mat('wood',(.15,.083,.043)), 'cedar':mat('cedar',(.26,.15,.075)),
'dark':mat('dark',(.045,.049,.038)), 'plank':mat('plank',(.235,.20,.13)),
'plaster':mat('plaster',(.50,.46,.33)), 'roof':mat('roof',(.071,.103,.094),.53),
'roof2':mat('roof2',(.10,.14,.12),.6),'rim':mat('rim',(.16,.19,.145)),
'paper':mat('paper',(.80,.44,.16),.85,.65), 'lamp':mat('lamp',(1,.45,.10),.6,3),
'rope':mat('rope',(.37,.30,.18)), 'iron':mat('iron',(.04,.06,.052),.36),
'cloth':mat('cloth',(.63,.51,.28)), 'red':mat('red',(.23,.06,.035)),
'stone':mat('stone',(.21,.24,.21)), 'moss':mat('moss',(.14,.23,.11))}
def mesh(v,f,m):
    b=buckets[m]; n=len(b[0]); b[0].extend(xyz(p) for p in v); b[1].extend(tuple(n+i for i in face) for face in f)
def box(p,s,m,rot=0):
    x,y,z=p; w,h,d=[q*.5 for q in s]; co=math.cos(rot); si=math.sin(rot)
    v=[]
    for a,b,c in [(-w,-h,-d),(w,-h,-d),(w,h,-d),(-w,h,-d),(-w,-h,d),(w,-h,d),(w,h,d),(-w,h,d)]: v.append((x+a*co+c*si,y+b,z-a*si+c*co))
    mesh(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(1,2,6,5),(0,4,7,3)],m)
def rod(a,b,r,m,n=8,r2=None):
    a=Vector(a);b=Vector(b);axis=(b-a).normalized(); u=axis.cross(Vector((0,1,0)))
    if u.length<.001:u=axis.cross(Vector((1,0,0)))
    u.normalize();v=axis.cross(u);verts=[]
    for p,rr in [(a,r),(b,r if r2 is None else r2)]:
      for i in range(n): verts.append(tuple(p+rr*(u*math.cos(i*math.tau/n)+v*math.sin(i*math.tau/n))))
    mesh(verts,[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]+[tuple(reversed(range(n))),tuple(range(n,n*2))],m)
def line(points,r,m):
    for a,b in zip(points,points[1:]): rod(a,b,r,m,6)
def sphere(p,s,m,nu=16,nv=10):
    vs=[]
    for j in range(nv+1):
      t=j*math.pi/nv
      for i in range(nu):
       q=i*math.tau/nu;vs.append((p[0]+s[0]*math.sin(t)*math.cos(q),p[1]+s[1]*math.cos(t),p[2]+s[2]*math.sin(t)*math.sin(q)))
    mesh(vs,[(j*nu+i,j*nu+(i+1)%nu,(j+1)*nu+(i+1)%nu,(j+1)*nu+i) for j in range(nv) for i in range(nu)],m)
def flush(name):
    scene=bpy.data.scenes[SCENE];root=bpy.data.objects.new(name,None);scene.collection.objects.link(root)
    for key,(v,f) in buckets.items():
      if not v:continue
      me=bpy.data.meshes.new(name+'_'+key);me.from_pydata(v,[],f);me.update()
      ob=bpy.data.objects.new(name+'_'+key,me);scene.collection.objects.link(ob);ob.parent=root;me.materials.append(M[key])
    buckets.clear();return root

def roof(cx,y,cz,w,d,rise):
    # Curved gable with projecting eaves and individually articulated ceramic tile ribs.
    def ry(t):return y+rise*(1-t)**1.7+.18*t**8
    for side in [-1,1]:
      for i in range(16):
        t=i/16;u=(i+1)/16
        mesh([(cx-w/2,ry(t),cz+side*d/2*t),(cx+w/2,ry(t),cz+side*d/2*t),(cx+w/2,ry(u),cz+side*d/2*u),(cx-w/2,ry(u),cz+side*d/2*u)],[(0,1,2,3)],'roof')
      for i in range(int(w/.22)+1):
        x=cx-w/2+i*.22
        for j in range(9):
          t=j/9;u=(j+1)/9
          rod((x,ry(t)+.05,cz+side*d/2*t),(x,ry(u)+.05,cz+side*d/2*u),.046,'roof2' if (i+j)%5==0 else 'roof',6)
      for x in [cx-w/2,cx+w/2]:line([(x,ry(j/16),cz+side*d/2*j/16) for j in range(17)],.09,'rim')
      rod((cx-w/2,ry(1),cz+side*d/2),(cx+w/2,ry(1),cz+side*d/2),.095,'rim')
    rod((cx-w/2-.2,y+rise,cz),(cx+w/2+.2,y+rise,cz),.14,'rim',10)

def window(x,y,z,w,h,side=False):
    box((x,y,z),(.07,h,w) if side else (w,h,.07),'paper')
    for i in range(int(w/.24)+1):
      offset=-w/2+i*w/int(w/.24)
      box((x+.07 if side else x+offset,y,z+offset if side else z+.07),(.10,h,.045) if side else (.045,h,.10),'wood')
    for j in range(5):
      box((x+.08 if side else x,y-h/2+j*h/4,z if side else z+.08),(.10,.045,w) if side else (w,.045,.10),'wood')
    for a in [-1,1]:
      box((x,y+a*h/2,z),(.18,.13,w+.15) if side else (w+.15,.13,.18),'cedar')

def lantern(x,y,z,scale=1):
    sphere((x,y,z),(.25*scale,.34*scale,.25*scale),'lamp')
    for j in range(1,10):
      t=j*math.pi/10;r=math.sin(t)*.252*scale; yy=y+math.cos(t)*.34*scale
      pts=[(x+r*math.cos(i*math.tau/24),yy,z+r*math.sin(i*math.tau/24)) for i in range(25)]
      line(pts,.007*scale,'cedar')
    for a in [-1,1]:box((x,y+a*.33*scale,z),(.14*scale,.065*scale,.14*scale),'dark')
    rod((x,y+.34*scale,z),(x,y+.64*scale,z),.014,'iron')
