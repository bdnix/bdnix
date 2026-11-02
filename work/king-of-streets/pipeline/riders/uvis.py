import bpy,numpy as np,sys,bmesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
d=sys.argv[-2];sc=float(sys.argv[-1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/src/x/{d}/scene.gltf')
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
mesh=[o for o in bpy.data.objects if o.type=='MESH' and len(o.vertex_groups)>0][0]
arm.parent=None;arm.scale=(sc,)*3;bpy.context.view_layer.update()
me=mesh.data;uv=me.uv_layers.active.data
# islands: faces connected through edges whose two sides share the same UV coords
nf=len(me.polygons)
edge_faces={}
for p in me.polygons:
    for i,(a,b) in enumerate(zip(p.vertices,list(p.vertices[1:])+[p.vertices[0]])):
        k=(min(a,b),max(a,b))
        uva=tuple(np.round(uv[p.loop_start+i].uv,4));uvb=tuple(np.round(uv[p.loop_start+(i+1)%len(p.vertices)].uv,4))
        edge_faces.setdefault(k,[]).append((p.index,frozenset((uva,uvb))))
rows=[];cols=[]
for k,l in edge_faces.items():
    for i in range(len(l)):
        for j in range(i+1,len(l)):
            if l[i][1]==l[j][1]:rows.append(l[i][0]);cols.append(l[j][0])
A=coo_matrix((np.ones(len(rows)),(rows,cols)),shape=(nf,nf))
k,lab=connected_components(A,directed=False)
V=np.array([(mesh.matrix_world@v.co)[:] for v in me.vertices])
print('islands',k)
for c in range(k):
    fs=[p for p in me.polygons if lab[p.index]==c]
    if len(fs)<30:continue
    vi=sorted({v for p in fs for v in p.vertices});pts=V[vi]
    uvs=np.array([uv[l].uv for p in fs for l in range(p.loop_start,p.loop_start+p.loop_total)])
    print(f'island {c}: faces {len(fs)} z[{pts[:,2].min():.2f},{pts[:,2].max():.2f}] x[{pts[:,0].min():.2f},{pts[:,0].max():.2f}] y[{pts[:,1].min():.2f},{pts[:,1].max():.2f}] uv[{uvs[:,0].min():.2f},{uvs[:,0].max():.2f}]x[{uvs[:,1].min():.2f},{uvs[:,1].max():.2f}]')
np.save('/tmp/claude-0/work/uvlab_%s.npy'%d,lab)
