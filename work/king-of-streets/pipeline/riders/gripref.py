import bpy,numpy as np,sys,math
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
b=sys.argv[1]; seeds=[tuple(map(float,s.split(','))) for s in sys.argv[2:]]   # cx,cy,cz,ax,ay,az (gltf)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/bikes_plain/{b}.glb')
o=bpy.data.objects['body'];m=o.to_mesh();m.transform(o.matrix_world)
bvh=BVHTree.FromPolygons([v.co[:] for v in m.vertices],[p.vertices[:] for p in m.polygons])
B=lambda x,y,z:Vector((x,-z,y))
def ring(c,a,rmax=0.03):
    e1=Vector((0,0,1))-a*a.z
    if e1.length<0.2:e1=Vector((0,1,0))-a*a.y
    e1.normalize();e2=a.cross(e1);P=[]
    for k in range(24):
        th=2*math.pi*k/24;dv=e1*math.cos(th)+e2*math.sin(th)
        h=bvh.ray_cast(c,dv,rmax)
        if h[0] is None:return None
        P.append(((h[0]-c).dot(e1),(h[0]-c).dot(e2)))
    P=np.array(P);A=np.c_[2*P[:,0],2*P[:,1],np.ones(24)];bb=(P**2).sum(1)
    sol=np.linalg.lstsq(A,bb,rcond=None)[0];cx,cy=sol[0],sol[1];r=math.sqrt(max(sol[2]+cx*cx+cy*cy,0))
    res=np.abs(np.hypot(P[:,0]-cx,P[:,1]-cy)-r).max()
    return (c+e1*cx+e2*cy,r,res)
def span(c,a):
    """walk along the axis both ways while rings stay consistent"""
    r0=ring(c,a)
    if r0 is None or r0[2]>0.002:return None
    c0,r,_=r0;ts=[];cs=[c0]
    for sgn in (1,-1):
        t=0;last=c0
        while t<0.20:
            t+=0.005;q=ring(c0+a*(sgn*t),a)
            if q is None or q[2]>0.0025 or abs(q[1]-r)>0.002:break
            ts.append(sgn*t);cs.append(q[0])
    if not ts:return None
    return c0,r,min(ts),max(ts),np.array([ (x.x,x.y,x.z) for x in cs])
for s in seeds:
    c=B(*s[:3]);a0=B(*s[3:]).normalized()
    best=None
    for d1 in range(-18,19,3):
        for d2 in range(-18,19,3):
            R=Matrix.Rotation(math.radians(d1),3,'Z')@Matrix.Rotation(math.radians(d2),3,'X')
            a=(R@a0).normalized();q=span(c,a)
            if q and (best is None or q[3]-q[2]>best[0]):best=(q[3]-q[2],q,a)
    if not best:print('seed',s,'no grip');continue
    ln,(c0,r,t0,t1,cs),a=best
    # least-squares axis through the ring centres
    cm=cs.mean(0);u,sv,vt=np.linalg.svd(cs-cm);ax=vt[0];ax=ax if ax.dot(np.array(a[:]))>0 else -ax
    cent=cm
    E=c0+Vector(ax)*t1
    Hc=E-Vector(ax)*0.05
    print('   outer end(gltf)',np.round([E.x,E.z,-E.y],4),' hand centre(gltf)',np.round([Hc.x,Hc.z,-Hc.y],4))
    g=lambda v:np.round([v[0],v[2],-v[1]],4)
    print(f'seed {s[:3]}: grip length {ln*100:.1f} cm, radius {r*1000:.1f} mm, centre(gltf) {g(cent)}, axis(gltf) {g(ax)}, from {t0*100:+.1f} to {t1*100:+.1f} cm of the seed')
