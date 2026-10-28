# Writes index.html for the round 1 review (bikes). Run from this folder: python3 build_page.py
import html,json
items=[
 dict(id='A1',lvl='Level 1',kind='Scooter',tris=29999,mb=0.94,mats=5,parts=10,
  src='Vino',by='minghauLoh',url='https://sketchfab.com/3d-models/vino-2205f4e69bc64df3aab03c71ab9d7492',
  req='The weakest bike; the player starts on it.',
  did=['Removed a Japanese beginner-driver sticker.','Cut from 95,583 to 29,999 triangles; wheels are separate parts so they can spin.','Textures shrunk from 4096 px to 1024 px.'],
  note='No maker lettering was on this model.'),
 dict(id='A2',lvl='Level 2',kind='125 cc commuter',tris=30000,mb=1.30,mats=16,parts=28,
  src='Honda NXR Bros 2003',by='andersonfo',url='https://sketchfab.com/3d-models/honda-nxr-bros-2003-2e88ff65e98e4d0c802242bdeccaf28d',
  req='Side stand up when ridden.',
  did=['Removed the "BROS" lettering from both tank panels and the embossed "HONDA" on the engine cover.','Cut from 43,769 to 30,000 triangles, keeping the spoked wheels whole.','No side stand is modelled, so it is up.'],
  note='Needs your call: this is a trail-style bike, not a plain commuter, and the source does not give its engine size. The only plainer 125 I found (a red Honda CG-style bike) had a smeared, blocky texture and flat grey wheel discs, so I dropped it.'),
 dict(id='A3',lvl='Level 3',kind='135 cc street bike',tris=24382,mb=1.14,mats=7,parts=15,
  src='pulsar 135 ls',by='EmanuelRestrepoVelez',url='https://sketchfab.com/3d-models/pulsar-135-ls-36d04d99171e4d59b540c25d8650dbd5',
  req='A 135 cc street bike, between the commuter and the 600 cc sport bike.',
  did=['Removed the "pulsar" script on the tank and tail, and the hexagon badge on both tank sides (colour and bump maps).','Turned it round to face forward; wheels are separate parts.','Already under budget, so no triangles were removed.'],
  note='Brake caliper and fork look a little low-poly up close.'),
 dict(id='A4',lvl='Level 4',kind='Sport bike',tris=27023,mb=0.56,mats=6,parts=13,
  src='Suzuki GSXR 750',by='kaleemullah550',url='https://sketchfab.com/3d-models/suzuki-gsxr-750-3e05cd872ef0458ca3d6b0770bb03622',
  req='A sport bike, faster than A3.',
  did=['Removed "SUZUKI" on both lower fairings and the front, the "GSX-R" decals, the "S" emblems (fairing, tank, handlebar clamp), the label on the number plate and a game logo that was printed on it.','Wheels are separate parts. Already under budget.'],
  note='The source is a 750, and the plan says 600 cc. Nothing in the game will state an engine size unless you want it to. Tiny tyre-maker text on the tyre sidewalls is still there.'),
 dict(id='A5',lvl='Level 5',kind='Hyper bike',tris=30000,mb=0.63,mats=5,parts=12,
  src='kawasaki ninja h2r',by='amogusstrikesback2',url='https://sketchfab.com/3d-models/kawasaki-ninja-h2r-c8e3a10263d44c9baf8fc33d606a51bf',
  req='The best bike.',
  did=['Removed the "Kawasaki" lettering on the tank and the "Ninja" and "H2R" script on the side panels and tail.','Turned the white bodywork black (the source is white).','Cut from 34,913 to 30,000 triangles; wheels are separate parts.'],
  note='Tiny tyre-maker text on the tyre sidewalls is still there.'),
]
def card(it):
    i=it['id']
    thumbs=''.join(f'<li><button type="button" class="th" data-big="img/{i}_{k}.jpg" data-cap="{cap}" aria-label="{cap}"><img src="img/{i}_{k}.jpg" alt="{html.escape(it["kind"])}, {cap}" loading="lazy" width="786" height="540"></button></li>' for k,cap in [('side','Side'),('front34','Front three-quarter'),('rear34','Rear three-quarter'),('rear','Rear'),('close','Close up')])
    thumbs+=f'<li class="phone"><button type="button" class="th" data-big="img/{i}_race.jpg" data-cap="Race distance, phone upright" aria-label="Race distance, phone upright"><img src="img/{i}_race.jpg" alt="{html.escape(it["kind"])} at race distance, phone upright" loading="lazy" width="590" height="1278"></button></li>'
    did=''.join(f'<li>{html.escape(d)}</li>' for d in it['did'])
    return f'''<article class="card" id="{i}" data-id="{i}">
<header class="ch"><span class="idtag">{i}</span><div><h2>{it["lvl"]}: {html.escape(it["kind"])}</h2><p class="req">{html.escape(it["req"])}</p></div><span class="status">to review</span></header>
<figure class="stage"><img class="big" src="img/{i}_side.jpg" alt="{html.escape(it["kind"])}, side" width="786" height="540"><canvas class="live" hidden role="img" aria-label="{html.escape(it["kind"])}, drag to turn it"></canvas><figcaption class="cap">Side</figcaption></figure>
<ul class="strip" aria-label="Other views">{thumbs}</ul>
<div class="actions"><button type="button" class="btn spin">Spin it here</button><button type="button" class="btn ghost wheels" hidden aria-pressed="false">Turn wheels</button><button type="button" class="btn ghost back" hidden>Back to pictures</button></div>
<p class="live-msg" hidden></p>
<dl class="facts">
<div><dt>Triangles</dt><dd>{it["tris"]:,} <small>of 30,000</small></dd></div>
<div><dt>File</dt><dd>{it["mb"]:.2f} MB <small>of 1.5</small></dd></div>
<div><dt>Parts drawn</dt><dd>{it["parts"]} <small>{it["mats"]} materials</small></dd></div>
</dl>
<h3>What was done</h3><ul class="did">{did}</ul>
<p class="note"><b>Note.</b> {html.escape(it["note"])}</p>
<p class="credit">Model: <a href="{it["url"]}" target="_blank" rel="noopener">{html.escape(it["src"])}</a> by {html.escape(it["by"])}, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, changed as listed.</p>
</article>'''
body='\n'.join(card(it) for it in items)
page='''<title>King of Streets Bikes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: one column of item cards, each a picture stage, a strip of other views, a live 3D viewer, facts and notes. */
:root{--bg:#eceef0;--surface:#fff;--surface2:#e2e5e9;--fg:#15191d;--muted:#5a6570;--line:#cfd5db;--accent:#c4410f;--accent-fg:#fff;--ok:#1d7a46;--warn:#9a5b00;
--display:"Barlow Condensed","Arial Narrow",Arial,sans-serif;--body:"Barlow",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#5bd08b;--warn:#f0b34a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#5bd08b;--warn:#f0b34a;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:var(--body);font-size:16px;line-height:1.5;padding-block:20px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.wrap{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
h1,h2,h3{font-family:var(--display);margin:0;text-wrap:balance;line-height:1.1}
h1{font-size:2.2rem;letter-spacing:.01em}
.eyebrow{font-family:var(--mono);font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.intro{display:flex;flex-direction:column;gap:8px}
.intro p{margin:0;max-width:62ch}
.how{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:.95rem}
.how b{font-family:var(--mono);font-weight:500}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0}
.ch{display:flex;gap:12px;align-items:flex-start}
.ch>div{flex:1;min-width:0}
.idtag{font-family:var(--display);font-weight:700;font-size:1.5rem;line-height:1;background:var(--accent);color:var(--accent-fg);padding:6px 9px;border-radius:6px}
h2{font-size:1.45rem}
.req{margin:2px 0 0;color:var(--muted);font-size:.95rem}
.status{font-family:var(--mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);border:1px solid currentColor;border-radius:99px;padding:2px 8px;white-space:nowrap}
.stage{margin:0;position:relative;background:var(--surface2);border-radius:8px;overflow:hidden;aspect-ratio:786/540}
.stage img.big,.stage canvas{display:block;width:100%;height:100%;object-fit:cover}
.stage canvas{touch-action:none;cursor:grab}
.cap{position:absolute;left:8px;bottom:8px;font-family:var(--mono);font-size:.7rem;background:rgba(0,0,0,.6);color:#fff;padding:2px 7px;border-radius:4px}
.strip{list-style:none;margin:0;padding:0;display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;padding-bottom:4px}
.strip li{flex:0 0 auto;scroll-snap-align:start;height:84px}
.strip .phone{height:84px}
.th{all:unset;display:block;height:100%;cursor:pointer;border-radius:6px;overflow:hidden;outline-offset:2px;border:2px solid transparent}
.th[aria-current="true"]{border-color:var(--accent)}
.th:focus-visible{outline:2px solid var(--accent)}
.th img{height:100%;width:auto;display:block;max-width:none}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{font:600 .95rem var(--body);border:0;border-radius:8px;padding:10px 14px;background:var(--accent);color:var(--accent-fg);cursor:pointer;min-height:44px}
.btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn[aria-pressed="true"]{background:var(--surface2)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.live-msg{margin:0;font-size:.9rem;color:var(--warn)}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0}
.facts div{background:var(--surface2);border-radius:8px;padding:8px 10px;min-width:0}
.facts dt{font-family:var(--mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.facts dd{margin:2px 0 0;font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:.95rem}
.facts small{color:var(--muted);font-size:.72rem;display:block}
h3{font-size:1rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.did{margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:4px}
.note{margin:0;padding:10px 12px;border-left:3px solid var(--warn);background:var(--surface2);border-radius:0 8px 8px 0;font-size:.93rem}
.credit{margin:0;font-size:.8rem;color:var(--muted)}
a{color:var(--accent)}
@media (max-width:420px){.facts{grid-template-columns:1fr 1fr 1fr}.facts dd{font-size:.85rem}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
<div class="wrap">
<header class="intro"><span class="eyebrow">King of Streets · Phase 1 · Round 1 of 7</span><h1>The five bikes</h1>
<p>Each bike below is the exact file the game will load, drawn with the game's own settings in plain daylight. Rider, helmet and weapons come in later rounds.</p></header>
<div class="how"><b>Reply in the chat:</b> "approved", or the IDs that need work and what is wrong. Tap a small picture to enlarge it. "Spin it here" loads the real file on your phone and lets you turn the bike with your finger.</div>
'''+body+'''
<footer class="credit">Free models only, credited as above. Makers' logos are removed throughout. Nothing here is on the site.</footer>
</div>
<script type="module">
const $=(s,r=document)=>r.querySelector(s);
let active=null;
async function closeLive(card){
  const st=card._st; if(!st) return;
  cancelAnimationFrame(st.raf); st.stage.dispose(); card._st=null;
  $('.live',card).hidden=true; $('.big',card).hidden=false;
  $('.back',card).hidden=true;$('.wheels',card).hidden=true;$('.spin',card).hidden=false;$('.live-msg',card).hidden=true;
  $('.cap',card).textContent='Side'; if(active===card) active=null;
}
document.addEventListener('click',async e=>{
  const th=e.target.closest('.th');
  if(th){const card=th.closest('.card');await closeLive(card);const big=$('.big',card);big.src=th.dataset.big;$('.cap',card).textContent=th.dataset.cap;
    card.querySelectorAll('.th').forEach(b=>b.removeAttribute('aria-current'));th.setAttribute('aria-current','true');
    big.style.objectFit=th.dataset.big.endsWith('_race.jpg')?'contain':'cover';return}
  const spin=e.target.closest('.spin');
  if(spin){
    const card=spin.closest('.card'),msg=$('.live-msg',card);
    if(active&&active!==card) await closeLive(active);
    msg.hidden=false;msg.textContent='Loading the bike…';
    try{
      const {createStage}=await import('./stage.js');
      const canvas=$('.live',card),box=$('.stage',card);
      canvas.hidden=false;$('.big',card).hidden=true;
      const w=box.clientWidth,h=box.clientHeight;
      const stage=await createStage(canvas,{width:w,height:h,dpr:window.devicePixelRatio||1,hdrUrl:'daylight.hdr'});
      await stage.load('bikes/'+card.dataset.id+'.glb');
      let yaw=0.55,spinA=0,wheelsOn=false,dirty=true,drag=null;
      const st={stage,raf:0};card._st=st;active=card;
      const frame=()=>{if(wheelsOn){spinA-=0.18;stage.spin(spinA);dirty=true}
        if(dirty){stage.view('front34',{yaw:yaw-0.55});stage.render();dirty=false}
        st.raf=requestAnimationFrame(frame)};
      canvas.addEventListener('pointerdown',ev=>{drag={x:ev.clientX};canvas.setPointerCapture(ev.pointerId)});
      canvas.addEventListener('pointermove',ev=>{if(!drag)return;yaw-=(ev.clientX-drag.x)*0.01;drag.x=ev.clientX;dirty=true});
      const end=()=>{drag=null};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
      $('.wheels',card).onclick=ev=>{wheelsOn=!wheelsOn;ev.currentTarget.setAttribute('aria-pressed',String(wheelsOn))};
      $('.spin',card).hidden=true;$('.back',card).hidden=false;$('.wheels',card).hidden=false;
      $('.cap',card).textContent='Drag to turn';msg.hidden=true;frame();
    }catch(err){
      canvas_fail(card,err);
    }
    return;
  }
  if(e.target.closest('.back')) await closeLive(e.target.closest('.card'));
});
function canvas_fail(card,err){
  $('.live',card).hidden=true;$('.big',card).hidden=false;
  const m=$('.live-msg',card);m.hidden=false;m.textContent='The 3D view could not start here ('+(err&&err.message?err.message:'unknown error')+'). The pictures above are drawn from the same file.';
}
</script>
'''
open('index.html','w').write(page)
print(len(page))
