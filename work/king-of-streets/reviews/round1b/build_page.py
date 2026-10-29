# Writes index.html for the round 1 review, second try. Run from this folder: python3 build_page.py
import html
items=[
 dict(id='A1',kind='Level 1: scooter',tris=45000,mb=1.50,parts=10,
  said='"A1 still has the same bad finish with crooked border between white and blue."',
  found='My mistake in the build, not the model. The blue and white panels are separate pieces that meet along a seam. To save triangles I thinned every piece, so the two sides of each seam stopped lining up and the border went crooked and soft. The second try only changed the texture size, which did not touch the cause.',
  did=['Every large body panel now keeps every triangle exactly as the original model has it. Only small hidden pieces (bolts, engine parts) are thinned.','Compared with the original model from the same camera positions: fewer than 1 in 100 pixels differ noticeably, and the borders sit where the original has them.','To pay for that, A1 has 45,000 triangles. I changed the bike budget from 30,000 to 45,000 (about 7 bikes on screen is still far under the phone limit).'],
  note='The seat, indicator lamp and tail lamp differ slightly from the original because their small details were thinned. Look at the border picture first: it shows the second try, the new file and the original model at the same spot.',extra='A1_border'),
 dict(id='A2',kind='Level 2: 125 cc commuter',tris=43769,mb=0.87,parts=21,
  said='(Same cause as A1, found when I checked every bike.)',
  found='A2 had been thinned from 43,769 to 30,000 triangles, which can bend panel borders the same way.',
  did=['Rebuilt with all 43,769 triangles, nothing thinned.','Last round: swingarm shine reduced, chain kept still, spokes turn with the rim.'],
  note='The swingarm is still a big flat box because the source modelled it that way. I can swap it for a slimmer shape if it still bothers you. The source does not say 125 cc, and it is a trail bike.'),
 dict(id='A3',kind='Level 3: 135 cc street bike',tris=21630,mb=0.67,parts=14,
  said='Unchanged since the last round. It was never thinned, so it was not affected.',
  found='Last round you asked: "Why are chains hanging out on A3?"',
  did=['Removed the drive chain, the thin rods and straps along the swingarm, and the loose orange cables around the front fork and handlebar.'],
  note='A short orange cable stub by the front brake and one thin white rod near the rear hub may still show up close.'),
 dict(id='A4',kind='Level 4: sport bike',tris=27023,mb=0.54,parts=11,
  said='Unchanged since the last round. It was never thinned, so it was not affected.',
  found='Last round you said the border of the wheels did not rotate (all bikes).',
  did=['Tyre, rim, brake disc and sprocket all turn. The fork, caliper, swingarm and chain stay still.'],
  note='The source is a 750, and the plan says 600 cc. Nothing in the game states an engine size.'),
 dict(id='A5',kind='Level 5: hyper bike',tris=34913,mb=0.66,parts=10,
  said='(Same cause as A1, found when I checked every bike.)',
  found='A5 had been thinned from 34,913 to 30,000 triangles.',
  did=['Rebuilt with all 34,913 triangles, nothing thinned.','Tyre, rim, disc and sprocket all turn. Fork, caliper, swingarm and chain stay still.'],
  note='The bike is still the black recolour of the source, which is white.'),
]
def card(it):
    i=it['id']
    did=''.join(f'<li>{html.escape(d)}</li>' for d in it['did'])
    thumbs=''.join(f'<li><button type="button" class="th" data-big="img/{i}_{k}.jpg" data-cap="{cap}" aria-label="{cap}"><img src="img/{i}_{k}.jpg" alt="{html.escape(it["kind"])}, {cap}" loading="lazy" width="786" height="540"></button></li>' for k,cap in [('side','Side'),('front34','Front three-quarter'),('rear34','Rear three-quarter'),('rear','Rear'),('close','Close up'),('wheelR','Rear wheel at rest'),('wheelR_turned','Same wheel, turned'),('wheelF','Front wheel')])
    thumbs+=f'<li class="phone"><button type="button" class="th" data-big="img/{i}_race.jpg" data-cap="Race distance, phone upright" aria-label="Race distance, phone upright"><img src="img/{i}_race.jpg" alt="{html.escape(it["kind"])} at race distance" loading="lazy" width="590" height="1278"></button></li>'
    extra_html=(f'<figure class="turnmap"><img src="img/{it["extra"]}.jpg" alt="Border close-ups: second try, new, original model" loading="lazy" width="2400" height="1066"><figcaption>Where the blue and white panels meet, from the same camera: the rejected second try, the new file, and the original model.</figcaption></figure>' if it.get('extra') else '')
    return f'''<article class="card" id="{i}" data-id="{i}">
<header class="ch"><span class="idtag">{i}</span><div><h2>{html.escape(it["kind"])}</h2></div><span class="status">reworked, to review</span></header>
<blockquote class="said"><span class="lab">What this is about</span>{html.escape(it["said"])}</blockquote>
<p class="found"><span class="lab">What was wrong</span>{html.escape(it["found"])}</p>
{extra_html}<div class="ba"><figure><img src="img/{i}_before_side.jpg" alt="Before, side" loading="lazy" width="786" height="540"><figcaption>Before</figcaption></figure><figure><img src="img/{i}_side.jpg" alt="After, side" loading="lazy" width="786" height="540"><figcaption>After</figcaption></figure></div>
<figure class="stage"><img class="big" src="img/{i}_wheelR_turned.jpg" alt="Rear wheel turned" width="786" height="540"><canvas class="live" hidden role="img" aria-label="{html.escape(it["kind"])}, drag to turn it"></canvas><figcaption class="cap">Same wheel, turned</figcaption></figure>
<ul class="strip" aria-label="Other views">{thumbs}</ul>
<div class="actions"><button type="button" class="btn spin">Spin it here</button><button type="button" class="btn ghost wheels" hidden aria-pressed="true">Wheels turning</button><button type="button" class="btn ghost back" hidden>Back to pictures</button></div>
<p class="live-msg" hidden></p>
<figure class="turnmap"><img src="img/{i}_turn.jpg" alt="Parts that turn with each wheel, in red and blue" loading="lazy" width="1000" height="420"><figcaption>Parts that turn with the wheels: front in red, rear in blue. Everything grey stays still.</figcaption></figure>
<h3>What I changed</h3><ul class="did">{did}</ul>
<p class="note"><b>Still open.</b> {html.escape(it["note"])}</p>
<dl class="facts"><div><dt>Triangles</dt><dd>{it["tris"]:,} <small>of 45,000</small></dd></div><div><dt>File</dt><dd>{it["mb"]:.2f} MB <small>of 1.5</small></dd></div><div><dt>Parts drawn</dt><dd>{it["parts"]} <small>of 30</small></dd></div></dl>
</article>'''
body='\n'.join(card(it) for it in items)
page='''<title>King of Streets Bikes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: one column of item cards. Each card: your words, the cause, before and after, a live 3D viewer, the parts that turn, facts. */
:root{--bg:#eceef0;--surface:#fff;--surface2:#e2e5e9;--fg:#15191d;--muted:#5a6570;--line:#cfd5db;--accent:#c4410f;--accent-fg:#fff;--ok:#1d7a46;--warn:#9a5b00;
--display:"Barlow Condensed","Arial Narrow",Arial,sans-serif;--body:"Barlow",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#5bd08b;--warn:#f0b34a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#5bd08b;--warn:#f0b34a;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:var(--body);font-size:16px;line-height:1.5;padding-block:20px 48px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.wrap{max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:20px}
h1,h2,h3{font-family:var(--display);margin:0;text-wrap:balance;line-height:1.1}
h1{font-size:2.2rem;letter-spacing:.01em}
.eyebrow,.lab{font-family:var(--mono);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.lab{display:block;margin-bottom:2px}
.intro{display:flex;flex-direction:column;gap:8px}
.intro p{margin:0;max-width:62ch}
.how{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:.95rem}
.how b{font-family:var(--mono);font-weight:500}
.card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:12px;min-width:0}
.ch{display:flex;gap:12px;align-items:flex-start}
.ch>div{flex:1;min-width:0}
.idtag{font-family:var(--display);font-weight:700;font-size:1.5rem;line-height:1;background:var(--accent);color:var(--accent-fg);padding:6px 9px;border-radius:6px}
h2{font-size:1.45rem}
.status{font-family:var(--mono);font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);border:1px solid currentColor;border-radius:99px;padding:2px 8px;white-space:nowrap}
.said{margin:0;padding:10px 12px;border-left:3px solid var(--accent);background:var(--surface2);border-radius:0 8px 8px 0}
.found{margin:0}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ba figure{margin:0;position:relative;min-width:0}
.ba img{display:block;width:100%;height:auto;border-radius:8px;background:var(--surface2)}
.ba figcaption{position:absolute;left:6px;bottom:6px;font-family:var(--mono);font-size:.68rem;background:rgba(0,0,0,.65);color:#fff;padding:2px 6px;border-radius:4px}
.stage{margin:0;position:relative;background:var(--surface2);border-radius:8px;overflow:hidden;aspect-ratio:786/540;max-width:100%}
.stage img.big,.stage canvas{display:block;width:100%;height:100%;object-fit:cover}
.stage canvas{touch-action:none;cursor:grab}
.cap{position:absolute;left:8px;bottom:8px;font-family:var(--mono);font-size:.7rem;background:rgba(0,0,0,.65);color:#fff;padding:2px 7px;border-radius:4px}
.strip{list-style:none;margin:0;padding:0 0 4px;display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.strip li{flex:0 0 auto;scroll-snap-align:start;height:84px}
.th{all:unset;display:block;height:100%;cursor:pointer;border-radius:6px;overflow:hidden;border:2px solid transparent}
.th[aria-current="true"]{border-color:var(--accent)}
.th:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.th img{height:100%;width:auto;display:block;max-width:none}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{font:600 .95rem var(--body);border:0;border-radius:8px;padding:10px 14px;background:var(--accent);color:var(--accent-fg);cursor:pointer;min-height:44px}
.btn.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
.btn[aria-pressed="true"]{background:var(--surface2)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.live-msg{margin:0;font-size:.9rem;color:var(--warn)}
.turnmap{margin:0}
.turnmap img{display:block;width:100%;height:auto;border-radius:8px;background:var(--surface2)}
.turnmap figcaption{font-size:.85rem;color:var(--muted);margin-top:4px}
h3{font-size:1rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.did{margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:4px}
.note{margin:0;padding:10px 12px;border-left:3px solid var(--warn);background:var(--surface2);border-radius:0 8px 8px 0;font-size:.93rem}
.facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0}
.facts div{background:var(--surface2);border-radius:8px;padding:8px 10px;min-width:0}
.facts dt{font-family:var(--mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.facts dd{margin:2px 0 0;font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:.95rem}
.facts small{color:var(--muted);font-size:.72rem;display:block}
.credit{margin:0;font-size:.8rem;color:var(--muted)}
a{color:var(--accent)}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
<div class="wrap">
<header class="intro"><span class="eyebrow">King of Streets · Phase 1 · Round 1, third try</span><h1>The five bikes, third try</h1>
<p>A1 was rejected again for its crooked blue and white border. I found the real cause in my build (below), and the same cause could affect A2 and A5, so those are rebuilt too. A3 and A4 were never thinned and are unchanged.</p></header>
<div class="how"><b>Reply in the chat:</b> "approved", or the IDs that still need work and what is wrong. "Spin it here" loads the real file on your phone: drag to turn the bike and tap "Wheels turning" to see the wheels go round.</div>
'''+body+'''
<footer class="credit">Models are credited in work/king-of-streets/credits.md (CC BY 4.0, changed as described). Makers' logos are removed throughout. Nothing here is on the site.</footer>
</div>
<script type="module">
const $=(s,r=document)=>r.querySelector(s);
let active=null;
async function closeLive(card){
  const st=card._st; if(!st) return;
  cancelAnimationFrame(st.raf); st.stage.dispose(); card._st=null;
  $('.live',card).hidden=true; $('.big',card).hidden=false;
  $('.back',card).hidden=true;$('.wheels',card).hidden=true;$('.spin',card).hidden=false;$('.live-msg',card).hidden=true;
  $('.cap',card).textContent=$('.big',card).dataset.cap||'Same wheel, turned'; if(active===card) active=null;
}
document.addEventListener('click',async e=>{
  const th=e.target.closest('.th');
  if(th){const card=th.closest('.card');await closeLive(card);const big=$('.big',card);big.src=th.dataset.big;big.dataset.cap=th.dataset.cap;$('.cap',card).textContent=th.dataset.cap;
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
      const stage=await createStage(canvas,{width:box.clientWidth,height:box.clientHeight,dpr:window.devicePixelRatio||1,hdrUrl:'daylight.wav'});
      await stage.load('bikes/'+card.dataset.id+'.wav');
      let yaw=0.55,spinA=0,wheelsOn=true,dirty=true,drag=null;
      const st={stage,raf:0};card._st=st;active=card;
      const frame=()=>{if(wheelsOn){spinA-=0.16;stage.spin(spinA);dirty=true}
        if(dirty){stage.view('front34',{yaw:yaw-0.55});stage.render();dirty=false}
        st.raf=requestAnimationFrame(frame)};
      canvas.addEventListener('pointerdown',ev=>{drag={x:ev.clientX};canvas.setPointerCapture(ev.pointerId)});
      canvas.addEventListener('pointermove',ev=>{if(!drag)return;yaw-=(ev.clientX-drag.x)*0.01;drag.x=ev.clientX;dirty=true});
      const end=()=>{drag=null};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
      const wb=$('.wheels',card);wb.setAttribute('aria-pressed','true');wb.onclick=ev=>{wheelsOn=!wheelsOn;ev.currentTarget.setAttribute('aria-pressed',String(wheelsOn));ev.currentTarget.textContent=wheelsOn?'Wheels turning':'Wheels stopped'};wb.textContent='Wheels turning';
      $('.spin',card).hidden=true;$('.back',card).hidden=false;wb.hidden=false;
      $('.cap',card).textContent='Drag to turn';msg.hidden=true;frame();
    }catch(err){
      $('.live',card).hidden=true;$('.big',card).hidden=false;
      msg.hidden=false;msg.textContent='The 3D view could not start here ('+(err&&err.message?err.message:'unknown error')+'). The pictures are drawn from the same file.';
    }
    return;
  }
  if(e.target.closest('.back')) await closeLive(e.target.closest('.card'));
});
</script>
'''
open('index.html','w').write(page)
print(len(page))
