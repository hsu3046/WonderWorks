# Planks and support structure remain actual geometry for close views.
def deck(cx,cz,w,d):
 for i in range(int(w/.24)):
  x=cx-w/2+(i+.5)*.24
  box((x,1.02+random.uniform(-.012,.012),cz),(.223,.16,d),'plank' if i%4 else 'cedar')
 for z in [cz-d/2+.2,cz,cz+d/2-.2]:box((cx,.72,z),(w,.27,.25),'dark')
 for x in [cx-w/2+.3,cx,cx+w/2-.3]:
  for z in [cz-d/2+.3,cz+d/2-.3]:rod((x,-1.6,z),(x,1.14,z),.14,'wood')
def railing(a,b):
 n=max(1,int((Vector(b)-Vector(a)).length/1.7));ps=[]
 for i in range(n+1):
  p=Vector(a).lerp(Vector(b),i/n);ps.append(p)
  rod(tuple(p),tuple(p+Vector((0,1.08,0))),.075,'dark');box(tuple(p+Vector((0,1.1,0))),(.19,.07,.19),'cedar')
 for a,b in zip(ps,ps[1:]):
  line([tuple(a.lerp(b,i/12)+Vector((0,.8-.18*math.sin(math.pi*i/12),0))) for i in range(13)],.027,'rope')
deck(0,0,11,8.5);deck(6.6,1.5,2.7,13);deck(-8,-1,5.2,2.2)
railing((-5.3,1.1,4.1),(-2,1.1,4.1));railing((2,1.1,4.1),(5.3,1.1,4.1))
railing((-5.3,1.1,-4.1),(-5.3,1.1,4.1));railing((7.75,1.1,-4.8),(7.75,1.1,7.6))
railing((-10.5,1.1,-2),(-5.5,1.1,-2))
for x,z in [(6.65,-4.5),(6.65,7.5),(-5,3.8),(-8,-1.9)]:
 rod((x,1,z),(x,3,z),.075,'dark');lantern(x,2.82,z,.65)
# Wooden barrels with iron hoops, crates, stools and small cups.
for x,z in [(-4.6,-2.9),(-4.6,-1.9),(4.5,-2.9),(6.4,5.6)]:
 sphere((x,1.51,z),(.36,.49,.36),'wood',16,12)
 for yy in [1.2,1.4,1.7,1.87]:
  line([(x+.347*math.cos(i*math.tau/24),yy,z+.347*math.sin(i*math.tau/24)) for i in range(25)],.021,'iron')
 box((x,1.98,z),(.51,.055,.5),'plank')
for x,z in [(-4.5,.6),(4.65,1.2),(-6.2,-.9)]:
 box((x,1.43,z),(.64,.67,.65),'cedar')
 for a in [-.27,.27]:box((x+a,1.43,z+.33),(.06,.67,.05),'dark')
 rod((x-.3,1.13,z+.35),(x+.3,1.73,z+.35),.026,'dark')
for x in [-2.6,2.6]:
 box((x,1.65,3.3),(1.45,.13,.55),'cedar')
 for xx in [-.55,.55]:box((x+xx,1.36,3.3),(.12,.58,.35),'wood')
 for xx in [-.38,.26]:rod((x+xx,1.73,3.3),(x+xx,1.86,3.3),.065,'plaster',12)
# Dock access steps.
for i in range(5):box((0,.84-i*.15,4.35+i*.3),(2.0,.18,.35),'plank')
flush('Dock')

def hull(length,width):
 # Hull skin consists of 6 individually lapped strakes; no closed solid ellipsoid.
 N=28
 def p(t,v,side):
  z=(t-.5)*length;shape=max(.015,math.sin(t*math.pi))**.62
  return (side*width*.5*shape*(.45+.55*v),-.20+.68*v+.34*abs(2*t-1)**3,z)
 for side in [-1,1]:
  for j in range(6):
   v=j/6;u=(j+1)/6
   for i in range(N):
    t=i/N;t2=(i+1)/N
    mesh([p(t,v,side),p(t2,v,side),p(t2,u,side),p(t,u,side)],[(0,1,2,3)],'wood' if j%2 else 'cedar')
   line([p(i/N,u,side) for i in range(N+1)],.018,'dark')
  line([p(i/N,1,side) for i in range(N+1)],.055,'rim')
 for i in range(16):
  z=(i/15-.5)*length*.84;w=width*max(.05,math.sin((i/15*.84+.08)*math.pi))**.62*.58
  box((0,-.02,z),(w,.06,length/18),'plank')
 for t in [.23,.46,.70]:
  z=(t-.5)*length;w=width*math.sin(t*math.pi)**.62*.94
  box((0,.36,z),(w,.10,.23),'cedar')
 for t in [0,1]:rod((0,-.16,(t-.5)*length),(0,.88,(t-.5)*length),.065,'dark')

hull(4,1.45)
for side in [-1,1]:
 rod((side*.4,.44,.25),(side*1.7,.08,-.3),.028,'cedar');box((side*1.67,.10,-.33),(.20,.05,.56),'wood',side*.38)
flush('Rowboat')
hull(7,2.6)
# Flat cabin set into traditional coastal sailing boat.
box((0,.5,-.9),(2,.18,2.7),'dark');box((0,1.24,-.9),(1.75,1.35,2.55),'wood')
for x in [-.9,.9]:
 for z in [-1.7,-.9,-.1]:window(x,1.34,z,.62,.85,True)
roof(0,1.98,-.9,2.5,3.2,.3)
rod((0,.1,1.02),(0,7.9,1.02),.075,'wood',10,.038)
# Curved woven sail, modeled in a 12 x 16 grid.
v=[];f=[]
for j in range(17):
 t=j/16;y=2.2+t*5.35;w=3.5*(1-.65*t)
 for i in range(13):
  u=i/12;v.append((u*w,y,1.02+.26*math.sin(u*math.pi)*math.sin(t*math.pi)))
for j in range(16):
 for i in range(12):a=j*13+i;f.append((a,a+1,a+14,a+13))
mesh(v,f,'cloth')
for j in range(6):
 t=j/5;w=3.5*(1-.65*t);y=2.2+t*5.35
 line([(u/12*w,y,1.02+.27*math.sin(u/12*math.pi)*math.sin(t*math.pi)) for u in range(13)],.025,'wood')
for end in [(0,.4,-3.3),(0,.4,3.3),(-1.1,.45,0)]:rod((0,7.7,1.02),end,.016,'rope',6)
lantern(.88,2.17,.65,.58)
flush('Sailboat')
print('Created Dock, Rowboat and Sailboat')
