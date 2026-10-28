# bpy: import a source bike, drop unwanted parts, normalise (m, front +Z, ground z=0), split wheels, decimate, shrink textures, export GLB
import bpy,bmesh,sys,math,re,json
from mathutils import Vector,Matrix
args=sys.argv[sys.argv.index('--')+1:]
cfg=json.loads(args[0])
name=cfg['name']; src=cfg.get('src',f'src/{name}')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'{src}/scene.gltf')
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in meshes:
    mw=o.matrix_world.copy(); o.parent=None; o.matrix_world=mw
    o.data.transform(mw); o.matrix_world=Matrix.Identity(4)
for o in list(bpy.data.objects):
    if o.type!='MESH': bpy.data.objects.remove(o)
for pat in cfg.get('drop',[]):
    for o in [o for o in meshes if re.search(pat,o.name)]:
        bpy.data.objects.remove(o); 
meshes=[o for o in bpy.data.objects if o.type=='MESH']
def bounds(objs):
    mn=Vector((1e9,)*3);mx=Vector((-1e9,)*3)
    for o in objs:
        for v in o.data.vertices:
            mn=Vector(map(min,mn,v.co)); mx=Vector(map(max,mx,v.co))
    return mn,mx
# decal quads that only carried a logo: delete faces whose UVs all lie in a given UV box (u0,u1,v0,v1; v from the top)
for box in cfg.get('kill_uv',[]):
    u0,u1,v0,v1=box
    for o in [o for o in meshes if re.search(cfg.get('kill_obj','.'),o.name)]:
        bm=bmesh.new(); bm.from_mesh(o.data); uv=bm.loops.layers.uv.active
        if uv is None: bm.free(); continue
        dead=[f for f in bm.faces if all(u0<=l[uv].uv.x<=u1 and u0<=l[uv].uv.x and (1-v1)<=l[uv].uv.y<=(1-v0) for l in f.loops)]
        if dead:
            bmesh.ops.delete(bm,geom=dead,context='FACES'); print('KILLED',len(dead),'faces in',o.name)
        bm.to_mesh(o.data); bm.free()
R=Matrix.Rotation(math.radians(cfg.get('rotz',0)),4,'Z')
for o in meshes: o.data.transform(R)
mn,mx=bounds(meshes); s=cfg['length']/(mx.y-mn.y)
for o in meshes: o.data.transform(Matrix.Scale(s,4))
mn,mx=bounds(meshes)
for o in meshes: o.data.transform(Matrix.Translation(Vector((-(mn.x+mx.x)/2,-(mn.y+mx.y)/2,-mn.z))))
# join everything into one object, then split loose parts
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
body=bpy.context.view_layer.objects.active
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
parts=[o for o in bpy.data.objects if o.type=='MESH']
info=[]
for o in parts:
    mn,mx=bounds([o]); info.append((o,mn,mx))
# tyres: roughly round in the side view, narrow, touching the ground
cands=[]
for o,mn,mx in info:
    dx,dy,dz=mx.x-mn.x,mx.y-mn.y,mx.z-mn.z
    if mn.z<0.12 and dx<0.32 and dz>0.35 and abs(dy-dz)/dz<0.25: cands.append((round(dz,2)*1000+dz*dy*dx,o,mn,mx))
cands.sort(key=lambda c:-c[0])
wheels={}
for _,o,mn,mx in cands:
    key='f' if (mn.y+mx.y)/2<0 else 'r'     # Blender -Y is the front
    if key not in wheels: wheels[key]=(o,(mn+mx)/2,(mx.z-mn.z)/2)
if len(wheels)!=2:
    for o,mn,mx in info:
        if mn.z<0.2 and mx.z-mn.z>0.3: print('DBG',o.name,[round(x,2) for x in mn],[round(x,2) for x in mx],len(o.data.polygons))
if cfg.get('debug'):
    for o,mn,mx in sorted(info,key=lambda t:-(t[2].z-t[1].z)*(t[2].y-t[1].y))[:14]:
        print('BIG',o.name,[round(x,2) for x in mn],[round(x,2) for x in mx],len(o.data.polygons))
if cfg.get('listsmall'):
    for o,mn,mx in info:
        if mx.z>0.8 and mx.z-mn.z<0.12 and mx.y-mn.y<0.15 and len(o.data.polygons)<600:
            print('SMALL',o.name,[round(x,2) for x in mn],[round(x,2) for x in mx],len(o.data.polygons),[m.name for m in o.data.materials])
assert len(wheels)==2,('wheels',wheels.keys())
# a tyre loose part can be fused with its mudguard: keep only the faces inside the wheel's circle
for k,(to,c,r) in list(wheels.items()):
    bm=bmesh.new(); bm.from_mesh(to.data)
    out=[f for f in bm.faces if max(math.hypot(v.co.y-c.y,v.co.z-c.z) for v in f.verts)>r*1.012]
    if out and len(out)<len(bm.faces):
        keep=bm.copy()
        bmesh.ops.delete(bm,geom=out,context='FACES')
        bm.to_mesh(to.data); to.data.update()
        extra=bpy.data.meshes.new('extra'); keep2=keep
        for mt in to.data.materials: extra.materials.append(mt)
        inn=[f for f in keep2.faces if max(math.hypot(v.co.y-c.y,v.co.z-c.z) for v in f.verts)<=r*1.012]
        bmesh.ops.delete(keep2,geom=inn,context='FACES')
        keep2.to_mesh(extra); eo=bpy.data.objects.new('extra_'+k,extra); bpy.context.collection.objects.link(eo)
        keep2.free()
        info.append((eo,)+tuple(bounds([eo])))
        for i,(o2,a,b) in enumerate(info):
            if o2 is to: info[i]=(to,)+tuple(bounds([to]))
        wheels[k]=(to,wheels[k][1],wheels[k][2])
    bm.free()
groups={'f':[], 'r':[], 'b':[]}
for o,mn,mx in info:
    hit=None
    for k,(to,c,r) in wheels.items():
        if o is to: hit=k;break
        if abs((mn.x+mx.x)/2-c.x)<0.13 and mx.x-mn.x<0.3 and mn.y>=c.y-r*1.02 and mx.y<=c.y+r*1.02 and mn.z>=c.z-r*1.02 and mx.z<=c.z+r*1.02:
            rad=max(math.hypot(v.co.y-c.y,v.co.z-c.z) for v in o.data.vertices)
            if rad<=r*1.01: hit=k;break
    groups[hit or 'b'].append(o)
print('PARTS',{k:len(v) for k,v in groups.items()},'wheel radius',{k:round(v[2],3) for k,v in wheels.items()})
def join(objs,nm):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    if len(objs)>1: bpy.ops.object.join()
    j=bpy.context.view_layer.objects.active; j.name=nm; j.data.name=nm; return j
objs={'b':join(groups['b'],'body'),'f':join(groups['f'],'wheel_f'),'r':join(groups['r'],'wheel_r')}
# wheel origins at the hub
for k in 'fr':
    c=wheels[k][1]; o=objs[k]
    o.data.transform(Matrix.Translation(-c)); o.location=c
def tris(o): return sum(len(p.vertices)-2 for p in o.data.polygons)
tgt=cfg['tris']
tot=sum(tris(o) for o in objs.values())
before=tot
if tot>tgt:
    # wheels get their share by size; body the rest
    wt=sum(tris(objs[k]) for k in 'fr') if cfg.get('keep_wheels') else 0
    for k,o in objs.items():
        t=tris(o); want=max(300,int(t*tgt/tot))
        if cfg.get('keep_wheels'): want=t if k!='b' else tgt-wt
        
        ratio=min(1,want/t)
        if ratio<1:
            m=o.modifiers.new('d','DECIMATE'); m.decimate_type='COLLAPSE'; m.ratio=ratio; m.use_collapse_triangulate=True
            bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
for o in objs.values():
    bpy.context.view_layer.objects.active=o
    for p in o.data.polygons: p.use_smooth=True
print('TRIS',before,'->',sum(tris(o) for o in objs.values()),{k:tris(o) for k,o in objs.items()})
# shrink textures
mx_px=cfg.get('tex',2048)
for im in bpy.data.images:
    if im.size[0]>mx_px or im.size[1]>mx_px:
        im.scale(min(im.size[0],mx_px),min(im.size[1],mx_px))
bpy.ops.export_scene.gltf(filepath=cfg['out'],export_format='GLB',export_apply=True,export_image_format='WEBP',export_image_quality=88)
print('MATERIALS',len(bpy.data.materials))
