import re,json
def parse(vf,ff,lean):
    t=open(vf).read();f=open(ff).read()
    d={}
    m=re.search(r'bytes (\d+) tris (\d+)',t);d['bytes']=int(m.group(1));d['tris']=int(m.group(2))
    pen=[float(x) for x in re.findall(r'penetration ([\d.]+) mm',t)];d['pen']=pen
    gt=[int(x) for x in re.findall(r'more than 2 mm inside the grip: (\d+) of',t)];d['gt2']=gt
    d['holes']=[float(x) for x in re.findall(r'uncovered rays inside the wrapped arc: ([\d.]+)%',t)]
    d['seatpt']=float(re.search(r'closest rider point over the seat: (-?[\d.]+) mm',t).group(1))
    m=re.search(r'rider verts within 3 cm of the bike: (\d+) ; inside the bike volume \(3 of 4 ray votes\) by >2 mm: (\d+)',t);d['clipverts']=int(m.group(2))
    dep=re.findall(r'depth ([\d.]+) mm at bike \(x,y,z\)=\((-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\)',t)
    d['clipmax']=float(dep[0][0]) if dep else 0;d['clippos']=[float(x) for x in dep[0][1:]] if dep else None
    a=re.search(r'AIR sit zone .*?: (\d+) underside points, (\d+)% within 8 mm of the seat, median gap (-?\d+) mm',t);d['air']=[int(a.group(2)),int(a.group(3))]
    # feet: last 'lowest vertex above the surface' per foot
    fl=re.findall(r'foot l .*?lowest vertex above the surface mm (-?[\d.]+)',f);fr=re.findall(r'foot r .*?lowest vertex above the surface mm (-?[\d.]+)',f)
    d['feet']=[float(fl[-1]),float(fr[-1])]
    d['lean']=lean
    return d
LEAN={'A1':24,'A2':28,'A3':38,'A4':50,'A5':54}
M={}
for b in LEAN:
    M['w_'+b]=parse(f'res3/v_{b}.txt',f'res3/w_{b}_f.txt',LEAN[b])
    M['m_'+b]=parse(f'res3/vm_{b}.txt',f'res3/m_{b}_f.txt',LEAN[b])
json.dump(M,open('metrics2.json','w'),indent=1)
for k,v in M.items():print(k,v['bytes'],v['tris'],v['pen'],v['gt2'],v['holes'],v['seatpt'],v['air'],v['clipverts'],v['clipmax'],v['feet'])
