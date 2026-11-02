import bpy,numpy as np,sys,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
f=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
rider=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('rider')][0]
m=rider.to_mesh();m.transform(rider.matrix_world)
bvh=BVHTree.FromPolygons([v.co[:] for v in m.vertices],[p.vertices[:] for p in m.polygons])
B=lambda x,y,z:Vector((x,-z,y))
import json,os
CFG=json.load(open('/tmp/claude-0/work/bikes.json'))[os.environ['BIKE']]
GR=CFG['grip']['r']
_c=CFG['grip']['c'];_a=CFG['grip']['a'];cfg={'x+':(B(*_c),B(*_a).normalized()),'x-':(B(-_c[0],_c[1],_c[2]),B(-_a[0],_a[1],_a[2]).normalized())}
for nm,(c,a) in cfg.items():
    e1=(Vector((0,0,1))-a*a.z).normalized();e2=(a.cross(e1)*(1 if nm=='x+' else -1)).normalized()
    # which axial range do the fingers occupy? use rider verts near the grip surface
    ts=[];
    for v in m.vertices:
        d=v.co-c;t=d.dot(a);r=(d-a*t).length
        if abs(t)<0.06 and GR<r<GR+0.02:ts.append(t)
    t0,t1=np.percentile(ts,3),np.percentile(ts,97)
    print('==',nm,'finger/hand span along grip: %.1f..%.1f cm'%(t0*100,t1*100))
    for lo,hi,label in ((0,120,'top to front (0-120 deg)'),(0,360,'all round')):
        tot=0;gap=0;worst=0
        for t in np.arange(t0,t1,0.004):
            for ang in range(lo,hi,6):
                th=math.radians(ang);dv=e1*math.cos(th)+e2*math.sin(th)
                o=c+a*t+dv*(GR+0.0005)
                h=bvh.ray_cast(o,dv,0.012)
                tot+=1
                if h[0] is None:gap+=1
        print(f'  {label}: rays with no hand within 12 mm of the grip surface: {gap}/{tot} = {100*gap/tot:.1f}%')
    # gap map along grip (top-front 0..150deg), by axial cm
    row=[]
    for t in np.arange(t0,t1,0.01):
        g=0;n=0
        for ang in range(0,120,6):
            th=math.radians(ang);dv=e1*math.cos(th)+e2*math.sin(th)
            h=bvh.ray_cast(c+a*t+dv*(GR+0.0005),dv,0.012);n+=1;g+=h[0] is None
        row.append(f'{100*g/n:.0f}%')
    print('  uncovered share per 1 cm slice (top-front):',' '.join(row))
