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
rows={}
for v in rider.data.vertices:
    p=rm@v.co
    if abs(p.x)>0.16 or not(0.5<p.z<1.2):continue
    h=bvh.ray_cast(p+Vector((0,0,0.004)),Vector((0,0,-1)),0.5)
    if h[0] is None:continue
    g=(p.z-h[0].z)*1000
    k=round((-p.y)/0.02)
    if k not in rows or g<rows[k][0]:rows[k]=(g,p.z)
print('forward z (m) : lowest gap of rider underside to the thing below (mm)   [seat profile]')
out=[]
for k in sorted(rows):
    out.append('%+.2f:%5.0f'%(k*0.02,rows[k][0]))
print('  '.join(out))
# contact patch: forward extent where the underside is within 6 mm of the surface below
ks=[k*0.02 for k in sorted(rows) if rows[k][0]<=6]
print('contact patch (gap<=6mm): %s'%('none' if not ks else '%.2f to %.2f m forward, %.0f cm long'%(min(ks),max(ks),(max(ks)-min(ks))*100+2)))
ks=[k*0.02 for k in sorted(rows) if rows[k][0]<=20]
print('near patch (gap<=20mm): %s'%('none' if not ks else '%.0f cm long'%((max(ks)-min(ks))*100+2)))
