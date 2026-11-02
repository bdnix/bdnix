import re,json,subprocess,os
os.chdir('/tmp/claude-0/work')
out={}
for r in ('sophia','eric'):
    for b in ('A1','A2','A3','A4','A5'):
        t=open(f'res/v_{r}_{b}.txt').read();f=open(f'res/{r}_{b}_f.txt').read()
        ship=re.search(r'bytes (\d+) tris (\d+)',t)
        pen=[float(x) for x in re.findall(r'penetration ([\d.]+) mm',t)];gt=[int(x) for x in re.findall(r'more than 2 mm inside the grip: (\d+)',t)]
        g2=subprocess.run(['/tmp/claude-0/venv/bin/python','gaps2.py',f'res/{r}_{b}_f_shipcheck.glb'],capture_output=True,text=True,env={**os.environ,'BIKE':b}).stdout
        gaps=re.findall(r'(left|right) hand: hand spans ([\d.]+) cm of the grip; slices with no hand over the first 60 deg between fingers: (\d+) of (\d+) \(longest (\d+) mm\); uncovered rays inside the wrapped arc: ([\d.]+)%',g2)
        fg=[float(x) for x in re.findall(r'lowest vertex above the surface mm (-?[\d.]+)',f)];sole=[float(x) for x in re.findall(r'sole height vs peg top mm (-?[\d.]+)',f)]
        sd=re.search(r'depth mm: max ([\d.]+)',t);m=re.search(r'inside the bike volume \(3 of 4 ray votes\) by >2 mm: (\d+)',t);d=re.search(r'depth ([\d.]+) mm at bike',t)
        reach=[float(x) for x in re.findall(r'reach ([\d.]+)',f)]
        sett=re.search(r'settings (.*)',f).group(1)
        out[f'{r}_{b}']=dict(kb=int(ship.group(1))/1024,tris=int(ship.group(2)),pen=pen,gt2=gt,gaps=[dict(h=g[0],span=float(g[1]),gapslices=int(g[2]),longest=int(g[4]),holes=float(g[5])) for g in gaps],
          feetgap=fg,sole=sole,seat=float(sd.group(1)) if sd else 0.0,clipverts=int(m.group(1)) if m else None,clipmax=float(d.group(1)) if d else 0.0,reach=reach,settings=sett)
json.dump(out,open('res/metrics.json','w'),indent=1)
for k,v in out.items():print(k,v['kb'].__round__(),v['tris'],v['pen'],v['gt2'],[g['gapslices'] for g in v['gaps']],[g['holes'] for g in v['gaps']],v['feetgap'],v['sole'],v['seat'],v['clipverts'],v['clipmax'])
