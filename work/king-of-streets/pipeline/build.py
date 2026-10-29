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
    for o in [o for o in bpy.data.objects if o.type=='MESH' and re.search(pat,o.name)]:
        bpy.data.objects.remove(o)
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
# join everything into one mesh, then decide per face what turns with a wheel
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
whole=bpy.context.view_layer.objects.active
me=whole.data
bm=bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
NF=len(bm.faces)
def comps(face_ids):
    """connected pieces among the given faces, joined by shared positions (the importer splits vertices at seams)"""
    par={}
    def find(a):
        while par[a]!=a: par[a]=par[par[a]]; a=par[a]
        return a
    first={}
    for fi in face_ids: par[fi]=fi
    for fi in face_ids:
        for v in bm.faces[fi].verts:
            key=(round(v.co.x*2e4),round(v.co.y*2e4),round(v.co.z*2e4))
            if key in first:
                a,b=find(first[key]),find(fi)
                if a!=b: par[a]=b
            else: first[key]=fi
    out={}
    for fi in face_ids: out.setdefault(find(fi),[]).append(fi)
    return list(out.values())
allf=list(range(NF))
# hubs: the roundest large pieces that touch the ground, front (-Y) and rear (+Y)
hub=cfg.get('hubs')
if not hub:
    cl=[]
    for c in comps(allf):
        vs=[v.co for fi in c for v in bm.faces[fi].verts]
        mn=Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs))); mx=Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
        dx,dy,dz=mx.x-mn.x,mx.y-mn.y,mx.z-mn.z
        if mn.z<0.06 and dx<0.34 and dz>0.35 and abs(dy-dz)/dz<0.15: cl.append((dz,mn,mx))
    cl.sort(key=lambda t:-t[0]); hub={}
    for dz,mn,mx in cl:
        k='f' if (mn.y+mx.y)/2<0 else 'r'
        if k not in hub: hub[k]=[(mn.y+mx.y)/2,(mn.z+mx.z)/2,dz/2,(mn.x+mx.x)/2,(mx.x-mn.x)/2]
assert len(hub)==2,('hubs',hub)
if cfg.get('list_mat'):
    for c in sorted(comps(allf),key=len,reverse=True):
        mats=sorted({me.materials[bm.faces[fi].material_index].name for fi in c})
        if cfg['list_mat'] in mats:
            vs=[v.co for fi in c for v in bm.faces[fi].verts]
            mn=Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs))); mx=Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
            print('MATC',len(c),[round(x,2) for x in mn],[round(x,2) for x in mx],mats)
if cfg.get('list_all'):
    for c in sorted(comps(allf),key=len,reverse=True)[:40]:
        vs=[v.co for fi in c for v in bm.faces[fi].verts]
        mn=Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs))); mx=Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
        print('COMP',len(c),[round(x,2) for x in mn],[round(x,2) for x in mx],sorted({me.materials[bm.faces[fi].material_index].name for fi in c}))
for cut in cfg.get('cut',[]):
    mi=[i for i,m in enumerate(me.materials) if (not cut.get('mat')) or m.name==cut['mat']]
    b=cut['box']   # x0,x1,y0,y1,z0,z1
    dead=[f for f in bm.faces if f.material_index in mi and all(b[0]<=v.co.x<=b[1] and b[2]<=v.co.y<=b[3] and b[4]<=v.co.z<=b[5] for v in f.verts)]
    if cut.get('thin'):
        ids=[f.index for f in dead]; dead=[]
        for c in comps(ids):
            vs=[v.co for fi in c for v in bm.faces[fi].verts]
            d=sorted([max(v[i] for v in vs)-min(v[i] for v in vs) for i in range(3)])
            print('  cut-comp',len(c),[round(x,3) for x in d])
            if d[1]<cut['thin'] and d[2]>cut.get('minlen',0.05) or (cut.get('flat') and d[0]<cut['flat'] and d[2]>cut.get('flatlen',0.25)): dead+=[bm.faces[fi] for fi in c]
    bmesh.ops.delete(bm,geom=dead,context='FACES'); print('CUT',cut.get('why',''),len(dead),'faces')
    bm.faces.ensure_lookup_table(); allf=list(range(len(bm.faces))); NF=len(allf)
for nd in cfg.get('needles',[]):
    b=nd['box']; found=[]
    for f in bm.faces:
        if not all(b[0]<=v.co.x<=b[1] and b[2]<=v.co.y<=b[3] and b[4]<=v.co.z<=b[5] for v in f.verts): continue
        if nd.get('mats') and me.materials[f.material_index].name not in nd['mats']: continue
        es=[e.calc_length() for e in f.edges]
        if max(es)>nd.get('minlen',0.04) and f.calc_area()<nd.get('maxarea',2e-4) and max(es)**2/max(f.calc_area(),1e-9)>nd.get('aspect',40): found.append(f)
    print('NEEDLES',nd.get('why',''),len(found),'faces',sorted({me.materials[f.material_index].name for f in found}))
    if nd.get('delete'):
        bmesh.ops.delete(bm,geom=found,context='FACES'); bm.faces.ensure_lookup_table(); allf=list(range(len(bm.faces))); NF=len(allf)
for ow in cfg.get('orange_wires',[]):
    # thin needle faces whose texture colour is orange (cables), in a box; sampled from the material's colour image
    b=ow['box']; uv=bm.loops.layers.uv.active; imgs={}
    for m in me.materials:
        nodes=[n for n in m.node_tree.nodes if n.type=='TEX_IMAGE']
        bc=m.node_tree.nodes.get('Principled BSDF').inputs['Base Color']
        if bc.is_linked and bc.links[0].from_node.type=='TEX_IMAGE': 
            im=bc.links[0].from_node.image; imgs[m.name]=(im.size[0],im.size[1],list(im.pixels))
    found=[]
    for f in bm.faces:
        if not all(b[0]<=v.co.x<=b[1] and b[2]<=v.co.y<=b[3] and b[4]<=v.co.z<=b[5] for v in f.verts): continue
        nm=me.materials[f.material_index].name
        if nm not in imgs: continue
        hc=ow.get('hub')
        if hc:
            cx=sum(v.co.x for v in f.verts)/3; cy=sum(v.co.y for v in f.verts)/3; cz=sum(v.co.z for v in f.verts)/3
            rr=math.hypot(cy-hc[0],cz-hc[1])
            if rr<=hc[2] and abs(cx)<hc[3]: continue          # the rim and tyre
            if rr<=hc[2]*1.15 and abs(cx)<hc[4] and cz>hc[1]+0.1: continue   # the mudguard trim
        es=[e.calc_length() for e in f.edges]
        if max(es)<ow.get('minlen',0.015) or max(es)**2/max(f.calc_area(),1e-9)<ow.get('aspect',10): continue
        w,h,px=imgs[nm]
        cu=sum(l[uv].uv.x for l in f.loops)/3; cv=sum(l[uv].uv.y for l in f.loops)/3
        i=(int(cv*h)%h*w+int(cu*w)%w)*4
        r,g,bl=px[i],px[i+1],px[i+2]
        if r>0.7 and 0.3<g<0.8 and bl<0.25: found.append(f)
    print('ORANGE',len(found),sorted({me.materials[f.material_index].name for f in found}))
    if ow.get('delete'):
        bmesh.ops.delete(bm,geom=found,context='FACES'); bm.faces.ensure_lookup_table(); allf=list(range(len(bm.faces))); NF=len(allf)
if cfg.get('wire_mat'):
    mi=[i for i,m in enumerate(me.materials) if m.name==cfg['wire_mat']]
    ids=[fi for fi in allf if bm.faces[fi].material_index in mi]
    for c in comps(ids):
        vs=[v.co for fi in c for v in bm.faces[fi].verts]
        d=sorted([max(v[i] for v in vs)-min(v[i] for v in vs) for i in range(3)])
        print('WIRE?',len(c),[round(x,3) for x in d])
        if d[2]>cfg.get('wire_len',0.06) and d[1]<cfg.get('wire_thick',0.02):
            bmesh.ops.delete(bm,geom=[bm.faces[fi] for fi in c],context='FACES'); print('DELETED wire',len(c))
    bm.faces.ensure_lookup_table(); allf=list(range(len(bm.faces))); NF=len(allf)
if cfg.get('list_wires'):
    for c in comps(allf):
        vs=[v.co for fi in c for v in bm.faces[fi].verts]
        mn=Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs))); mx=Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
        d=sorted(mx-mn)
        if d[2]>0.08 and d[1]<0.03 and len(c)>=6:
            print('WIRE',len(c),[round(x,3) for x in mn],[round(x,3) for x in mx],sorted({me.materials[bm.faces[fi].material_index].name for fi in c}))
if cfg.get('list_thin'):
    for c in comps(allf):
        vs=[v.co for fi in c for v in bm.faces[fi].verts]
        mn=Vector((min(v.x for v in vs),min(v.y for v in vs),min(v.z for v in vs))); mx=Vector((max(v.x for v in vs),max(v.y for v in vs),max(v.z for v in vs)))
        d=mx-mn
        if len(c)>8 and (max(d)>0.2) and (sorted(d)[1]<0.04):
            mats=sorted({me.materials[bm.faces[fi].material_index].name for fi in c})
            print('THIN',len(c),[round(x,2) for x in mn],[round(x,2) for x in mx],mats)
print('HUBS',{k:[round(x,3) for x in v] for k,v in hub.items()})
NB=72
def sym_ok(bins):
    """True if the occupied angle bins repeat under a turn of 360/m degrees for some m>=4 (a wheel part, not a fork or a caliper)"""
    B=set(bins)
    if len(B)<4: return False
    for m in range(4,37):
        sft=NB/m; ok=0
        for b in B:
            t=(b+sft)%NB; lo=int(math.floor(t)); 
            if any(((lo+d)%NB) in B for d in (-1,0,1,2)): ok+=1
        if ok>=0.92*len(B): return True
    return False
turn={}
for k in 'fr':
    cy,cz,R,cx,hw=hub[k]; R*=cfg.get('rtol',1.012)
    ids=[fi for fi in allf if all(math.hypot(v.co.y-cy,v.co.z-cz)<=R and abs(v.co.x-cx)<=cfg.get('xmax',0.14) for v in bm.faces[fi].verts)]
    for c in comps(ids):
        bins=[]; xs=[]; rs=[]
        for fi in c:
            for v in bm.faces[fi].verts:
                bins.append(int((math.atan2(v.co.z-cz,v.co.y-cy)+math.pi)/(2*math.pi)*NB)%NB); xs.append(v.co.x); rs.append(math.hypot(v.co.y-cy,v.co.z-cz))
        xext=max(xs)-min(xs)
        allv=[v.co for fi in c for v in bm.faces[fi].verts]
        dims=sorted([max(v[i] for v in allv)-min(v[i] for v in allv) for i in range(3)])
        spoke=(xext<cfg.get('spoke_x',0.012) and len(c)<cfg.get('spoke_faces',60) and max(rs)>0.5*R and min(rs)<0.5*R and dims[0]<cfg.get('spoke_d0',1.0) and dims[1]<cfg.get('spoke_d1',1.0))
        if sym_ok(bins) or spoke:
            for fi in c:
                if me.materials[bm.faces[fi].material_index].name in cfg.get('never_turn_mats',[]): continue
                turn[fi]=k
cnt={k:sum(1 for v in turn.values() if v==k) for k in 'fr'}
print('TURNING faces',cnt,'of',NF)
def piece(sel):
    b2=bm.copy(); b2.faces.ensure_lookup_table()
    dead=[b2.faces[i] for i in range(NF) if not sel(i)]
    bmesh.ops.delete(b2,geom=dead,context='FACES')
    return b2
objs={}
for nm,k in (('body','b'),('wheel_f','f'),('wheel_r','r')):
    b2=piece(lambda i,k=k:(turn.get(i,'b')==k))
    m2=bpy.data.meshes.new(nm); b2.to_mesh(m2); b2.free()
    for mt in me.materials: m2.materials.append(mt)
    o=bpy.data.objects.new(nm,m2); bpy.context.collection.objects.link(o); objs[k]=o
bpy.data.objects.remove(whole)
for k in 'fr':
    cy,cz,R,cx,hw=hub[k]; c=Vector((cx,cy,cz)); o=objs[k]
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
        if cfg.get('keep_wheels'):
            wcap=cfg.get('wheel_tris',3500)
            want=min(t,wcap) if k!='b' else tgt-sum(min(tris(objs[j]),wcap) for j in 'fr')
        
        ratio=min(1,want/t)
        if ratio<1:
            m=o.modifiers.new('d','DECIMATE'); m.decimate_type='COLLAPSE'; m.ratio=ratio; m.use_collapse_triangulate=True
            dw=cfg.get('decim_weights') if k=='b' else None
            if dw:
                vg=o.vertex_groups.new(name='squeeze')
                mat_of_vert={}
                if cfg.get('squeeze_dim'):
                    # weight 1 for small loose pieces (bolts, engine bits), 0 for large pieces (body panels): panels keep every triangle
                    me2=o.data; par=list(range(len(me2.vertices)))
                    def fnd(a):
                        while par[a]!=a: par[a]=par[par[a]]; a=par[a]
                        return a
                    first={}
                    for vi,v in enumerate(me2.vertices):
                        key=(round(v.co.x*2e4),round(v.co.y*2e4),round(v.co.z*2e4))
                        if key in first: par[fnd(vi)]=fnd(first[key])
                        else: first[key]=vi
                    for p in me2.polygons:
                        for a in p.vertices[1:]: 
                            ra,rb=fnd(p.vertices[0]),fnd(a)
                            if ra!=rb: par[ra]=rb
                    lo={};hi={}
                    for vi,v in enumerate(me2.vertices):
                        r=fnd(vi); c=v.co
                        l=lo.setdefault(r,[1e9]*3); h=hi.setdefault(r,[-1e9]*3)
                        for i in range(3): l[i]=min(l[i],c[i]); h[i]=max(h[i],c[i])
                    big={r for r in lo if max(hi[r][i]-lo[r][i] for i in range(3))>=cfg['squeeze_dim']}
                    print('PIECES',len(lo),'large kept whole',len(big))
                    for vi in range(len(me2.vertices)):
                        mat_of_vert[vi]=0.0 if fnd(vi) in big else 1.0
                for p in ([] if cfg.get('squeeze_dim') else o.data.polygons):
                    mn_=o.data.materials[p.material_index].name
                    for vi in p.vertices: mat_of_vert[vi]=max(mat_of_vert.get(vi,0),dw.get(mn_,0.0))
                for vi,w in mat_of_vert.items():
                    if w>0: vg.add([vi],w,'REPLACE')
                m.vertex_group='squeeze'; m.invert_vertex_group=cfg.get('decim_invert',False); m.vertex_group_factor=1.0
                bpy.context.view_layer.objects.active=o
                print('BODYMATS',{mt.name:sum(1 for p in o.data.polygons if o.data.materials[p.material_index]==mt) for mt in o.data.materials})
            if cfg.get('delimit'): m.delimit=set(cfg['delimit'])
            if cfg.get('decim_sym') is not None: m.use_symmetry=cfg['decim_sym']
            bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
            for _it in range(6):
                cur=tris(o)
                if cur<=want*1.01 or not dw: break
                m=o.modifiers.new('d2','DECIMATE'); m.decimate_type='COLLAPSE'; m.ratio=want/cur; m.use_collapse_triangulate=True
                m.vertex_group='squeeze'; m.invert_vertex_group=cfg.get('decim_invert',False); m.vertex_group_factor=1.0
                bpy.ops.object.modifier_apply(modifier='d2')
            if dw: print('AFTERMATS',{mt.name:sum(1 for p in o.data.polygons if o.data.materials[p.material_index]==mt) for mt in o.data.materials})
for o in objs.values():
    bpy.context.view_layer.objects.active=o
    for p in o.data.polygons: p.use_smooth=True
print('TRIS',before,'->',sum(tris(o) for o in objs.values()),{k:tris(o) for k,o in objs.items()})
for nm,val in cfg.get('mat_base',{}).items():
    for m in bpy.data.materials:
        if m.name==nm:
            nd=m.node_tree.nodes.get('Principled BSDF'); nd.inputs['Base Color'].default_value=(val[0],val[1],val[2],1)
if cfg.get('drop_emissive'):
    for m in bpy.data.materials:
        nd=m.node_tree.nodes.get('Principled BSDF')
        if nd:
            for nm in ('Emission Color','Emission'):
                if nm in nd.inputs and nd.inputs[nm].is_linked:
                    m.node_tree.links.remove(nd.inputs[nm].links[0])
            if 'Emission Strength' in nd.inputs: nd.inputs['Emission Strength'].default_value=0.0
# shrink textures
mx_px=cfg.get('tex',2048)
for im in bpy.data.images:
    if im.size[0]>mx_px or im.size[1]>mx_px:
        im.scale(min(im.size[0],mx_px),min(im.size[1],mx_px))
bpy.ops.export_scene.gltf(filepath=cfg['out'],export_format='GLB',export_apply=True,export_image_format=cfg.get('img_fmt','WEBP'),export_image_quality=88)
print('MATERIALS',len(bpy.data.materials))
