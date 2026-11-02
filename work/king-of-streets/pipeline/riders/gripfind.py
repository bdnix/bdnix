import bpy,numpy as np,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
b=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/bikes_plain/{b}.glb')
o=bpy.data.objects['body'];m=o.to_mesh();m.transform(o.matrix_world)
bvh=BVHTree.FromPolygons([v.co[:] for v in m.vertices],[p.vertices[:] for p in m.polygons])
B=lambda x,y,z:Vector((x,-z,y))
def ring(c,a,rmax=0.03):
    e1=Vector((0,0,1));e1=(e1-a*e1.dot(a)).normalized();e2=a.cross(e1);P=[]
    for k in range(24):
        th=2*math.pi*k/24;dv=e1*math.cos(th)+e2*math.sin(th)
        h=bvh.ray_cast(c,dv,rmax)
        if h[0] is None:return None
        P.append(((h[0]-c).dot(e1),(h[0]-c).dot(e2)))
    P=np.array(P);A=np.c_[2*P[:,0],2*P[:,1],np.ones(24)];bb=(P**2).sum(1)
    sol=np.linalg.lstsq(A,bb,rcond=None)[0];cx,cy=sol[0],sol[1];r=math.sqrt(max(sol[2]+cx*cx+cy*cy,0))
    res=np.abs(np.hypot(P[:,0]-cx,P[:,1]-cy)-r).max()
    return (c+e1*cx+e2*cy,r,res)
best=[]
axes=[]
for ang in range(-60,61,15):          # horizontal sweep of the grip axis (outward +x)
    for tilt in (-20,0,20):
        a=Vector((math.cos(math.radians(ang)),math.sin(math.radians(ang)),math.sin(math.radians(tilt)))).normalized();axes.append(a)
for x in np.arange(0.16,0.46,0.02):
  for yb in np.arange(0.70,1.20,0.02):
    for zb in np.arange(0.10,0.80,0.02):
      c=B(x,yb,zb)
      for a in axes:
        r0=ring(c,a)
        if r0 is None:continue
        c0,r,res=r0
        if not(0.011<r<0.024 and res<0.002):continue
        # consistent along the axis?
        ok=0;rs=[]
        for t in (-0.03,-0.015,0.015,0.03):
            r1=ring(c0+a*t,a)
            if r1 and abs(r1[1]-r)<0.0015 and r1[2]<0.002:ok+=1;rs.append(r1[1])
        if ok>=3:best.append((ok,res,r,c0,a))
print(b,'candidates',len(best))
best.sort(key=lambda t:(-t[0],t[1]))
seen=[]
for ok,res,r,c0,a in best:
    g=np.array([c0.x,c0.z,-c0.y]);
    if any(np.linalg.norm(g-s)<0.04 for s in seen):continue
    seen.append(g)
    print(' cand centre(gltf) %s radius %.1f mm axis(gltf) %s ok %d res %.1f mm'%(np.round(g,3),r*1000,np.round([a.x,a.z,-a.y],3),ok,res*1000))
    if len(seen)>=6:break
