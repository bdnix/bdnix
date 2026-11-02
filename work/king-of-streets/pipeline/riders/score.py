import re,sys
def score(path):
    t=open(path).read()
    pens=[float(x) for x in re.findall(r'penetration ([\d.]+) mm',t)]
    gt2=[int(x) for x in re.findall(r'more than 2 mm inside the grip: (\d+)',t)]
    unc=[float(x) for x in re.findall(r'= ([\d.]+)%',t)]
    feet=[float(x) for x in re.findall(r'lowest vertex above the surface mm (-?[\d.]+)',t)]
    sole=[float(x) for x in re.findall(r'sole height vs peg top mm (-?[\d.]+)',t)]
    m=re.search(r'inside the bike volume \(3 of 4 ray votes\) by >2 mm: (\d+)',t);ins=int(m.group(1)) if m else 999
    d=re.search(r'depth ([\d.]+) mm at bike',t);maxd=float(d.group(1)) if d else 0
    if len(pens)<2 or len(feet)<2:return 1e9,{}
    sc=sum(pens)*2+sum(gt2)*6+sum(max(0,u-25) for u in unc)*0.5+sum(abs(f-1.0)*2 for f in feet)+ins*0.15+maxd*0.8+sum(max(0,abs(z)-12)*3 for z in sole)
    return sc,dict(pen=pens,gt2=gt2,unc=unc,feet=feet,sole=sole,inside=ins,maxdepth=maxd)
if __name__=='__main__':
    for p in sys.argv[1:]:print(p,score(p))
