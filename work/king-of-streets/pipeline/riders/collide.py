import bpy,numpy as np,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
f=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
rider=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('rider')][0]
bike=[o for o in bpy.data.objects if o.type=='MESH' and o is not rider]
vs=[];ps=[]
for o in bike:
    m=o.to_mesh();m.transform(o.matrix_world);off=len(vs)
    vs+= [v.co.copy() for v in m.vertices];ps+=[tuple(off+i for i in p.vertices) for p in m.polygons]
bvh=BVHTree.FromPolygons(vs,ps)
rm=rider.matrix_world
worst=[];deep=0;tot=0
for i,v in enumerate(rider.data.vertices):
    p=rm@v.co
    loc,nor,idx,dist=bvh.find_nearest(p,0.05)
    if loc is None:continue
    tot+=1
    side=(p-loc).dot(nor)
    if side<0 and dist>0.002:
        deep+=1;worst.append((dist,np.array([p.x,p.z,-p.y]).round(3)))
worst.sort(key=lambda x:-x[0])
print('rider verts within 5 cm of the bike:',tot,' inside the bike by >2 mm:',deep)
for d,p in worst[:8]:print('  depth',round(d*1000,1),'mm at (bike x,y,z)',p)
