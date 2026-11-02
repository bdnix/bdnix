import json,subprocess,sys,os
cfg=json.load(open('/tmp/claude-0/work/bikes.json'))
os.chdir('/tmp/claude-0/work')
def views(B):
    c=cfg[B]['grip']['c'];px,pz,py=cfg[B]['peg'][0],cfg[B]['peg'][1],cfg[B]['peg'][2]
    x,y,z=c
    V=[{"name":"side","pos":[4.7,0.95,0.1],"look":[0,0.95,0.1],"fov":24},
       {"name":"front34","pos":[3.1,1.5,3.5],"look":[0,0.9,0.1],"fov":26},
       {"name":"rear34","pos":[-3.1,1.5,-3.5],"look":[0,0.9,0.1],"fov":26},
       {"name":"rear","pos":[0,1.25,-5.2],"look":[0,0.9,0.1],"fov":24},
       {"name":"handL","pos":[x+0.50,y+0.30,z+0.42],"look":[x,y,z],"fov":13},
       {"name":"handLunder","pos":[x+0.38,y-0.40,z+0.22],"look":[x,y,z],"fov":13},
       {"name":"handR","pos":[-x-0.50,y+0.30,z+0.42],"look":[-x,y,z],"fov":13},
       {"name":"handRunder","pos":[-x-0.38,y-0.40,z+0.22],"look":[-x,y,z],"fov":13},
       {"name":"footL","pos":[px+0.75,py+0.2,pz+0.55],"look":[px,py+0.02,pz],"fov":14},
       {"name":"footR","pos":[-px-0.75,py+0.2,pz+0.55],"look":[-px,py+0.02,pz],"fov":14},
       {"name":"race","pos":[0,1.9,-4.6],"look":[0,0.6,2],"fov":50,"w":393,"h":852,"dpr":2}]
    return V
R,B,T=sys.argv[1:4]
json.dump(views(B),open(f'res/views_{B}.json','w'))
out=f'res/img_{R}_{B}'
r=subprocess.run(['node','views3.mjs',out,f'/work/king-of-streets/models/bikes/{B}.glb',f'/files/res/{R}_{B}{T}_ship.glb',f'res/views_{B}.json'],capture_output=True,text=True)
print(R,B,r.stdout.strip(),r.stderr.strip()[:200])
