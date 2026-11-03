import bpy,numpy as np,sys,math
from mathutils import Vector,Matrix,Quaternion
import os
BIKE=os.environ.get('BIKE') or sys.argv[-2]
OUT=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/bikes_plain/{BIKE}.glb')
bikeobjs=list(bpy.data.objects)
import json
CFG=json.load(open('/tmp/claude-0/work/bikes.json'))[BIKE]
import os
RIDER=os.environ.get('RIDER','claudia');RSCALE=float(os.environ.get('RSCALE','0.0095'))
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/src/x/{RIDER}/scene.gltf')
arm=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
mesh=[o for o in bpy.data.objects if o.type=='MESH' and len(o.vertex_groups)>0][0]
for o in list(bpy.data.objects):
    if o.type=='MESH' and o is not mesh and o not in bikeobjs:bpy.data.objects.remove(o)
import re as _re
_BIP={'Pelvis':'pelvis_b','Spine':'spine_01_03','Spine1':'spine_02_04','Spine2':'spine_03_05','Neck':'neck_06','Head':'head_07',
 'L Clavicle':'shoulder_l_023','L UpperArm':'upperarm_l_024','L Forearm':'lowerarm_l_025','L Hand':'hand_l_026',
 'R Clavicle':'shoulder_r_048','R UpperArm':'upperarm_r_049','R Forearm':'lowerarm_r_050','R Hand':'hand_r_051',
 'L Thigh':'upperleg_l_074','L Calf':'lowerleg_l_075','L Foot':'foot_l_076','L Toe0':'ball_l_077',
 'R Thigh':'upperleg_r_081','R Calf':'lowerleg_r_082','R Foot':'foot_r_083','R Toe0':'ball_r_084'}
_FING={'0':'thumb','1':'index','2':'middle','3':'ring','4':'pinky'}
def canon(n):
    if 'idling_' in n:return n.split('idling_')[-1]
    if _re.match(r'Bip001_\d+$',n):return 'hip_02'
    m=_re.match(r'Bip001 (.+)_\d+$',n)
    if m:
        k=m.group(1)
        if k in _BIP:return _BIP[k]
        f=_re.match(r'([LR]) Finger(\d)(\d?)$',k)
        if f:
            side=f.group(1).lower();fi=_FING[f.group(2)];seg=int(f.group(3) or 0)+1
            return f'{fi}_0{seg}_{side}_b'
    return n
for vg_ in mesh.vertex_groups:vg_.name=canon(vg_.name)
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for eb in arm.data.edit_bones:eb.name=canon(eb.name)
bpy.ops.object.mode_set(mode='OBJECT')
arm.parent=None;arm.scale=(RSCALE,)*3;arm.location=(0,0,0)
bpy.context.view_layer.update()
# ---- MALE: the same suit reshaped into a man's build, in the rest pose, mesh and skeleton alike
if os.environ.get('MALE'):
    SHW=float(os.environ.get('SHW','0.22'));HPN=float(os.environ.get('HPN','0.09'));BUSTK=float(os.environ.get('BUSTK','0.0'))
    def _ss(a,b,t):
        u=min(1.0,max(0.0,(t-a)/(b-a)));return u*u*(3-2*u)
    _Mw=mesh.matrix_world.copy();_Mi=_Mw.inverted()
    _V=np.array([(_Mw@v.co)[:] for v in mesh.data.vertices])
    # chest plane: per 1 cm band, the sternum's forward reach (forward = -y)
    _bands=np.arange(1.05,1.36,0.01);_cap=[]
    for z0 in _bands:
        m=(np.abs(_V[:,2]-z0)<0.012)&(np.abs(_V[:,0])<0.03)
        _cap.append((-_V[m,1]).max()+0.012 if m.any() else np.nan)
    _cap=np.array(_cap);_ok=~np.isnan(_cap);_cap=np.interp(_bands,_bands[_ok],_cap[_ok])
    _cap=np.convolve(np.pad(_cap,3,mode='edge'),np.ones(7)/7,mode='valid')
    _bk=[(_V[(np.abs(_V[:,2]-z0)<0.012)&(np.abs(_V[:,0])<0.05),1]).max() for z0 in (1.05,1.08,1.11)]
    WST=float(os.environ.get('WST','0.12'));DEP=float(os.environ.get('DEP','0.10'));_dc=float(-np.mean([(_V[(np.abs(_V[:,2]-z0)<0.012)&(np.abs(_V[:,0])<0.03),1]).mean() for z0 in (1.05,1.1,1.15)]))
    _backcap=float(np.mean(_bk))+0.015;GLK=float(os.environ.get('GLK','0.25'))
    def reshape(p):
        x,y,z=p
        wb=1.0-_ss(0.17,0.26,abs(x))
        f=1.0+SHW*_ss(0.95,1.26,z)*(1-_ss(1.36,1.47,z))-HPN*_ss(0.70,0.85,z)*(1-_ss(0.98,1.08,z))*wb
        wb2=1.0-_ss(0.17,0.26,abs(x));x=x*f*(1.0+WST*_ss(0.93,1.0,z)*(1-_ss(1.12,1.22,z))*wb2)
        if 1.05<=z<=1.35 and abs(p[0])<0.17:
            c=float(np.interp(z,_bands,_cap));d=-y;w=_ss(1.08,1.16,z)*(1-_ss(1.27,1.34,z))*(1-_ss(0.10,0.17,abs(p[0])))
            if d>c:d=c+(d-c)*(1-w*(1-BUSTK))
            y=-d
        dz=_ss(0.95,1.08,z)*(1-_ss(1.28,1.38,z))*wb2
        y=-(_dc+(-y-_dc)*(1+DEP*dz))
        if 0.80<=z<=1.04 and abs(p[0])<0.20 and y>_backcap:
            w=_ss(0.80,0.88,z)*(1-_ss(0.98,1.04,z));y=_backcap+(y-_backcap)*(1-w*(1-GLK))
        return (x,y,z)
    for v in mesh.data.vertices:
        q=reshape(tuple(_Mw@v.co));v.co=_Mi@Vector(q)
    bpy.context.view_layer.objects.active=arm;bpy.ops.object.mode_set(mode='EDIT')
    _Aw=arm.matrix_world.copy();_Ai=_Aw.inverted()
    for eb in arm.data.edit_bones:eb.use_connect=False
    for eb in arm.data.edit_bones:
        h=reshape(tuple(_Aw@eb.head));t=reshape(tuple(_Aw@eb.tail))
        eb.head=_Ai@Vector(h);eb.tail=_Ai@Vector(t)
    bpy.ops.object.mode_set(mode='OBJECT');bpy.context.view_layer.update()
    print('MALE reshaped: shoulders +%d%%, hips -%.1f%%, bust to %.0f%% of its relief'%(SHW*100,HPN*100,BUSTK*100))
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='POSE')
P=arm.pose.bones
def W(n,pose=True):
    b=P[n]
    return arm.matrix_world@(b.head if pose else arm.data.bones[n].head_local)
def upd():bpy.context.view_layer.update()
def aim(n,child_or_pt,target):
    """rotate bone n about its head so the direction to child_or_pt (a bone name) points at world target"""
    h=W(n);c=W(child_or_pt)
    d0=(c-h).normalized();d1=(Vector(target)-h).normalized()
    R=d0.rotation_difference(d1).to_matrix().to_4x4()
    Tm=Matrix.Translation(h)
    M=Tm@R@Tm.inverted()          # world-space rotation about head
    P[n].matrix=arm.matrix_world.inverted()@(M@(arm.matrix_world@P[n].matrix))
    upd()
def limb(up,mid,end,target,pole):
    """two-bone solve: up head S, mid head E, end head -> target"""
    S=W(up,False);E=W(mid,False);Wr=W(end,False)
    l1=(E-S).length;l2=(Wr-E).length
    S=W(up)   # current shoulder (hip moved)
    T=Vector(target);d=(T-S).length;d=min(d,l1+l2-1e-4)
    a=(l1*l1-l2*l2+d*d)/(2*d);h=math.sqrt(max(l1*l1-a*a,0))
    ax=(T-S).normalized();pv=(Vector(pole)-S);pv=(pv-ax*pv.dot(ax)).normalized()
    Ed=S+ax*a+pv*h
    print('limb',up,'reach',round(d/(l1+l2),3),'l1',round(l1,3),'l2',round(l2,3),'S',np.round(S[:],3),'T',np.round(T[:],3))
    aim(up,mid,Ed);aim(mid,end,T)
# ---- standing pose: arms relaxed at the sides, legs straight, feet flat, pelvis and shoulders squared
STANDOUT=True
def _rot_about(n,R3,pivot):
    R=R3.to_4x4();Tm=Matrix.Translation(pivot)
    P[n].matrix=arm.matrix_world.inverted()@((Tm@R@Tm.inverted())@(arm.matrix_world@P[n].matrix));upd()
def square(n,a_name,b_name):
    """rotate bone n so the line from b to a (their heads) runs along +x"""
    v=W(a_name)-W(b_name);v.z=v.z;d=Vector((1,0,0))
    _rot_about(n,v.normalized().rotation_difference(d).to_matrix(),W(n))
Bd_=lambda x,y,z:Vector((x,y,z))
square('hip_02','upperleg_l_074','upperleg_r_081')
SPROOT='spine_02_04' if any(c.name.startswith('upperleg') for c in P['spine_01_03'].children_recursive) else 'spine_01_03'
_mt=(W('upperleg_l_074')+W('upperleg_r_081'))/2
P['hip_02'].matrix=arm.matrix_world.inverted()@(Matrix.Translation(Vector((-_mt.x,0,0)))@(arm.matrix_world@P['hip_02'].matrix));upd()
square(SPROOT,'upperarm_l_024','upperarm_r_049')
for s_,sg in (('l',1),('r',-1)):
    ids={'l':('24','25','26'),'r':('49','50','51')}[s_]
    up,lo,hd=f'upperarm_{s_}_0{ids[0]}',f'lowerarm_{s_}_0{ids[1]}',f'hand_{s_}_0{ids[2]}'
    S_=W(up);l1_=(W(lo,False)-W(up,False)).length;l2_=(W(hd,False)-W(lo,False)).length
    wrist=S_+Vector((sg*0.03,-0.02,-(l1_+l2_)*0.995))
    limb(up,lo,hd,wrist,pole=wrist+Vector((sg*0.05,0.9,0)))
for s_,sg in (('l',1),('r',-1)):
    ids={'l':('74','75','76','77'),'r':('81','82','83','84')}[s_]
    up,lo,ft,ba=[f'upperleg_{s_}_0{ids[0]}',f'lowerleg_{s_}_0{ids[1]}',f'foot_{s_}_0{ids[2]}',f'ball_{s_}_0{ids[3]}']
    hip_=W(up);ank_rest=W(ft,False);ball_rest=W(ba,False)
    limb(up,lo,ft,Vector((hip_.x,hip_.y,ank_rest.z)),pole=Vector((hip_.x,hip_.y-1.0,hip_.z-0.5)))
    aim(ft,ba,W(ft)+Vector((0,-(ball_rest-ank_rest).xy.length,-(ank_rest.z-ball_rest.z))))
HU=math.radians(float(os.environ.get('HEADUP','0')))
if HU:
    _rot_about('neck_06',Matrix.Rotation(-HU,3,'X'),W('neck_06'))
upd()
for o_ in bikeobjs:
    if o_.name in bpy.data.objects:bpy.data.objects.remove(o_)
# ---- helmet: full-face, pinned to the head bone
HSCALE=float(os.environ.get('HSCALE','0.284'));HDX=float(os.environ.get('HDX','0'));HDY=float(os.environ.get('HDY','0.0'));HDZ=float(os.environ.get('HDZ','0'))
hb=arm.data.bones['head_07'];eye=arm.matrix_world@(arm.data.bones['eye_l_011'].head_local if 'eye_l_011' in arm.data.bones else hb.head_local)
headrest=arm.matrix_world@hb.matrix_local
headpose=arm.matrix_world@P['head_07'].matrix
bpy.ops.object.mode_set(mode='OBJECT')
pre=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=f"/tmp/claude-0/work/src/x/{os.environ.get('HELMET','helmet_motor')}/scene.gltf")
hobjs=[o for o in bpy.data.objects if o not in pre and o.type=='MESH']
keep=[o for o in hobjs if not o.name.startswith(('Pattern_LP','PatternStripes'))]
for o in hobjs:
    if o not in keep:bpy.data.objects.remove(o)
RAT={'Object':float(os.environ.get('RB','1.0')),'Body':float(os.environ.get('RB','0.12')),'Glass':float(os.environ.get('RG','0.20')),'TopStripes':0.5,'BottomStriper':0.5,'Light':1.0,'SideLights':0.5}
for o in keep:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    key=next((k for k in RAT if o.name.startswith(k)),None)
    if key and RAT[key]<1:
        md=o.modifiers.new('d','DECIMATE');md.ratio=RAT[key];bpy.ops.object.modifier_apply(modifier='d')
    bpy.ops.object.shade_smooth()
bpy.ops.object.select_all(action='DESELECT')
for o in keep:o.select_set(True)
bpy.context.view_layer.objects.active=keep[0];bpy.ops.object.join();helm=bpy.context.view_layer.objects.active;helm.name='helmet'
# helmet's own axes: up +Z, front +Y, origin near centre. Rest placement on the head (rest, character space).
Rz=Matrix.Rotation(math.radians(float(os.environ.get('HROT','180'))),4,'Z')
if os.environ.get('HFIT'):
    # size and place the new helmet from the rider's own head (built-in helmet or head), in the rest pose
    _hg={vg_.index for vg_ in mesh.vertex_groups if vg_.name.startswith('head_07')}
    _rest=[arm.matrix_world@(arm.matrix_world.inverted()@(mesh.matrix_world@v.co)) for v in mesh.data.vertices if any(g.group in _hg and g.weight>0.5 for g in v.groups)]
    _mn=Vector((min(p.x for p in _rest),min(p.y for p in _rest),min(p.z for p in _rest)));_mx=Vector((max(p.x for p in _rest),max(p.y for p in _rest),max(p.z for p in _rest)))
    _hc=(_mn+_mx)/2;_hw=_mx.x-_mn.x
    _hv=[v.co for v in helm.data.vertices];_hmn=Vector((min(p.x for p in _hv),min(p.y for p in _hv),min(p.z for p in _hv)));_hmx=Vector((max(p.x for p in _hv),max(p.y for p in _hv),max(p.z for p in _hv)))
    _hhc=(_hmn+_hmx)/2;_s=_hw/(_hmx.x-_hmn.x)*float(os.environ.get('HSF','1.0'))
    M_rest=Matrix.Translation(_hc+Vector((HDX,HDY,HDZ)))@Rz@Matrix.Scale(_s,4)@Matrix.Translation(-_hhc)
    print('helmet auto fit: head width %.3f m, helmet scale %.3f'%(_hw,_s))
else:
    org=Vector((headrest.translation.x+HDX,0.03+HDY,eye.z-0.05*HSCALE+HDZ))
    M_rest=Matrix.Translation(org)@Rz@Matrix.Scale(HSCALE,4)
M=headpose@headrest.inverted()@M_rest
helm.matrix_world=M
bpy.context.view_layer.update()
bb=[helm.matrix_world@Vector(c) for c in helm.bound_box];import numpy as _np
bbn=_np.array([c[:] for c in bb]);print('helmet world bbox',bbn.min(0).round(3),bbn.max(0).round(3),'head pose head',_np.round((headpose@Vector((0,0,0)))[:],3),'eye rest',_np.round(eye[:],3))
print('helmet tris',sum(len(p.vertices)-2 for p in helm.data.polygons))
# bake the pose into a plain mesh
dg=bpy.context.evaluated_depsgraph_get()
bpy.ops.object.mode_set(mode='OBJECT')
ev=mesh.evaluated_get(dg);me=bpy.data.meshes.new_from_object(ev)
mw=mesh.matrix_world
for v in me.vertices:v.co=mw@v.co

# ---- remove what a helmet hides or must not show: the hair (one UV island) and any surface inside the helmet
import bmesh
from mathutils.bvhtree import BVHTree
HAIRL=[int(x) for x in os.environ.get('HAIRISLAND','').split(',') if x!='']
HAIR=0 if HAIRL else -1
hv=[helm.matrix_world@v.co for v in helm.data.vertices];hp=[tuple(p.vertices) for p in helm.data.polygons]
hbvh=BVHTree.FromPolygons(hv,hp)
rim_z=min(c.z for c in hv)+0.02
lab=np.load(f'/tmp/claude-0/work/uvlab_{RIDER}.npy') if HAIR>=0 else None
bm=bmesh.new();bm.from_mesh(me);bm.faces.ensure_lookup_table()
hwset={vg_.index for vg_ in mesh.vertex_groups if vg_.name.startswith(('head_07','jaw','eye_','eyelid','eyebrow','mouth'))}
HW={v.index:sum(g.weight for g in v.groups if g.group in hwset) for v in mesh.data.vertices}
kill=[]
for f in bm.faces:
    c=f.calc_center_median()
    isHair=lab is not None and int(lab[f.index]) in HAIRL
    inside=False
    if c.z>rim_z:
        n=0;o=c.copy();d=Vector((0,0,1))
        for _ in range(8):
            h=hbvh.ray_cast(o,d)
            if h[0] is None:break
            n+=1;o=h[0]+d*1e-4
        inside=(n%2==1)
    headish=sum(HW[v.index] for v in f.verts)/len(f.verts)>0.25
    if isHair or inside or (headish and c.z>rim_z-0.03):kill.append(f)
bmesh.ops.delete(bm,geom=kill,context='FACES')
bm.to_mesh(me);bm.free()
print('removed faces (hair + inside the helmet):',len(kill),' rider faces left',len(me.polygons))
nm=bpy.data.objects.new('rider',me);bpy.context.scene.collection.objects.link(nm)
nm.data.materials.clear()
for m in mesh.data.materials:nm.data.materials.append(m)
bpy.data.objects.remove(mesh);bpy.data.objects.remove(arm)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=True,export_apply=False)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.name.startswith(('rider','helmet')):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT.replace('.glb','_rider.glb'),export_format='GLB',use_selection=True,export_apply=False)
print('exported',OUT)
