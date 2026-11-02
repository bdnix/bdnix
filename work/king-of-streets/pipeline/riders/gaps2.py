import bpy,numpy as np,sys,math,os,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
f=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
rider=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('rider')][0]
m=rider.to_mesh();m.transform(rider.matrix_world)
bvh=BVHTree.FromPolygons([v.co[:] for v in m.vertices],[p.vertices[:] for p in m.polygons])
B=lambda x,y,z:Vector((x,-z,y))
CFG=json.load(open('/tmp/claude-0/work/bikes.json'))[os.environ['BIKE']]
GR=CFG['grip']['r'];_c=CFG['grip']['c'];_a=CFG['grip']['a']
cfg={'left hand':(B(*_c),B(*_a).normalized(),1),'right hand':(B(-_c[0],_c[1],_c[2]),B(-_a[0],_a[1],_a[2]).normalized(),-1)}
for nm,(c,a,sg) in cfg.items():
    e1=(Vector((0,0,1))-a*a.z).normalized();e2=(a.cross(e1)*sg).normalized()
    ts=[]
    for v in m.vertices:
        d=v.co-c;t=d.dot(a);r=(d-a*t).length
        if abs(t)<0.06 and GR<r<GR+0.02:ts.append(t)
    t0,t1=np.percentile(ts,3),np.percentile(ts,97)
    slices=[];
    for t in np.arange(t0,t1,0.004):
        hits=[]
        for ang in range(0,150,6):
            th=math.radians(ang);dv=e1*math.cos(th)+e2*math.sin(th)
            h=bvh.ray_cast(c+a*t+dv*(GR+0.0005),dv,0.012);hits.append(h[0] is not None)
        slices.append(hits)
    # axial gaps: slices with no hit in the first 60 degrees, lying between slices that do have hits
    cov=[any(s[:10]) for s in slices]
    first=cov.index(True) if True in cov else 0;last=len(cov)-1-cov[::-1].index(True) if True in cov else 0
    axial=[i for i in range(first,last+1) if not cov[i]]
    # holes inside the wrapped arc: uncovered rays at angles below the slice's last hit, among covered slices
    holes=0;tot=0
    for i in range(first,last+1):
        s=slices[i]
        if True in s:
            lm=len(s)-1-s[::-1].index(True)
            tot+=lm+1;holes+=sum(1 for x in s[:lm+1] if not x)
    # width of the longest axial gap in mm
    run=0;best=0
    for i in range(first,last+1):
        if not cov[i]:run+=1;best=max(best,run)
        else:run=0
    print(f'{nm}: hand spans {(t1-t0)*100:.1f} cm of the grip; slices with no hand over the first 60 deg between fingers: {len(axial)} of {last-first+1} (longest {best*4} mm); uncovered rays inside the wrapped arc: {100*holes/max(tot,1):.1f}%')
