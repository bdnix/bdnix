import bpy,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
f=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
rider=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('rider')][0]
bike=[o for o in bpy.data.objects if o.type=='MESH' and o is not rider and not o.name.startswith(('helmet','Body_LP'))]
vs=[];ps=[]
for o in bike:
    m=o.to_mesh();m.transform(o.matrix_world);off=len(vs);vs+=[v.co.copy() for v in m.vertices];ps+=[tuple(off+i for i in p.vertices) for p in m.polygons]
bvh=BVHTree.FromPolygons(vs,ps)
rm=rider.matrix_world
pts=[rm@v.co for v in rider.data.vertices]
def top(x,y):
    h=bvh.ray_cast(Vector((x,y,1.3)),Vector((0,0,-1)),1.0);return None if h[0] is None else h[0].z
print('fwd(m)  seat top at x=0 | rider underside minus seat top, by lateral band (mm): centre | 6cm | 12cm   (>0 = air, <0 = into seat)')
for k in range(-24,4):
    zf=k*0.02;row=[]
    for lo,hi in ((0,0.03),(0.045,0.075),(0.105,0.135)):
        c=[p for p in pts if lo<=abs(p.x)<hi and abs(-p.y-zf)<0.01 and 0.6<p.z<1.15]
        if not c:row.append('   -');continue
        p=min(c,key=lambda p:p.z);t=top(p.x,p.y)
        row.append('   -' if t is None else '%+4.0f'%((p.z-t)*1000))
    t0=top(0,-zf)
    print('%+.2f  %s | %s'%(zf,'  -  ' if t0 is None else '%.3f'%t0,' | '.join(row)))
