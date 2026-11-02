# Writes index.html for the round 2 review (riders, helmet, riders on bikes). Run from this folder: python3 build_page.py
import html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, 'metrics.json')))
SHIP = os.path.join(HERE, '..', '..', 'models', 'riders')
H = html.escape

BIKES = {
    'A1': 'A1 scooter', 'A2': 'A2 125 cc commuter', 'A3': 'A3 135 cc street bike',
    'A4': 'A4 sport bike', 'A5': 'A5 hyper bike',
}
RIDERS = {'eric': ('B1', 'man'), 'sophia': ('B2', 'woman')}


def size_kb(name):
    return os.path.getsize(os.path.join(SHIP, name)) / 1024


def lean_of(settings):
    return int(re.search(r'LEAN=(\d+)', settings).group(1))


def mm(x):
    return f'{x:.1f}'.rstrip('0').rstrip('.')


# ---------------------------------------------------------------- items
items = []

items.append(dict(
    id='B1', kind='Male rider, standing, with the helmet', group='b', folder='B1',
    shots=[('front', 'Front'), ('side', 'Side'), ('back', 'Back'), ('q', 'Three-quarter'),
           ('head34', 'Head, three-quarter'), ('headfront', 'Head, front'), ('headside', 'Head, side'), ('headback', 'Head, back')],
    reqs=[
        ('part', 'Everyday clothes', 'White shirt, waistcoat, tie, trousers and leather shoes: everyday work clothes, not a riding suit, but not casual. I found no free, realistic, rigged man in a T-shirt and jeans.'),
        ('met', 'A straight back', 'The spine stays straight. On a bike he leans from the hips (see C1 to C5).'),
        ('met', 'No face or hair showing', 'His face and hair are removed and the helmet covers the head. Only the neck shows between the helmet and the collar.'),
        ('met', 'A smooth finish, no gap where clothes meet', 'Shirt, waistcoat and trousers meet cleanly in every view I drew.'),
    ],
    facts=[('Source', 'Eric Rigged 001, Renderpeople, CC BY'), ('Triangles', '11,505 body + 5,467 helmet = 16,972 of 20,000'),
           ('File', f'{size_kb("B1.glb"):.0f} KB of 500'), ('Parts drawn', '2 of 6')],
    note='Decision for you: keep the waistcoat and tie, or I keep looking for a rigged man in a T-shirt and jeans. His left arm is a little shorter than his right in the source.',
))

items.append(dict(
    id='B2', kind='Female rider, standing, with the helmet', group='b', folder='B2',
    shots=[('front', 'Front'), ('side', 'Side'), ('back', 'Back'), ('q', 'Three-quarter'),
           ('head34', 'Head, three-quarter'), ('headfront', 'Head, front'), ('headside', 'Head, side'), ('headback', 'Head, back')],
    reqs=[
        ('met', 'Everyday clothes', 'Jeans, a white sleeveless top and flat shoes. Her arms are bare.'),
        ('met', 'A straight back', 'The spine stays straight; she leans from the hips on a bike (C6 to C10).'),
        ('met', 'No face or hair showing, no ponytail out of the helmet', 'All of her hair is removed. The helmet covers the head.'),
        ('met', 'Told apart from B1 at a glance from the game\'s camera', 'White top and jeans against a dark waistcoat and trousers, and a blue helmet accent against red. At race distance both are small (see the phone pictures in C1 and C6).'),
        ('no', 'A smooth finish, no gap where clothes meet', 'Not met. Her hair was painted onto the top in the source picture. I repainted those patches as plain white cloth, and the top\'s upper edge, around the neck and shoulders, looks torn close up. It is small at race distance.'),
    ],
    facts=[('Source', 'Sophia Animated 003, Renderpeople, CC BY, with her top repainted'), ('Triangles', '9,866 body + 6,276 helmet = 16,142 of 20,000'),
           ('File', f'{size_kb("B2.glb"):.0f} KB of 500'), ('Parts drawn', '2 of 6')],
    note='Decision for you: accept the ragged top edge, or I look for another woman. The two I tried first, Claudia and Carla from the same maker, wear stiletto heels that cannot go on a peg.',
))

items.append(dict(
    id='B3', kind='Full-face helmet, in each rider\'s colour', group='b', folder='B3',
    shots=[('B1_hfront', 'Man, front'), ('B1_hside', 'Man, side'), ('B1_hback', 'Man, back'), ('B1_h34', 'Man, three-quarter'), ('B1_htop', 'Man, top'),
           ('B2_hfront', 'Woman, front'), ('B2_hside', 'Woman, side'), ('B2_hback', 'Woman, back'), ('B2_h34', 'Woman, three-quarter'), ('B2_htop', 'Woman, top')],
    reqs=[
        ('met', 'A full-face helmet', 'Chin bar, visor and shell, closed all round.'),
        ('part', 'A dark visor', 'The visor is dark, but it is nearly the same black as the shell, so it reads as one black shape except as a thin edge.'),
        ('part', 'In each rider\'s colour', 'The man\'s accents are the helmet\'s own red and the woman\'s are blue, as placeholders. Colours are chosen with the names in Phase 2.'),
    ],
    facts=[('Source', 'Motor Helmet, Tom Verbeeck, CC BY'), ('Triangles', 'man\'s 5,467, woman\'s 6,276 (source: 100,840)'),
           ('Files', f'{size_kb("B3_B1.glb"):.0f} and {size_kb("B3_B2.glb"):.0f} KB'), ('Changed', 'cut from 100,840 triangles; the 64,000-triangle chin-vent pattern dropped; accents recoloured for the woman')],
    note='In the game the helmet is part of each rider file, pinned to the head, so it leans with the rider. These are the same helmets, shown alone.',
))

for n in range(1, 11):
    who = 'eric' if n <= 5 else 'sophia'
    bike = f'A{(n - 1) % 5 + 1}'
    key = f'{who}_{bike}'
    m = M[key]
    rid = RIDERS[who][0]
    items.append(dict(
        id=f'C{n}', kind=f'{rid} ({RIDERS[who][1]}) on {BIKES[bike]}', group='c', folder=f'C{n}', key=key, bike=bike, who=who, m=m, n=n,
        shots=[('side', 'Side'), ('front34', 'Front three-quarter'), ('rear34', 'Rear three-quarter'), ('rear', 'Rear'),
               ('handL', 'Left hand, from above'), ('handLunder', 'Left hand, from underneath'), ('handR', 'Right hand, from above'), ('handRunder', 'Right hand, from underneath'),
               ('footL', 'Left foot'), ('footR', 'Right foot'), ('race', 'Race distance, phone upright')],
    ))


def c_reqs(it):
    m, bike, who = it['m'], it['bike'], it['who']
    pen = m['pen']
    exc = ''
    if m['gt2'][0] or m['gt2'][1]:
        exc = f' One fingertip point on the left hand is {mm(pen[0])} mm inside the grip, the only point past 2 mm.'
    holes = [g['holes'] for g in m['gaps']]
    gl = lambda i: m['gaps'][i]
    r = []
    r.append(('met', 'Fingers closed round the grips',
              f'Both hands wrap over the top and down the front, and the fingertips tuck under. The deepest point of the left hand is {mm(pen[0])} mm inside the grip and of the right hand {mm(pen[1])} mm.'))
    r.append(('met', 'None under the grip or off it',
              f'No part of either hand is more than 2 mm inside the grip.{exc}'))
    r.append(('met', 'The grip does not come out between the fingers',
              f'No gap between fingers on either hand (0 gap slices, measured every 4 mm along the hand). Holes inside the wrapped part: {mm(holes[0])}% left, {mm(holes[1])}% right.'))
    peg = 'floorboard' if bike == 'A1' else 'footpegs'
    fg = m['feetgap']
    r.append(('met', 'Feet on the pegs',
              f'Both feet rest on the {peg}: the lowest point of each is {mm(fg[0])} mm (left) and {mm(fg[1])} mm (right) from the surface, and the soles are within {mm(max(abs(x) for x in m["sole"]))} mm of its height.'))
    r.append(('met', 'Stand up', 'No stand reaches the ground in any of these views. The stand is the bike\'s own, as approved in round 1.'))
    if bike == 'A1':
        r.append(('part', 'Looks right on the bike',
                  'Partly. The scooter\'s grips are low and close, so the rider sits forward, hunched, with straight legs and wide knees. It is correct to the grips, but it is not an easy-looking pose.'))
    if bike in ('A4', 'A5'):
        r.append(('part', 'Looks right on the bike',
                  f'A forward racing lean of {lean_of(m["settings"])} degrees, which the low bars need. The back stays straight.'))
    return r


for it in items:
    if it['group'] == 'c':
        m = it['m']
        it['reqs'] = c_reqs(it)
        f = f'C{it["n"]}.glb'
        tris_total = m['tris']
        helmet = 5467 if it['who'] == 'eric' else 6276
        it['facts'] = [
            ('Triangles', f'{tris_total:,} ({tris_total - helmet:,} rider + {helmet:,} helmet) of 20,000'),
            ('File', f'{size_kb(f):.0f} KB of 500'),
            ('Lean from the hips', f'{lean_of(m["settings"])} degrees'),
            ('Arms', f'reaching {int(m["reach"][0] * 100)}% (left) and {int(m["reach"][1] * 100)}% (right) of their full length'),
            ('Seat', 'contact ' + (f'{mm(m["seat"])} mm deep' if m['seat'] else 'no part below the surface')),
            ('Pressed into the bike elsewhere', f'{m["clipverts"]} points, the deepest {mm(m["clipmax"])} mm' if m['clipverts'] else 'none'),
        ]
        it['note'] = ''


def chip(state):
    return {'met': ('met', 'Met'), 'part': ('part', 'Partly'), 'no': ('no', 'Not met')}[state]


def card(it):
    i = it['id']
    reqs = ''.join(
        f'<li class="rq {chip(s)[0]}"><span class="chip {chip(s)[0]}">{chip(s)[1]}</span><div><b>{H(t)}</b><span>{H(d)}</span></div></li>'
        for s, t, d in it['reqs'])
    base = f'img/{i}_' if it['group'] == 'c' else f'img/{it["folder"] if it["group"]=="b" and i!="B3" else ""}'
    def src(k):
        if it['group'] == 'c':
            return f'img/{i}_{k}.jpg'
        if i == 'B3':
            return f'img/B3_{k}.jpg'
        return f'img/{i}_{k}.jpg'
    shots = it['shots']
    first = shots[0][0]
    thumbs = ''.join(
        f'<li><button type="button" class="th{" on" if j == 0 else ""}" data-big="{src(k)}" data-cap="{H(cap)}" aria-label="{H(cap)}" aria-pressed="{"true" if j == 0 else "false"}"><img src="{src(k)}" alt="" loading="lazy" width="786" height="540"></button><span>{H(cap)}</span></li>'
        for j, (k, cap) in enumerate(shots))
    facts = ''.join(f'<div><dt>{H(a)}</dt><dd>{H(b)}</dd></div>' for a, b in it['facts'])
    note = f'<p class="note"><b>For you.</b> {H(it["note"])}</p>' if it.get('note') else ''
    status = 'to review'
    return f'''<article class="card" id="{i}">
<header class="ch"><span class="idtag">{i}</span><h2>{H(it["kind"])}</h2><span class="status">{status}</span></header>
<figure class="stage"><img class="big" src="{src(first)}" alt="{H(it['kind'])}, {H(shots[0][1])}" width="786" height="540"><figcaption class="cap">{H(shots[0][1])}</figcaption></figure>
<ul class="strip" aria-label="Views of {i}">{thumbs}</ul>
<h3>Requirements</h3>
<ul class="rqs">{reqs}</ul>
{note}
<dl class="facts">{facts}</dl>
</article>'''


cards = '\n'.join(card(it) for it in items)
nav = ''.join(f'<a href="#{it["id"]}">{it["id"]}</a>' for it in items)

summary = '''
<section class="sum" aria-labelledby="sumh">
<h2 id="sumh">What this round is</h2>
<p>Thirteen items: the two riders and the helmet (B1 to B3), and each rider on each of the five approved bikes (C1 to C10, the man first). The bikes are the frozen round 1 files and were not changed. Every picture is drawn from the compressed file the game would load, in the game\'s own 3D settings, and every number below was measured on that compressed file put back on the bike, not on a working copy.</p>
<h3>What I need you to decide</h3>
<ol class="decide">
<li><b>B1, the man\'s clothes.</b> The only realistic rigged adult man I could find free is in a waistcoat and tie. A man in a T-shirt and jeans exists as a free model but has no skeleton. A rigged one in a T-shirt is a stylised boy.</li>
<li><b>B2, the woman\'s top.</b> Its upper edge looks torn close up because her hair was painted onto it in the source. Two other women I tried wear stiletto heels. If you will not accept this one, tell me, and I will say plainly whether a free one exists.</li>
<li><b>C1 and C6, the scooter.</b> The pose is correct to the grips and feet, but hunched. The scooter\'s grips are as low as its seat.</li>
<li><b>Helmet colours</b> are placeholders (B3).</li>
</ol>
<h3>What I could not check</h3>
<p>How it looks on your iPhone: I draw in software, at the phone\'s size. Whether the lean looks right is for you to say. At race distance the riders are small, as in the phone pictures.</p>
<h3>How each number was measured</h3>
<ul class="how">
<li><b>Hands.</b> The grip on each bike was measured by firing rays at it (radius and axis to about 2 mm). Then how far each hand vertex sits inside it, and whether rays through the front of the wrap reach bare grip.</li>
<li><b>Feet.</b> The lowest points of each foot against the peg or floor below them.</li>
<li><b>Seat and body.</b> Rider points against the bike\'s volume, in three directions.</li>
</ul>
</section>'''

page = '''<title>King of Streets Riders</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Layout: a sticky strip of item links, a short summary, then one card per item: big picture, view strip, requirements with a verdict each, numbers. */
:root{--bg:#eceef0;--surface:#fff;--surface2:#e2e5e9;--fg:#15191d;--muted:#56626d;--line:#cfd5db;--accent:#c4410f;--accent-fg:#fff;--ok:#1d7a46;--okbg:#dcefe3;--warn:#8a5200;--warnbg:#f6e8c8;--bad:#a61f2a;--badbg:#f7dadd;
--display:"Barlow Condensed","Arial Narrow",Arial,sans-serif;--body:"Barlow",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#6fd699;--okbg:#14301f;--warn:#f0b34a;--warnbg:#33260b;--bad:#ff8f98;--badbg:#391519;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#6fd699;--okbg:#14301f;--warn:#f0b34a;--warnbg:#33260b;--bad:#ff8f98;--badbg:#391519;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:var(--body);font-size:16px;line-height:1.5;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}
.wrap{max-width:860px;margin:0 auto}
header.top{padding:20px 0 8px}
header.top h1{font-family:var(--display);font-weight:700;font-size:clamp(34px,8vw,52px);line-height:1;margin:0;letter-spacing:.01em;text-wrap:balance}
header.top p{margin:6px 0 0;color:var(--muted);max-width:60ch}
nav.jump{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);display:flex;gap:6px;overflow-x:auto;padding:8px 0;border-bottom:1px solid var(--line);margin-bottom:16px;scrollbar-width:thin}
nav.jump a{flex:0 0 auto;font-family:var(--mono);font-size:13px;padding:6px 9px;border:1px solid var(--line);border-radius:6px;color:var(--fg);text-decoration:none;background:var(--surface)}
nav.jump a:focus-visible,.th:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.sum{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:24px}
.sum h2{font-family:var(--display);font-size:26px;margin:0 0 6px}
.sum h3{font-family:var(--display);font-size:20px;margin:16px 0 4px;letter-spacing:.02em}
.sum p,.sum li{max-width:68ch}
.decide li{margin:6px 0}
.how{padding-left:20px;color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px 18px;margin:0 0 24px;scroll-margin-top:60px}
.ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.idtag{font-family:var(--mono);font-weight:500;font-size:14px;background:var(--fg);color:var(--bg);border-radius:5px;padding:3px 8px}
.ch h2{font-family:var(--display);font-weight:700;font-size:25px;line-height:1.1;margin:0;flex:1 1 220px;min-width:0;text-wrap:balance}
.status{font-family:var(--mono);font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:3px 9px}
.stage{margin:12px 0 8px;background:var(--surface2);border-radius:8px;overflow:hidden}
.stage img.big{display:block;width:100%;height:auto;max-height:78vh;object-fit:contain;background:var(--surface2)}
.stage .cap{font-family:var(--mono);font-size:12px;color:var(--muted);padding:6px 10px}
.strip{list-style:none;margin:0 0 4px;padding:0 0 6px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:thin}
.strip li{flex:0 0 96px;display:flex;flex-direction:column;gap:3px}
.strip li span{font-size:11px;color:var(--muted);line-height:1.2}
.th{display:block;width:96px;height:66px;padding:0;border:2px solid var(--line);border-radius:6px;overflow:hidden;background:var(--surface2);cursor:pointer}
.th.on{border-color:var(--accent)}
.th img{width:100%;height:100%;object-fit:cover;display:block}
h3{font-family:var(--display);font-size:20px;margin:14px 0 6px;letter-spacing:.02em}
.rqs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.rq{display:flex;gap:10px;align-items:flex-start}
.rq>div{min-width:0;display:flex;flex-direction:column}
.rq b{font-weight:600}
.rq span:not(.chip){color:var(--muted);font-size:14.5px;max-width:70ch}
.chip{flex:0 0 auto;font-family:var(--mono);font-size:11.5px;font-weight:500;border-radius:5px;padding:3px 7px;margin-top:2px;min-width:62px;text-align:center}
.chip.met{background:var(--okbg);color:var(--ok)}
.chip.part{background:var(--warnbg);color:var(--warn)}
.chip.no{background:var(--badbg);color:var(--bad)}
.note{margin:12px 0 0;padding:10px 12px;border-left:4px solid var(--accent);background:var(--surface2);border-radius:0 6px 6px 0;max-width:70ch}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 14px;margin:14px 0 0}
.facts div{border-top:1px solid var(--line);padding-top:6px;min-width:0}
.facts dt{font-family:var(--mono);font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.facts dd{margin:2px 0 0;font-size:14.5px;overflow-wrap:anywhere}
@media (prefers-reduced-motion:no-preference){.th{transition:border-color .15s}}
</style>
<div class="wrap">
<header class="top"><h1>King of Streets riders</h1><p>Round 2 of Phase 1. Thirteen items. Nothing here is approved yet, and nothing from the first attempt is used.</p></header>
<nav class="jump" aria-label="Items">''' + nav + '''</nav>
''' + summary + '''
''' + cards + '''
</div>
<script>
document.querySelectorAll('.card').forEach(function(card){
  var big=card.querySelector('img.big'),cap=card.querySelector('.cap');
  card.querySelectorAll('.th').forEach(function(b){
    b.addEventListener('click',function(){
      big.src=b.getAttribute('data-big');big.alt=b.getAttribute('data-cap');cap.textContent=b.getAttribute('data-cap');
      card.querySelectorAll('.th').forEach(function(o){o.classList.remove('on');o.setAttribute('aria-pressed','false')});
      b.classList.add('on');b.setAttribute('aria-pressed','true');
    });
  });
});
</script>
'''
open(os.path.join(HERE, 'index.html'), 'w').write(page)
print('wrote index.html', len(page), 'bytes;', len(items), 'items')
