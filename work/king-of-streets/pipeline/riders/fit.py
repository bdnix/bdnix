import bpy,numpy as np,sys,math
from mathutils import Vector,Matrix,Quaternion
BIKE=sys.argv[-2] if len(sys.argv)>3 else 'A3'
OUT=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f'/tmp/claude-0/work/bikes_plain/{BIKE}.glb')
bikeobjs=list(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath='/tmp/claude-0/work/src/x/claudia/scene.gltf')
arm=bpy.data.objects['Object_4'];mesh=bpy.data.objects['Object_6']
bpy.data.objects.remove(bpy.data.objects['Icosphere'])
arm.parent=None;arm.scale=(0.0095,)*3;arm.location=(0,0,0)
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
    print('limb',up,'reach',round(d/(l1+l2),3),'l1',round(l1,3),'l2',round(l2,3))
    aim(up,mid,Ed);aim(mid,end,T)
# ---- bike points (Blender frame: X=x, Y=-z, Z=y of the bike's glTF)
def B(x,y,z):return Vector((x,-z,y))
seat=B(0,float(__import__('os').environ.get('SEATY','0.90')),float(__import__('os').environ.get('SEATZ','-0.25')))
grip={'l':B(0.3553,1.0209,0.3217),'r':B(-0.3559,1.0210,0.3216)}
peg={'l':B(0.23,0.31,-0.12),'r':B(-0.23,0.31,-0.12)}
# pelvis
hip0=W('hip_02',False)
target_hip=seat+Vector((0,-0.02,0.10))
P['hip_02'].matrix=arm.matrix_world.inverted()@(Matrix.Translation(target_hip-hip0)@(arm.matrix_world@P['hip_02'].matrix))
upd()
print('hip now',np.round(W('hip_02')[:],3))
# lean torso forward by rotating hip about X (pitch)
lean=math.radians(float(__import__('os').environ.get('LEAN','18')))
Rm=Matrix.Rotation(lean,4,'X')  # pitch forward = toward -Y
h=W('hip_02');Tm=Matrix.Translation(h)
print('shoulder before',np.round(W('upperarm_l_024')[:],3))
P['hip_02'].matrix=arm.matrix_world.inverted()@((Tm@Rm@Tm.inverted())@(arm.matrix_world@P['hip_02'].matrix));upd()
print('shoulder after',np.round(W('upperarm_l_024')[:],3),'quat',P['hip_02'].rotation_quaternion[:],'mode',P['hip_02'].rotation_mode)
# ---- hands: orient the hand so its knuckle line runs along the grip, then wrap each finger on a circle about the grip axis
import re
def find(prefix):
    for b in arm.data.bones:
        if b.name.startswith(prefix):return b.name
    raise KeyError(prefix)
GR=0.0198           # grip radius (ray-cast circle fits, residual 2 mm)
FT=float(__import__('os').environ.get('FT','0.0085'))           # finger half-thickness: bone line lies this far outside the grip surface
GRIPAX={'l':Vector((0.803,0.595,-0.04)).normalized(),'r':Vector((0.812,-0.581,0.044)).normalized()}  # bike axis (gltf) -> blender (x,-z,y): fixed below
# grip axes are measured in bike coordinates; convert once
def Bd(x,y,z):return Vector((x,-z,y))
GRIPAX={'l':Bd(0.8952,-0.0106,-0.4455).normalized(),'r':Bd(-0.8994,-0.0071,-0.4371).normalized()}
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
        THK[(s_,k_)]=(1.1*t1+0.0005,1.1*t2+0.0005,0.85*1.1*t2+0.0005)
print('finger half-thickness mm (l)',{k[1]:[round(x*1000,1) for x in v] for k,v in THK.items() if k[0]=='l'})
def rseg(Lseg,FTs):
    R0=GR+FTs;R=R0
    for _ in range(20):R=R0/math.cos(math.asin(min(Lseg/(2*R),0.99)))
    return R
TIPLEN={}
for s in ('l','r'):
    for k in FING+['thumb']:
        try:TIPLEN[(s,k)]=fingertip_len(s,k) if k!='thumb' else fingertip_len(s,'thumb')
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
    e_up=(Vector((0,0,1))-a*a.z).normalized();e_fw=(Vector((0,-1,0))-a*a.y*(-1)).normalized()
    e_fw=(e_fw-a*e_fw.dot(a)).normalized()
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
        q=c+ax*((p0-c).dot(ax))
        e1=(e_up-ax*e_up.dot(ax)).normalized();e2=(e_fw-ax*e_fw.dot(ax)).normalized()
        L1=(W(n2,False)-W(n1,False)).length*HS;L2=(W(n3,False)-W(n2,False)).length*HS;L3=TIPLEN[(s,k)]*HS
        d0=W(n2)-W(n1)
        if k=='thumb':
            # thumb starts on the rear/underside: begin at its own base, wrap the other way
            pass
        t1,t2,t3=[x*HS for x in THK[(s,k)]]
        P1=circ_next(q,e1,e2,rseg(L1,t1),p0,L1,sigma);aimdir(n1,W(n2)-W(n1),P1)
        P2=circ_next(q,e1,e2,rseg(L2,t2),P1,L2,sigma);aimdir(n2,W(n3)-W(n2),P2)
        P3=circ_next(q,e1,e2,rseg(L3,t3),P2,L3,sigma);aimdir(n3,W(n3)-W(n2),P3)
# legs: foot ball on the peg
for s,sg in (('l',1),('r',-1)):
    ids={'l':('74','75','76','77'),'r':('81','82','83','84')}[s]
    up,lo,ft,ba=[f'upperleg_{s}_0{ids[0]}',f'lowerleg_{s}_0{ids[1]}',f'foot_{s}_0{ids[2]}',f'ball_{s}_0{ids[3]}']
    rest_ankle_to_ball=W(ba,False)-W(ft,False)
    ballT=peg[s]+Vector((0,0,0.02))
    # ankle: behind and above the ball, foot pitched ~25 deg toes down on the peg
    ank=ballT+Vector((0,0.10*math.cos(0.5),0.10*math.sin(0.5)+0.02))
    limb(up,lo,ft,ank,pole=ank+Vector((sg*0.4,-0.6,0.2)))
    aim(ft,ba,ballT)
upd()
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
nm=bpy.data.objects.new('rider',me);bpy.context.scene.collection.objects.link(nm)
nm.data.materials.clear()
for m in mesh.data.materials:nm.data.materials.append(m)
bpy.data.objects.remove(mesh);bpy.data.objects.remove(arm)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=True,export_apply=False)
print('exported',OUT)
