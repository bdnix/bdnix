import bpy,numpy as np,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
f=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
rider=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('rider')][0]
bike=[o for o in bpy.data.objects if o.type=='MESH' and o is not rider and not o.name.startswith('helmet')]
vs=[];ps=[]
for o in bike:
    m=o.to_mesh();m.transform(o.matrix_world);off=len(vs);vs+=[v.co.copy() for v in m.vertices];ps+=[tuple(off+i for i in p.vertices) for p in m.polygons]
bvh=BVHTree.FromPolygons(vs,ps)
def par(p,d):
    n=0;o=p.copy()
    for _ in range(12):
        h=bvh.ray_cast(o,d)
        if h[0] is None:break
        n+=1;o=h[0]+d*1e-4
    return n%2
rm=rider.matrix_world
deep=[];tot=0
dirs=[Vector((0,0,1)),Vector((1,0,0)),Vector((-1,0,0)),Vector((0,1,0))]
for v in rider.data.vertices:
    p=rm@v.co
    loc,nor,idx,dist=bvh.find_nearest(p,0.03)
    if loc is None:continue
    tot+=1
    votes=sum(par(p,d) for d in dirs)
    if votes>=3 and dist>0.002:deep.append((dist,p))
deep.sort(key=lambda t:-t[0])
print('rider verts within 3 cm of the bike:',tot,'; inside the bike volume (3 of 4 ray votes) by >2 mm:',len(deep))
for d,p in deep[:5]:print('  depth %.1f mm at bike (x,y,z)=(%.3f,%.3f,%.3f)'%(d*1000,p.x,p.z,-p.y))
