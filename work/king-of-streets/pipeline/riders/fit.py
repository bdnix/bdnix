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
def canon(n):return n.split('idling_')[-1] if 'idling_' in n else n
for vg_ in mesh.vertex_groups:vg_.name=canon(vg_.name)
bpy.context.view_layer.objects.active=arm
bpy.ops.object.mode_set(mode='EDIT')
for eb in arm.data.edit_bones:eb.name=canon(eb.name)
bpy.ops.object.mode_set(mode='OBJECT')
arm.parent=None;arm.scale=(RSCALE,)*3;arm.location=(0,0,0)
bpy.context.view_layer.update()
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
# ---- bike points (Blender frame: X=x, Y=-z, Z=y of the bike's glTF)
def B(x,y,z):return Vector((x,-z,y))
seat=B(0,float(__import__('os').environ.get('SEATY',str(CFG['seat'][1]+0.08))),float(__import__('os').environ.get('SEATZ',str(CFG['seat'][0]))))
gc=CFG['grip']['c'];grip={'l':B(gc[0],gc[1],gc[2]),'r':B(-gc[0],gc[1],gc[2])}
from mathutils.bvhtree import BVHTree
_bv=[];_bp=[]
for o_ in bikeobjs:
    if o_.type=='MESH':
        m_=o_.to_mesh();m_.transform(o_.matrix_world);off_=len(_bv);_bv+=[v.co.copy() for v in m_.vertices];_bp+=[tuple(off_+i for i in p.vertices) for p in m_.polygons]
_bt=BVHTree.FromPolygons(_bv,_bp)
def _top(x,z):
    best=0.0
    for dx in (-0.02,0,0.02):
        for dz in (-0.02,0,0.02):
            h=_bt.ray_cast(Vector((x+dx,-(z+dz),CFG['peg'][2]+0.07)),Vector((0,0,-1)),1.0)
            if h[0]:best=max(best,h[0].z)
    return best if best>0 else 0.3
px,pz=CFG['peg'][0]+float(os.environ.get('PEGDX','0')),CFG['peg'][1]
peg={'l':B(px,_top(px,pz),pz),'r':B(-px,_top(-px,pz),pz)}
print('peg tops (bike y):',round(peg['l'].z,3),round(peg['r'].z,3))
# pelvis
hip0=W('hip_02',False)
target_hip=seat+Vector((0,-0.02,0.10))
P['hip_02'].matrix=arm.matrix_world.inverted()@(Matrix.Translation(target_hip-hip0)@(arm.matrix_world@P['hip_02'].matrix))
upd()
print('hip now',np.round(W('hip_02')[:],3))

def _rot_about(n,R3,pivot):
    R=R3.to_4x4();Tm=Matrix.Translation(pivot)
    P[n].matrix=arm.matrix_world.inverted()@((Tm@R@Tm.inverted())@(arm.matrix_world@P[n].matrix));upd()
def square(n,a_name,b_name):
    """rotate bone n so the line from b to a (their heads) runs along +x"""
    v=W(a_name)-W(b_name);v.z=v.z;d=Vector((1,0,0))
    _rot_about(n,v.normalized().rotation_difference(d).to_matrix(),W(n))
square('hip_02','upperleg_l_074','upperleg_r_081')
# lean torso forward by rotating hip about X (pitch)
lean=math.radians(float(__import__('os').environ.get('LEAN','18')))
Rm=Matrix.Rotation(lean,4,'X')  # pitch forward = toward -Y
h=W('hip_02');Tm=Matrix.Translation(h)
print('shoulder before',np.round(W('upperarm_l_024')[:],3))
P['hip_02'].matrix=arm.matrix_world.inverted()@((Tm@Rm@Tm.inverted())@(arm.matrix_world@P['hip_02'].matrix));upd()
print('shoulder after',np.round(W('upperarm_l_024')[:],3),'quat',P['hip_02'].rotation_quaternion[:],'mode',P['hip_02'].rotation_mode)
square('spine_01_03','upperarm_l_024','upperarm_r_049')
HU=math.radians(float(os.environ.get('HEADUP','0')))
if HU:
    _rot_about('neck_06',Matrix.Rotation(-HU,3,'X'),W('neck_06'))
# ---- hands: orient the hand so its knuckle line runs along the grip, then wrap each finger on a circle about the grip axis
import re
def find(prefix):
    for b in arm.data.bones:
        if b.name.startswith(prefix):return b.name
    raise KeyError(prefix)
GR=CFG['grip']['r']   # grip radius (ray-cast circle fits)
FT=float(__import__('os').environ.get('FT','0.0085'))           # finger half-thickness: bone line lies this far outside the grip surface
GRIPAX={'l':Vector((0.803,0.595,-0.04)).normalized(),'r':Vector((0.812,-0.581,0.044)).normalized()}  # bike axis (gltf) -> blender (x,-z,y): fixed below
# grip axes are measured in bike coordinates; convert once
def Bd(x,y,z):return Vector((x,-z,y))
ga=CFG['grip']['a'];GRIPAX={'l':Bd(ga[0],ga[1],ga[2]).normalized(),'r':Bd(-ga[0],ga[1],ga[2]).normalized()}
FING=['index','middle','ring','pinky']
def finger_names(s,k):
    return [find(f'{k}_0{i}_{s}_') for i in (1,2,3)]
def fingertip_len(s,k):
    n3=finger_names(s,k)[2];vg=mesh.vertex_groups.get(n3)
    h=W(n3,False);h2=W(finger_names(s,k)[1],False);d=(h-h2).normalized()
    best=0
    for v in mesh.data.vertices:
        for g in v.groups:
            if g.group==vg.index and g.weight>0.5:
                p=mesh.matrix_world@v.co;best=max(best,(p-h).dot(d))
    return best
def thickness(s,k,j):
    ns=finger_names(s,k);n=ns[j];vg=mesh.vertex_groups.get(n)
    a_=W(n,False);b_=W(ns[j+1],False) if j<2 else None
    if b_ is None:return None
    d=b_-a_;L=d.length;d=d/L;rs=[]
    for v in mesh.data.vertices:
        for g in v.groups:
            if g.group==vg.index and g.weight>0.9:
                p=mesh.matrix_world@v.co;t=(p-a_).dot(d)
                if 0<t<L:rs.append((p-a_-d*t).length)
    return sum(rs)/len(rs) if rs else 0.008
THK={}
for s_ in ('l','r'):
    for k_ in FING+['thumb']:
        t1=thickness(s_,k_,0);t2=thickness(s_,k_,1)
        THK[(s_,k_)]=(1.1*t1+0.0005,1.1*t2+0.0005,float(os.environ.get('T3F','0.85'))*1.1*t2+0.0005)
print('finger half-thickness mm (l)',{k[1]:[round(x*1000,1) for x in v] for k,v in THK.items() if k[0]=='l'})
def rseg(Lseg,FTs):
    R0=GR+FTs;R=R0
    for _ in range(20):R=R0/math.cos(math.asin(min(Lseg/(2*R),0.99)))
    return R

TIPLOC={}
def tipvec_local(s_,k_):
    n3=finger_names(s_,k_)[2];vg=mesh.vertex_groups.get(n3)
    b=arm.data.bones[n3];h=b.head_local;best=None;bd=-1
    inv=arm.matrix_world.inverted()
    for v in mesh.data.vertices:
        for g in v.groups:
            if g.group==vg.index and g.weight>0.5:
                p=inv@(mesh.matrix_world@v.co);d=(p-h).length
                if d>bd:bd=d;best=p
    return b.matrix_local.to_3x3().inverted()@(best-h)
for s_ in ('l','r'):
    for k_ in FING+['thumb']:TIPLOC[(s_,k_)]=tipvec_local(s_,k_)
def tipdir_world(s_,k_):
    n3=finger_names(s_,k_)[2]
    return arm.matrix_world.to_3x3()@(P[n3].matrix.to_3x3()@TIPLOC[(s_,k_)])
TIPLEN={}
for s in ('l','r'):
    for k in FING+['thumb']:
        try:TIPLEN[(s,k)]=TIPLOC[(s,k)].length*RSCALE
        except Exception as e:TIPLEN[(s,k)]=0.02
print('tip lengths l',{k[1]:round(v,3) for k,v in TIPLEN.items() if k[0]=='l'})
def frame(f,l):
    f=f.normalized();l=(l-f*l.dot(f)).normalized();return Matrix(((f.x,l.x,f.cross(l).x),(f.y,l.y,f.cross(l).y),(f.z,l.z,f.cross(l).z)))
def rotate_about(n,R3,pivot):
    R=R3.to_4x4();Tm=Matrix.Translation(pivot)
    P[n].matrix=arm.matrix_world.inverted()@((Tm@R@Tm.inverted())@(arm.matrix_world@P[n].matrix));upd()
def aimdir(n,cur_dir,target):
    h=W(n);d1=(Vector(target)-h).normalized()
    rotate_about(n,cur_dir.normalized().rotation_difference(d1).to_matrix(),h)
PHI0=math.radians(float(__import__('os').environ.get('PHI0','-30')))
def circ_next(q,e1,e2,R,P,L,sigma):
    """point X on circle (centre q, radius R, plane spanned by e1,e2) with |X-P|=L, further along sigma"""
    p2=Vector(((P-q).dot(e1),(P-q).dot(e2)))
    D=p2.length
    if D<1e-9 or D>R+L or D<abs(R-L):
        # nearest feasible
        D=min(max(D,abs(R-L)+1e-6),R+L-1e-6)
    a=(R*R-L*L+D*D)/(2*D);hh=math.sqrt(max(R*R-a*a,0))
    u=p2.normalized() if p2.length>1e-9 else Vector((1,0))
    base=u*a;perp=Vector((-u.y,u.x))
    c=[base+perp*hh,base-perp*hh]
    def prog(x):  # signed angular progress from P
        return sigma*(p2.x*x.y-p2.y*x.x)
    x=max(c,key=prog)
    return q+e1*x.x+e2*x.y
for s,sg in (('l',1),('r',-1)):
    ids={'l':('24','25','26'),'r':('49','50','51')}[s]
    up,lo,hd=f'upperarm_{s}_0{ids[0]}',f'lowerarm_{s}_0{ids[1]}',f'hand_{s}_0{ids[2]}'
    a=GRIPAX[s].copy()
    if a.x*sg<0:a=-a                      # outward = +x for l, -x for r
    c=grip[s]
    e_up=(Vector((0,0,1))-a*a.z).normalized()
    e_fw=(a.cross(e_up)*(1 if s=='l' else -1)).normalized()   # turning 'up' toward the front about the outward axis; well defined for any grip angle
    inboard=-a if True else a                # lateral axis (index minus pinky) points inboard
    mid1=finger_names(s,'middle')[0];idx1=finger_names(s,'index')[0];pk1=finger_names(s,'pinky')[0]
    f_rest=W(mid1,False)-W(hd,False);l_rest=W(idx1,False)-W(pk1,False)
    u0=math.cos(PHI0)*e_up+math.sin(PHI0)*e_fw
    TA=PHI0+math.radians(float(__import__('os').environ.get('TAN','-40')))
    f_des=(-math.sin(TA))*e_up+math.cos(TA)*e_fw   # tangent heading forward, over the top
    Fr=frame(f_rest,l_rest);Fd=frame(f_des,inboard);Rm_=Fd@Fr.inverted()
    p0_target=c+u0*(GR+FT+float(__import__('os').environ.get('KN','0.006')))
    HS=float(__import__('os').environ.get('HS','1.2'))
    wr=p0_target-Rm_@(f_rest*HS)
    limb(up,lo,hd,wr,pole=wr+Vector((sg*0.5,0.3,-0.3)))
    P[hd].scale=(HS,HS,HS);upd()
    # orient the hand: current frame -> desired frame, about the wrist
    Fc=frame(W(mid1)-W(hd),W(idx1)-W(pk1))
    rotate_about(hd,Fd@Fc.inverted(),W(hd))
    print(s,'knuckle line err mm',round((W(mid1)-p0_target).length*1000,1))
    # wrap fingers
    R=GR+FT
    for k in FING+['thumb']:
        if k=='thumb':
            n1,n2,n3=finger_names(s,'thumb');sigma=-1
        else:
            n1,n2,n3=finger_names(s,k);sigma=1
        p0=W(n1);ax=a
        # draw each finger toward the middle of the grip span so neighbouring fingers touch (FSQ<1 closes gaps)
        FSQ=float(os.environ.get('FSQ','1.0'))
        s_p0=(p0-c).dot(ax);s_new=s_p0*FSQ if k!='thumb' else s_p0
        q=c+ax*s_new
        dlt=s_p0-s_new
        p0_plane=p0-ax*dlt
        e1=(e_up-ax*e_up.dot(ax)).normalized();e2=(e_fw-ax*e_fw.dot(ax)).normalized()
        L1=(W(n2,False)-W(n1,False)).length*HS;L2=(W(n3,False)-W(n2,False)).length*HS;L3=TIPLEN[(s,k)]*HS
        d0=W(n2)-W(n1)
        if k=='thumb':
            # thumb starts on the rear/underside: begin at its own base, wrap the other way
            pass
        t1,t2,t3=[x*HS for x in THK[(s,k)]]
        if k=='thumb':
            def pol(P):
                d=P-q;return (round(d.dot(e1)*1000),round(d.dot(e2)*1000))
            print('THUMB',s,'p0 (up,fwd mm)',pol(p0),'rad',round((p0-q).length*1000),'L',round(L1*1000),round(L2*1000),round(L3*1000))
        L1e=math.sqrt(max(L1*L1-dlt*dlt,1e-8))
        P1=circ_next(q,e1,e2,rseg(L1e,t1),p0_plane,L1e,sigma);aimdir(n1,W(n2)-W(n1),P1)
        P2=circ_next(q,e1,e2,rseg(L2,t2),P1,L2,sigma);aimdir(n2,W(n3)-W(n2),P2)
        P3=circ_next(q,e1,e2,rseg(L3,t3),P2,L3,sigma);aimdir(n3,tipdir_world(s,k),P3)
# legs: place the sole of each foot on its peg (calibrated per foot from the measured sole)
FOOTV={}
for s_,ids in (('l',('76','77')),('r',('83','84'))):
    gi={mesh.vertex_groups[f'foot_{s_}_0{ids[0]}'].index,mesh.vertex_groups[f'ball_{s_}_0{ids[1]}'].index}
    FOOTV[s_]=[v.index for v in mesh.data.vertices if any(g.group in gi and g.weight>0.5 for g in v.groups)]
def sole_point(s_):
    dg_=bpy.context.evaluated_depsgraph_get();ev_=mesh.evaluated_get(dg_)
    mw_=mesh.matrix_world
    pts=[mw_@ev_.data.vertices[i].co for i in FOOTV[s_]]
    pts.sort(key=lambda p:p.z)
    low=pts[:25]
    return Vector((sum(p.x for p in low)/25,sum(p.y for p in low)/25,sum(p.z for p in low)/25))
def place_leg(s_,sg,ballT):
    ids={'l':('74','75','76','77'),'r':('81','82','83','84')}[s_]
    up,lo,ft,ba=[f'upperleg_{s_}_0{ids[0]}',f'lowerleg_{s_}_0{ids[1]}',f'foot_{s_}_0{ids[2]}',f'ball_{s_}_0{ids[3]}']
    ank=ballT+Vector((0,0.10*math.cos(0.5),0.10*math.sin(0.5)+0.02))
    limb(up,lo,ft,ank,pole=ank+Vector((sg*float(os.environ.get('KNEEOUT','0.4')),-0.6,0.2)))
    aim(ft,ba,ballT)
    return ba
for s_,sg in (('l',1),('r',-1)):
    target=peg[s_]+Vector((0,float(os.environ.get('BALLB','0')),0))
    ballT=target+Vector((0,0,0.03))
    for it in range(14):
        ba=place_leg(s_,sg,ballT);upd()
        sp=sole_point(s_)
        # vertical clearance of the lowest foot vertices over whatever bike surface is below them
        dg_=bpy.context.evaluated_depsgraph_get();ev_=mesh.evaluated_get(dg_);mw_=mesh.matrix_world
        lows=sorted((mw_@ev_.data.vertices[i].co for i in FOOTV[s_]),key=lambda p:p.z)[:40]
        gaps_=[]
        for p_ in lows:
            h_=_bt.ray_cast(Vector((p_.x,p_.y,p_.z+0.03)),Vector((0,0,-1)),0.5)
            if h_[0] is not None:gaps_.append(p_.z-h_[0].z)
        gap=min(gaps_) if gaps_ else 0.0
        errxy=Vector((target.x-sp.x,target.y-sp.y,0))
        err=Vector((errxy.x,errxy.y,-(gap-0.0015)))
        if errxy.length<0.0015 and abs(gap-0.0015)<0.0012:break
        ballT=ballT+err*0.7
        ballT.z=min(max(ballT.z,target.z-0.01),target.z+0.08)   # the foot stays at the peg's height
    print('foot',s_,'sideways error mm',round(errxy.length*1000,1),'lowest vertex above the surface mm',round(gap*1000,1),'after',it+1,'rounds','sole height vs peg top mm',round((sp.z-target.z)*1000,1))
upd()

# ---- helmet: full-face, pinned to the head bone
HSCALE=float(os.environ.get('HSCALE','0.284'));HDX=float(os.environ.get('HDX','0'));HDY=float(os.environ.get('HDY','0.0'));HDZ=float(os.environ.get('HDZ','0'))
hb=arm.data.bones['head_07'];eye=arm.matrix_world@arm.data.bones['eye_l_011'].head_local
headrest=arm.matrix_world@hb.matrix_local
headpose=arm.matrix_world@P['head_07'].matrix
bpy.ops.object.mode_set(mode='OBJECT')
pre=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=f"/tmp/claude-0/work/src/x/{os.environ.get('HELMET','helmet_motor')}/scene.gltf")
hobjs=[o for o in bpy.data.objects if o not in pre and o.type=='MESH']
keep=[o for o in hobjs if not o.name.startswith(('Pattern_LP','PatternStripes'))]
for o in hobjs:
    if o not in keep:bpy.data.objects.remove(o)
RAT={'Body':float(os.environ.get('RB','0.12')),'Glass':float(os.environ.get('RG','0.20')),'TopStripes':0.5,'BottomStriper':0.5,'Light':1.0,'SideLights':0.5}
for o in keep:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    key=[k for k in RAT if o.name.startswith(k)][0]
    if RAT[key]<1:
        md=o.modifiers.new('d','DECIMATE');md.ratio=RAT[key];bpy.ops.object.modifier_apply(modifier='d')
    bpy.ops.object.shade_smooth()
bpy.ops.object.select_all(action='DESELECT')
for o in keep:o.select_set(True)
bpy.context.view_layer.objects.active=keep[0];bpy.ops.object.join();helm=bpy.context.view_layer.objects.active;helm.name='helmet'
# helmet's own axes: up +Z, front +Y, origin near centre. Rest placement on the head (rest, character space).
Rz=Matrix.Rotation(math.pi,4,'Z')
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

# ---- diagnostics: which bones own the vertices that sit inside the grip
import collections
for sd in ('l','r'):
    cc=Vector(grip[sd]);aa=GRIPAX[sd].copy()
    if aa.x*(1 if sd=='l' else -1)<0:aa=-aa
    res=[]
    for i,v in enumerate(me.vertices):
        d=v.co-cc;t=d.dot(aa);rv=d-aa*t;r=rv.length
        if abs(t)<0.06 and r<GR-0.002:
            gs=sorted(mesh.data.vertices[i].groups,key=lambda g:-g.weight)
            res.append((r,mesh.vertex_groups[gs[0].group].name if gs else '?',t))
    res.sort()

    # METRIC: deepest penetration, arc covered by contact, count more than 2 mm inside
    aa2=aa/aa.length;e1m=(Vector((0,0,1))-aa2*aa2.z).normalized();e2m=aa2.cross(e1m)
    pen=0;n2=0;bins=set()
    for v in me.vertices:
        d=v.co-cc;t=d.dot(aa2);rv=d-aa2*t;r=rv.length
        if abs(t)<0.06 and r<0.06:
            if r<GR:pen=max(pen,GR-r)
            if r<GR-0.002:n2+=1
            if r<GR+0.007:bins.add(int((math.degrees(math.atan2(rv.dot(e2m),rv.dot(e1m)))%360)//15))
    print('METRIC',sd,'pen_mm',round(pen*1000,1),'arc_deg',len(bins)*15,'gt2mm',n2)
    cnt=collections.Counter(n for r,n,t in res)
    print('inside grip',sd,len(res),'by bone',dict(cnt.most_common(6)),'worst',[(round(r*1000,1),n) for r,n,t in res[:4]])

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
