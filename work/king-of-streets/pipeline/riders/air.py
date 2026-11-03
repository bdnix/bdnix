import bpy,sys,statistics
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
rm=rider.matrix_world;n3=rm.to_3x3()
rider.data.calc_loop_triangles()
cand=[]
for v in rider.data.vertices:
    p=rm@v.co;n=(n3@v.normal)
    if abs(p.x)>0.2 or not(0.5<p.z<1.2):continue
    h=bvh.ray_cast(Vector((p.x,p.y,p.z+0.004)),Vector((0,0,-1)),0.5)
    if h[0] is None:continue
    g=p.z-h[0].z
    if g>0.15 or g<-0.04:continue
    cand.append((-p.y,g,n.z,p.x))
if not cand:print('AIR none');sys.exit()
fmin=min(c[0] for c in cand if c[1]<0.06)
S=[c for c in cand if fmin<=c[0]<=fmin+0.30 and c[2]<-0.2]
gs=[c[1]*1000 for c in S]
share=100*sum(1 for g in gs if g<=8)/len(gs)
print('AIR sit zone from %.2f to %.2f m forward: %d underside points, %.0f%% within 8 mm of the seat, median gap %.0f mm, 90th percentile %.0f mm'%(fmin,fmin+0.30,len(gs),share,statistics.median(gs),sorted(gs)[int(0.9*len(gs))]))
