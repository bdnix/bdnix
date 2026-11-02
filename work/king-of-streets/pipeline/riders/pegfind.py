import bpy,numpy as np,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
b=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/bikes_plain/{b}.glb')
o=bpy.data.objects['body'];m=o.to_mesh();m.transform(o.matrix_world)
bvh=BVHTree.FromPolygons([v.co[:] for v in m.vertices],[p.vertices[:] for p in m.polygons])
B=lambda x,y,z:Vector((x,-z,y))
def ring(c,a,rmax=0.02):
    e1=Vector((0,0,1));e2=a.cross(e1);P=[]
    for k in range(16):
        th=2*math.pi*k/16;dv=e1*math.cos(th)+e2*math.sin(th)
        h=bvh.ray_cast(c,dv,rmax)
        if h[0] is None:return None
        P.append(((h[0]-c).dot(e1),(h[0]-c).dot(e2)))
    P=np.array(P);A=np.c_[2*P[:,0],2*P[:,1],np.ones(16)];bb=(P**2).sum(1)
    sol=np.linalg.lstsq(A,bb,rcond=None)[0];cx,cy=sol[0],sol[1];r=math.sqrt(max(sol[2]+cx*cx+cy*cy,0))
    res=np.abs(np.hypot(P[:,0]-cx,P[:,1]-cy)-r).max()
    return (c+e1*cx+e2*cy,r,res)
out=[]
a=Vector((1,0,0))
for x in np.arange(0.12,0.34,0.02):
  for y in np.arange(0.18,0.55,0.01):
    for z in np.arange(-0.55,0.40,0.01):
      r0=ring(B(x,y,z),a)
      if r0 is None:continue
      c0,r,res=r0
      if not(0.005<r<0.016 and res<0.0015):continue
      L=0;
      for sgn in (1,-1):
          t=0
          while t<0.15:
              t+=0.01;q=ring(c0+a*(sgn*t),a)
              if q is None or q[2]>0.002 or abs(q[1]-r)>0.0015:break
              L+=0.01
      if L>=0.04:out.append((L,r,c0))
out.sort(key=lambda t:-t[0]);seen=[]
print(b,'peg-shaped cylinders along x (length cm, radius mm, centre gltf):')
for L,r,c in out:
    g=np.array([c.x,c.z,-c.y])
    if any(np.linalg.norm(g[1:]-s[1:])<0.03 and abs(g[0]-s[0])<0.06 for s in seen):continue
    seen.append(g);print('  len %.0f cm  r %.1f mm  at %s'%(L*100,r*1000,np.round(g,3)))
    if len(seen)>=12:break
