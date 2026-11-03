import bpy,numpy as np,sys
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
best=None
for v in rider.data.vertices:
    p=rm@v.co
    if abs(p.x)>0.10 or not(0.55<p.z<1.15) or not(-0.60<-p.y<0.15):continue
    h=bvh.ray_cast(p+Vector((0,0,0.002)),Vector((0,0,-1)),0.4)
    if h[0] is None:continue
    g=p.z-h[0].z
    if best is None or g<best[0]:best=(g,p)
g,p=best
print('closest rider point over the seat: %.1f mm above the seat at (x %.3f, z %.3f)'%(g*1000,p.x,-p.y))
