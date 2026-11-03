# Writes index.html for round 2, second try. Run from this folder: python3 build_page.py
# Every number comes from metrics.json, measured on the compressed files in ../../models/riders put back on the frozen bikes.
import html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SHIP = os.path.join(HERE, '..', '..', 'models', 'riders')
M = json.load(open(os.path.join(HERE, 'metrics.json')))
H = html.escape
HEAD = '<title>King of Streets Riders, Second Try</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">\n<style>\n/* Layout: a sticky strip of item links, a short summary, then one card per item: big picture, view strip, requirements with a verdict each, numbers. */\n:root{--bg:#eceef0;--surface:#fff;--surface2:#e2e5e9;--fg:#15191d;--muted:#56626d;--line:#cfd5db;--accent:#c4410f;--accent-fg:#fff;--ok:#1d7a46;--okbg:#dcefe3;--warn:#8a5200;--warnbg:#f6e8c8;--bad:#a61f2a;--badbg:#f7dadd;\n--display:"Barlow Condensed","Arial Narrow",Arial,sans-serif;--body:"Barlow",system-ui,-apple-system,"Segoe UI",Arial,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace}\n@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#6fd699;--okbg:#14301f;--warn:#f0b34a;--warnbg:#33260b;--bad:#ff8f98;--badbg:#391519;color-scheme:dark}}\n:root[data-theme="dark"]{--bg:#0f1316;--surface:#181e23;--surface2:#222a31;--fg:#e8ecef;--muted:#94a1ac;--line:#2d373f;--accent:#ff8a4d;--accent-fg:#1a0d05;--ok:#6fd699;--okbg:#14301f;--warn:#f0b34a;--warnbg:#33260b;--bad:#ff8f98;--badbg:#391519;color-scheme:dark}\n*{box-sizing:border-box}\nbody{background:var(--bg);color:var(--fg);font-family:var(--body);font-size:16px;line-height:1.5;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 48px}\n.wrap{max-width:860px;margin:0 auto}\nheader.top{padding:20px 0 8px}\nheader.top h1{font-family:var(--display);font-weight:700;font-size:clamp(34px,8vw,52px);line-height:1;margin:0;letter-spacing:.01em;text-wrap:balance}\nheader.top p{margin:6px 0 0;color:var(--muted);max-width:60ch}\nnav.jump{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);display:flex;gap:6px;overflow-x:auto;padding:8px 0;border-bottom:1px solid var(--line);margin-bottom:16px;scrollbar-width:thin}\nnav.jump a{flex:0 0 auto;font-family:var(--mono);font-size:13px;padding:6px 9px;border:1px solid var(--line);border-radius:6px;color:var(--fg);text-decoration:none;background:var(--surface)}\nnav.jump a:focus-visible,.th:focus-visible{outline:3px solid var(--accent);outline-offset:2px}\nbody::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}\n.sum{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin-bottom:24px}\n.sum h2{font-family:var(--display);font-size:26px;margin:0 0 6px}\n.sum h3{font-family:var(--display);font-size:20px;margin:16px 0 4px;letter-spacing:.02em}\n.sum p,.sum li{max-width:68ch}\n.decide li{margin:6px 0}\n.how{padding-left:20px;color:var(--muted)}\n.card{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:14px 16px 18px;margin:0 0 24px;scroll-margin-top:60px}\n.ch{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.idtag{font-family:var(--mono);font-weight:500;font-size:14px;background:var(--fg);color:var(--bg);border-radius:5px;padding:3px 8px}\n.ch h2{font-family:var(--display);font-weight:700;font-size:25px;line-height:1.1;margin:0;flex:1 1 220px;min-width:0;text-wrap:balance}\n.status{font-family:var(--mono);font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:3px 9px}\n.stage{margin:12px 0 8px;background:var(--surface2);border-radius:8px;overflow:hidden}\n.stage img.big{display:block;width:100%;height:auto;max-height:78vh;object-fit:contain;background:var(--surface2)}\n.stage .cap{font-family:var(--mono);font-size:12px;color:var(--muted);padding:6px 10px}\n.strip{list-style:none;margin:0 0 4px;padding:0 0 6px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:thin}\n.strip li{flex:0 0 96px;display:flex;flex-direction:column;gap:3px}\n.strip li span{font-size:11px;color:var(--muted);line-height:1.2}\n.th{display:block;width:96px;height:66px;padding:0;border:2px solid var(--line);border-radius:6px;overflow:hidden;background:var(--surface2);cursor:pointer}\n.th.on{border-color:var(--accent)}\n.th img{width:100%;height:100%;object-fit:cover;display:block}\nh3{font-family:var(--display);font-size:20px;margin:14px 0 6px;letter-spacing:.02em}\n.rqs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}\n.rq{display:flex;gap:10px;align-items:flex-start}\n.rq>div{min-width:0;display:flex;flex-direction:column}\n.rq b{font-weight:600}\n.rq span:not(.chip){color:var(--muted);font-size:14.5px;max-width:70ch}\n.chip{flex:0 0 auto;font-family:var(--mono);font-size:11.5px;font-weight:500;border-radius:5px;padding:3px 7px;margin-top:2px;min-width:62px;text-align:center}\n.chip.met{background:var(--okbg);color:var(--ok)}\n.chip.part{background:var(--warnbg);color:var(--warn)}\n.chip.no{background:var(--badbg);color:var(--bad)}\n.note{margin:12px 0 0;padding:10px 12px;border-left:4px solid var(--accent);background:var(--surface2);border-radius:0 6px 6px 0;max-width:70ch}\n.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 14px;margin:14px 0 0}\n.facts div{border-top:1px solid var(--line);padding-top:6px;min-width:0}\n.facts dt{font-family:var(--mono);font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}\n.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:12px 0}.opts figure{margin:0;background:var(--surface2);border-radius:8px;overflow:hidden}.opts img{display:block;width:100%;height:auto}.opts figcaption{font-size:14px;padding:8px 10px;color:var(--muted)}.optp{margin:0;color:var(--muted);max-width:70ch}\n.facts dd{margin:2px 0 0;font-size:14.5px;overflow-wrap:anywhere}\n@media (prefers-reduced-motion:no-preference){.th{transition:border-color .15s}}\n</style>\n'
SCRIPT = "<script>\ndocument.querySelectorAll('.card').forEach(function(card){\n  var big=card.querySelector('img.big'),cap=card.querySelector('.cap');\n  card.querySelectorAll('.th').forEach(function(b){\n    b.addEventListener('click',function(){\n      big.src=b.getAttribute('data-big');big.alt=b.getAttribute('data-cap');cap.textContent=b.getAttribute('data-cap');\n      card.querySelectorAll('.th').forEach(function(o){o.classList.remove('on');o.setAttribute('aria-pressed','false')});\n      b.classList.add('on');b.setAttribute('aria-pressed','true');\n    });\n  });\n});\n</script>\n"


def kb(name):
    return f'{os.path.getsize(os.path.join(SHIP, name)) / 1024:.0f} KB'


def mm(x):
    return f'{x:.1f}'.rstrip('0').rstrip('.')


BIKES = {'A1': 'A1 scooter', 'A2': 'A2 125 cc commuter', 'A3': 'A3 135 cc street bike', 'A4': 'A4 sport bike', 'A5': 'A5 hyper bike'}
BEFORE = {'A1': 8, 'A2': 9, 'A3': 12, 'A4': 6, 'A5': 18}   # share of the sit zone touching the seat in the version you rejected (measured the same way)
STAND = [('front', 'Front'), ('side', 'Side'), ('back', 'Back'), ('q', 'Three-quarter'), ('head34', 'Head, three-quarter'), ('headfront', 'Head, front'), ('headside', 'Head, side'), ('headback', 'Head, back')]


def clip_where(m):
    p = m['clippos']
    if not p:
        return ''
    x, y, z = p
    if y >= 0.95 and abs(x) >= 0.3:
        return 'a fingertip into a control lever'
    if y >= 0.95:
        return 'a knee or thigh into the tank'
    if y >= 0.70:
        return 'the seat cushion and the bodywork beside it'
    return 'a shin or foot into the frame or bodywork'


items = []
items.append(dict(
    id='B1', kind='Male rider in leathers, standing, with the helmet', folder='B1', shots=STAND,
    reqs=[
        ('met', 'Riding gear', 'The same one-piece leather suit and gloves as B2, recoloured blue, with black shoes and the blue helmet.'),
        ('part', 'Looks like a man', 'Partly. I reshaped the suit in the rest pose: shoulders 22% wider, waist and chest deeper, hips 9% narrower, glutes and bust flattened, 6% taller. From behind and at race distance he reads as a broad-shouldered rider. From the front and the side the suit\'s seams and panels still follow a woman\'s figure.'),
        ('met', 'No face or hair showing', 'The head is under the helmet; only a collar shows at the neck.'),
        ('met', 'Told apart from B2 at a glance', 'Blue suit and helmet against red, and visibly broader shoulders from behind.'),
        ('no', 'A realistic, separate male model', 'Not met: there is none. I searched Sketchfab\'s free (CC BY and CC0) models twice, 213 results, for a man in riding gear with a skeleton. The closest one is pictured below; the others are named in the note. Free models in this category are mostly not rigged, scans of real people, or cartoons.'),
    ],
    facts=[('Source', 'Racer Girl, Peter_D, CC BY, reshaped and recoloured (same source as B2)'), ('Triangles', '19,452 of 20,000 (helmet 3,592)'), ('File', kb('B1.glb') + ' of 500'), ('Parts drawn', '3 of 6')],
    note='Decision for you: keep this reshaped suit, or tell me which of the others to pursue. The "80\'s mystery biker" (below) has a real leather jacket, jeans and boots, but it is only 5,700 triangles, 1.39 m tall, has blocky hands and a band\'s artwork on its back, and its skeleton does not load correctly in Blender, so it needs repair before it can be posed. A businessman scan (my first try) painted black still looks like a shirt and waistcoat, so I dropped it.',
    alt=[('B1alt_mystery', 'Not used: "80\'s mystery biker", thomasdonovan26, CC BY. Real moto jacket, boots and helmet, but very low detail.')],
))
items.append(dict(
    id='B2', kind='Female rider in leathers, standing, with the helmet', folder='B2', shots=STAND,
    reqs=[
        ('met', 'Riding gear', 'A one-piece red and black leather suit with gloves. Her shoes were white trainers; I made them black. They are low shoes, not tall riding boots.'),
        ('met', 'A straight back', 'The spine stays straight; on a bike she leans from the hips.'),
        ('met', 'No face or hair showing, no ponytail', 'The head and hair are removed inside the helmet. Nothing else was cut: her back is whole in every view.'),
        ('met', 'A smooth finish, no gap where clothes meet', 'One piece; gloves meet the sleeves cleanly in every view I drew.'),
    ],
    facts=[('Source', 'Racer Girl, Peter_D, CC BY'), ('Triangles', '19,506 of 20,000 (helmet 4,370)'), ('File', kb('B2.glb') + ' of 500'), ('Parts drawn', '3 of 6')],
    note='You said this one is okay. It is unchanged from the last review, except that on the bikes she now sits down onto the seat (C6 to C10).',
))
items.append(dict(
    id='B3', kind='Full-face helmet, in each rider\'s colour', folder='B3',
    shots=[('m_h34', 'Blue, three-quarter'), ('m_hfront', 'Blue, front'), ('m_hside', 'Blue, side'), ('m_hback', 'Blue, back'), ('m_htop', 'Blue, top'),
           ('w_h34', 'Red, three-quarter'), ('w_hfront', 'Red, front'), ('w_hside', 'Red, side'), ('w_hback', 'Red, back'), ('w_htop', 'Red, top')],
    reqs=[
        ('met', 'A detailed full-face helmet', 'A modern racing helmet: shaped shell, vents, a spoiler at the back, chin bar and visor with its pivots.'),
        ('met', 'A dark visor', 'Tinted dark and glossy, so it reads apart from the shell.'),
        ('met', 'No makers\' logos', 'Its brand names and graphics were painted out.'),
        ('part', 'In each rider\'s colour', 'Blue and red are placeholders; colours are chosen with the names in Phase 2.'),
    ],
    facts=[('Source', 'Alpinestars Supertech R10, Carlito, CC BY'), ('Triangles', '4,370 (source 5,989)'), ('Files', kb('B3_m.glb') + ' and ' + kb('B3_w.glb'))],
    note='In the game the helmet is part of each rider file, pinned to the head. These are the same helmets, shown alone.',
))
for n in range(1, 11):
    who = 'm' if n <= 5 else 'w'
    b = f'A{(n - 1) % 5 + 1}'
    d = M[f'{who}_{b}']
    pen, gt2, holes, feet = d['pen'], d['gt2'], d['holes'], d['feet']
    share, med = d['air']
    peg = 'floorboard' if b == 'A1' else 'footpegs'
    seat_ok = share >= 50 and med <= 10
    exc = 'No part of either hand is more than 2 mm inside the grip' if not any(gt2) else \
        f'{gt2[0]} points of the left hand and {gt2[1]} of the right are more than 2 mm inside the grip (fingertip pads, the deepest {mm(max(pen))} mm), out of about 400 points each'
    reqs = [
        ('met' if seat_ok else 'part', 'Seated on the seat',
         f'In the zone where she sits (30 cm along the seat from her rearmost point), {share}% of the underside of her seat and upper thighs touches the seat, within 8 mm, and the typical gap is {med} mm. The rest is her thighs rising off it towards the knees. The version you rejected measured {BEFORE[b]}% for the woman. See the Seat and Cut-away views.'),
        ('met', 'Fingers closed round the grips', 'Both hands wrap over the top and down the front, and the fingertips tuck under. No gap between fingers on either hand.'),
        ('part' if any(gt2) else 'met', 'None under the grip or off it', exc + '.'),
        ('met', 'Feet on the ' + peg, f'The lowest point of each shoe is {mm(feet[0])} mm (left) and {mm(feet[1])} mm (right) above the {peg}.'),
        ('met', 'Stand up', 'The bike\'s own stand, as approved in round 1.'),
        ('part' if d['clipmax'] > 5 else 'met', 'Nothing through the bike', f'{d["clipverts"]} points are inside the bike, the deepest {mm(d["clipmax"])} mm: {clip_where(d)}.'),
    ]
    if b == 'A1':
        reqs.insert(1, ('met', 'Sits on a scooter as people do', 'Upright, knees together, both feet flat on the floorboard in front, hands on the grips.'))
    who_name = 'B1 (man)' if who == 'm' else 'B2 (woman)'
    tris = d['tris']
    items.append(dict(
        id=f'C{n}', kind=f'{who_name} on {BIKES[b]}', folder=f'C{n}',
        shots=[('side', 'Side'), ('seat', 'Seat, close'), ('cut', 'Cut-away through the middle of the bike'), ('front34', 'Front three-quarter'), ('rear34', 'Rear three-quarter'), ('rear', 'Rear'), ('back', 'Back, from above'),
               ('handL', 'Left hand, from above'), ('handLunder', 'Left hand, from underneath'), ('handR', 'Right hand, from above'), ('handRunder', 'Right hand, from underneath'),
               ('footL', 'Left foot'), ('footR', 'Right foot'), ('race', 'Race distance, phone upright')],
        reqs=reqs,
        facts=[('Triangles', f'{tris:,} of 20,000, helmet included'), ('File', kb(f'C{n}.glb') + ' of 500'), ('Lean from the hips', f'{d["lean"]} degrees'),
               ('Holes inside the wrapped part', f'{mm(holes[0])}% left, {mm(holes[1])}% right (between fingers, under the palm)')],
        note='',
    ))


def chip(s):
    return {'met': ('met', 'Met'), 'part': ('part', 'Partly'), 'no': ('no', 'Not met')}[s]


def card(it):
    i = it['id']
    reqs = ''.join(f'<li class="rq {chip(s)[0]}"><span class="chip {chip(s)[0]}">{chip(s)[1]}</span><div><b>{H(t)}</b><span>{H(d)}</span></div></li>' for s, t, d in it['reqs'])
    facts = ''.join(f'<div><dt>{H(a)}</dt><dd>{H(b)}</dd></div>' for a, b in it['facts'])
    note = f'<p class="note"><b>For you.</b> {H(it["note"])}</p>' if it.get('note') else ''
    src = lambda k: f'img/{i}_{k}.jpg'
    shots = it['shots']
    thumbs = ''.join(f'<li><button type="button" class="th{" on" if j == 0 else ""}" data-big="{src(k)}" data-cap="{H(c)}" aria-label="{H(c)}" aria-pressed="{"true" if j == 0 else "false"}"><img src="{src(k)}" alt="" loading="lazy"></button><span>{H(c)}</span></li>' for j, (k, c) in enumerate(shots))
    media = f'<figure class="stage"><img class="big" src="{src(shots[0][0])}" alt="{H(it["kind"])}, {H(shots[0][1])}"><figcaption class="cap">{H(shots[0][1])}</figcaption></figure><ul class="strip" aria-label="Views of {i}">{thumbs}</ul>'
    if it.get('alt'):
        for key, cap in it['alt']:
            figs = ''.join(f'<figure><img src="img/{key}_{v}.jpg" alt="{H(cap)} {c}" loading="lazy"></figure>' for v, c in (('front', 'front'), ('q', 'three-quarter'), ('back', 'back')))
            media += f'<h3>Considered</h3><p class="optp">{H(cap)}</p><div class="opts">{figs}</div>'
    return f'<article class="card" id="{i}"><header class="ch"><span class="idtag">{i}</span><h2>{H(it["kind"])}</h2><span class="status">to review</span></header>{media}<h3>Requirements</h3><ul class="rqs">{reqs}</ul>{note}<dl class="facts">{facts}</dl></article>'


summary = """<section class="sum" aria-labelledby="sumh"><h2 id="sumh">What changed after your feedback</h2>
<ul class="how">
<li><b>Seated.</b> I was measuring one point touching the seat, which passed things that clearly were not seated. Now I measure how much of her underside lies on it, and the fit presses the pelvis and thighs onto the seat, as weight does. In the zone where she sits, 6 to 18% of the woman touched the seat before; now 44 to 64%. A cut-away through the middle of the bike shows it in every item.</li>
<li><b>The man was distorted.</b> That was my mistake: I stretched the small pictures. They are now drawn at their true shape. He was also low quality because no free model is good: see B1.</li>
<li><b>A man in riding gear.</b> B1 is now the woman’s leather suit, reshaped for a man and coloured blue, so he has the same quality and the same gear. The man on each bike is C1 to C5.</li>
</ul>
<h3>What I need you to decide</h3>
<ol class="decide"><li><b>B1, the man.</b> Is the reshaped suit good enough? From behind it reads as a man; from the front it still looks like a woman’s suit. If not, no free model is better, so tell me whether to repair the low-detail biker, or something else.</li>
<li><b>Helmet colours</b> are placeholders (B3).</li></ol>
<h3>What is not perfect</h3>
<p>Her thighs rise off the seat towards the knees, as real thighs do on these bikes, so the seat share is never 100%. On the scooter the rider presses up to 28 mm into the soft cushion, and on the others a shin, knee or fingertip passes 4 to 24 mm into the bodywork. A few fingertip pads sit up to 4.4 mm into a grip. The shoes are low, not tall boots. Every picture is drawn from the compressed file the game would load, and every number was measured on it, put back on the frozen bike. The bikes were not changed.</p>
</section>"""

items_html = '\n'.join(card(it) for it in items)
nav = ''.join(f'<a href="#{it["id"]}">{it["id"]}</a>' for it in items)
page = HEAD + '<div class="wrap"><header class="top"><h1>King of Streets riders, second try</h1><p>Round 2 after your feedback. Thirteen items. Nothing here is approved yet.</p></header><nav class="jump" aria-label="Items">' + nav + '</nav>' + summary + items_html + '</div>' + SCRIPT
open(os.path.join(HERE, 'index.html'), 'w').write(page)
print('wrote index.html', len(page), 'bytes;', len(items), 'items')
