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
    m=o.to_mesh();m.transform(o.matrix_world);off=len(vs);vs+=[v.co.copy() for v in m.vertices];ps+=[tuple(off+i for i in p.vertices) for p in m.polygons]
bvh=BVHTree.FromPolygons(vs,ps)
rm=rider.matrix_world
P=np.array([(rm@v.co)[:] for v in rider.data.vertices])    # blender coords
for side,sx in (('left foot (x>0)',1),('right foot (x<0)',-1)):
    sel=np.where((P[:,0]*sx>0.08)&(P[:,0]*sx<0.32)&(P[:,2]<0.42)&(P[:,1]>-0.4)&(P[:,1]<0.4))[0]
    sole=sel[np.argsort(P[sel,2])[:60]]
    gaps=[];pen=[]
    for i in sole:
        p=Vector(P[i])
        h=bvh.ray_cast(p+Vector((0,0,0.15)),Vector((0,0,-1)),0.5)   # first surface hit from above
        if h[0] is None:gaps.append(None);continue
        d=p.z-h[0].z     # positive: vertex above the surface
        gaps.append(d)
    g=[x for x in gaps if x is not None]
    near=[x for x in g if abs(x)<0.03]
    print(side,': lowest foot verts',len(sole),'; with a bike surface under them',len(g))
    if g:
        print('  min vertical gap %.1f mm (negative = inside); verts within 3 cm: %d, inside by >2 mm: %d, touching (|gap|<3 mm): %d'%(min(g)*1000,len(near),sum(1 for x in g if x<-0.002),sum(1 for x in g if abs(x)<0.003)))
    low=P[sole];print('  sole lowest point at bike (x,y,z) = (%.3f, %.3f, %.3f)'%(low[0,0],low[0,2],-low[0,1]),' peg top is y 0.333 near z -0.105')
