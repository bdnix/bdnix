import bpy,numpy as np
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/tmp/claude-0/work/src/x/claudia/scene.gltf')
arm=bpy.data.objects['Object_4'];mesh=bpy.data.objects['Object_6'];arm.parent=None;arm.scale=(0.0095,)*3
bpy.context.view_layer.update()
M=mesh.matrix_world
V=np.array([(M@v.co)[:] for v in mesh.data.vertices])
vg={g.name:g.index for g in mesh.vertex_groups}
def H(n):return np.array((arm.matrix_world@arm.data.bones[n].head_local)[:])
names=[b.name for b in arm.data.bones]
hand=[n for n in names if n.startswith('hand_l')][0]
mid=[n for n in names if n.startswith('middle_01_l')][0]
idx=[n for n in names if n.startswith('index_01_l')][0];pk=[n for n in names if n.startswith('pinky_01_l')][0]
hv=[i for i,v in enumerate(mesh.data.vertices) if any(g.group==vg[hand] and g.weight>0.5 for g in v.groups)]
fing=[i for i,v in enumerate(mesh.data.vertices) if any(mesh.vertex_groups[g.group].name.endswith('_l_'+x) or ('_l_0' in mesh.vertex_groups[g.group].name and mesh.vertex_groups[g.group].name.split('_')[0] in('index','middle','ring','pinky','thumb')) for g in v.groups for x in [''] ) and any(g.weight>0.5 for g in v.groups)]
allv=V[hv+fing]
w=H(hand);d=H(mid)-w;d/=np.linalg.norm(d)
print('wrist->middle MCP',round(np.linalg.norm(H(mid)-w)*100,1),'cm; knuckle line width index-pinky',round(np.linalg.norm(H(idx)-H(pk))*100,1),'cm')
print('hand+finger mesh extent along finger direction from wrist: max',round(((allv-w)@d).max()*100,1),'cm  (real adult woman hand length ~17-18 cm, man ~19-20)')
print('body height m',round((V[:,2].max()-V[:,2].min()),3))
