import bpy,numpy as np,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
bike=sys.argv[-2];side=sys.argv[-1]   # side 'x+' or 'x-'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/bikes_plain/{bike}.glb')
o=bpy.data.objects['body'];dg=bpy.context.evaluated_depsgraph_get()
bm=o.to_mesh();bm.transform(o.matrix_world)
bvh=BVHTree.FromPolygons([v.co[:] for v in bm.vertices],[p.vertices[:] for p in bm.polygons])
B=lambda x,y,z:Vector((x,-z,y))
c0=B(*([0.326,1.021,0.341] if side=='x+' else [-0.328,1.019,0.343]));a0=B(*([0.803,-0.04,-0.595] if side=='x+' else [-0.812,-0.044,-0.581])).normalized()
e1=Vector((0,0,1));e1=(e1-a0*e1.dot(a0)).normalized();e2=a0.cross(e1)
import math
for t in np.arange(-0.13,0.14,0.02):
    pts=[]
    for k in range(36):
        ang=2*math.pi*k/36;dv=e1*math.cos(ang)+e2*math.sin(ang)
        origin=c0+a0*t
        hit=bvh.ray_cast(origin,dv,0.08)
        pts.append((hit[0]-origin) if hit[0] is not None else None)
    ok=[p for p in pts if p is not None]
    if len(ok)<12:print(f't {t*100:+.0f} cm: only {len(ok)} hits');continue
    r=[ (p-a0*p.dot(a0)).length for p in ok]
    print(f't {t*100:+.0f} cm: hits {len(ok)}/36  radial  min {min(r)*1000:.1f} median {np.median(r)*1000:.1f} max {max(r)*1000:.1f} mm')
print('--- circle fits per slice')
cs=[];rs=[];ts=[]
for t in np.arange(0.0,0.075,0.01):
    origin=c0+a0*t;P=[]
    for k in range(72):
        ang=2*math.pi*k/72;dv=e1*math.cos(ang)+e2*math.sin(ang)
        hit=bvh.ray_cast(origin,dv,0.05)
        if hit[0] is not None:P.append(((hit[0]-origin).dot(e1),(hit[0]-origin).dot(e2)))
    P=np.array(P)
    if len(P)<30:continue
    A=np.c_[2*P[:,0],2*P[:,1],np.ones(len(P))];bb=(P**2).sum(1)
    sol=np.linalg.lstsq(A,bb,rcond=None)[0];cx,cy=sol[0],sol[1];r=np.sqrt(sol[2]+cx*cx+cy*cy)
    res=np.abs(np.hypot(P[:,0]-cx,P[:,1]-cy)-r)
    cs.append(origin+e1*cx+e2*cy);rs.append(r);ts.append(t)
    print(f' t {t*100:+.0f} cm centre offset ({cx*1000:+.1f},{cy*1000:+.1f}) mm radius {r*1000:.1f} mm  residual max {res.max()*1000:.1f} mm  hits {len(P)}/72')
cs=np.array(cs)
if len(cs)>2:
    cm=cs.mean(0);u,s_,vt=np.linalg.svd(cs-cm);ax=vt[0]
    if ax.dot(a0)<0:ax=-ax
    print('AXIS centre(gltf)',np.round([cm[0],cm[2],-cm[1]],4),'axis(gltf)',np.round([ax[0],ax[2],-ax[1]],4),'median radius mm',round(float(np.median(rs))*1000,2))
