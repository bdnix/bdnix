import bpy,numpy as np,sys,math
f=sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
o=bpy.data.objects['rider'] if 'rider' in bpy.data.objects else [x for x in bpy.data.objects if x.type=='MESH' and x.name.startswith('rider')][0]
M=o.matrix_world
v=np.array([(M@vv.co)[:] for vv in o.data.vertices]);g=np.stack([v[:,0],v[:,2],-v[:,1]],1)   # back to bike gltf coords
GR=0.0198
grips={'left of bike (x>0)':(np.array([0.3553,1.0209,0.3217]),np.array([0.8952,-0.0106,-0.4455])),'right (x<0)':(np.array([-0.3559,1.0210,0.3216]),np.array([-0.8994,-0.0071,-0.4371]))}
for nm,(c,a) in grips.items():
    a=a/np.linalg.norm(a)
    d=g-c;t=d@a;rv=d-np.outer(t,a);r=np.linalg.norm(rv,axis=1)
    sel=(np.abs(t)<0.06)&(r<0.06)
    rr=r[sel];tt=t[sel]
    print('==',nm,'hand/rider verts near grip',sel.sum())
    print('  deepest vertex inside the grip: radius',round(rr.min()*1000,1),'mm vs grip',GR*1000,'mm  -> penetration',round(max(0,(GR-rr.min()))*1000,1),'mm')
    inside=(rr<GR-0.002).sum()
    print('  verts more than 2 mm inside the grip:',inside,'of',len(rr))
    # angular coverage: bins of 15 deg around the axis, for verts within 7 mm of surface and within the finger span
    e1=np.array([0,1,0])-a*a[1];e1/=np.linalg.norm(e1)       # up
    e2=np.cross(a,e1)
    ang=np.degrees(np.arctan2(rv[sel]@e2,rv[sel]@e1))%360
    close=rr<GR+0.007
    bins=np.zeros(24,int)
    for A in ang[close]:bins[int(A//15)]+=1
    print('  contact verts (within 7 mm of surface) by angle, 15 deg bins from the top:',bins.tolist())
    print('  covered arc (bins with contact):',int((bins>0).sum()*15),'deg of 360')
    # axial span of contact
    print('  axial span of contact verts (cm):',round((tt[close].max()-tt[close].min())*100,1) if close.any() else None)

    worst=np.argsort(rr)[:6]
    for w in worst:print('   worst vert: radius',round(rr[w]*1000,1),'mm, angle',round(ang[w]),'deg, along grip',round(tt[w]*100,1),'cm')
