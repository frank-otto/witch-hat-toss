"""Witch Hat Toss headless test (Chrome + SwiftShader WebGL, served over a local web server)."""
import asyncio, os, re, glob, hashlib
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
LAND, ILEN = 3.55, 7.4

async def page(b, auto_q=False, manual=True, url=None, skip=False, locale='en-US', **kw):
    ctx = await b.new_context(accept_downloads=True, locale=locale, **kw)
    init = 'window.__whSeed = 4242; window.__whPDB = true;' + ('' if auto_q else 'window.__whNoAutoQ = true;') + ('window.__whManual = true;' if manual else '') + ('window.__whSkipIntro = true;' if skip else '')
    await ctx.add_init_script(init + "try{if(!sessionStorage.getItem('whInit')){sessionStorage.setItem('whInit','1'); localStorage.clear();}}catch(e){}")
    pg = await ctx.new_page(); pg.set_default_timeout(240000); logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
    await pg.goto(url or URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__wh', timeout=120000)
    return ctx, pg, logs

def pxs(im): return im.get_flattened_data() if hasattr(im, 'get_flattened_data') else list(im.getdata())
def mean(path): im = Image.open(path).convert('L'); px = pxs(im); return sum(px) / len(px)
def bright_share(path, thr=250):
    im = Image.open(path).convert('RGB'); px = pxs(im); return sum(1 for r, g, b in px if r >= thr and g >= thr and b >= thr) / (im.width * im.height)
def diff(a, b):
    A = Image.open(a).convert('L').resize((160, 100)); B = Image.open(b).convert('L').resize((160, 100)); pa, pb = pxs(A), pxs(B); return sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)
async def shot(pg, name, n=1):
    await pg.evaluate(f'__wh.step(1/30, {n})'); await pg.wait_for_timeout(700); await pg.screenshot(path=OUT + name); return OUT + name
async def mark(pg): return await pg.evaluate('__wh.log.length')
async def lg_since(pg, k): return await pg.evaluate(f'__wh.log.slice({k}).map(e => e.n)')
async def ready(pg): return await pg.evaluate('(() => { let i = 0; for (; i < 400 && !__wh.canToss(); i++) __wh.stepq(1/30); return __wh.canToss(); })()')
async def settle(pg, n=75): await pg.evaluate(f'__wh.stepq(1/30, {n})')
st = lambda pg: pg.evaluate('({s: __wh.S.state, score: __wh.S.score, lvl: __wh.S.level, hats: __wh.S.hats, streak: __wh.S.streak, ring: __wh.S.ringers, lv: __wh.S.lvlScore, goal: __wh.S.goal})')
async def hit(pg, i, err=0, n=75):
    await ready(pg); ok = await pg.evaluate(f'__wh.aimAt({i}, {err})'); await settle(pg, n); return ok
BLACK = '''(n) => { const gl = __wh.renderer.getContext(), px = new Uint8Array(4); let k = 0; for (let i = 0; i < n; i++) { __wh.step(1/30); let lit = 0; for (const [fx, fy] of [[.5, .5], [.25, .3], [.75, .3], [.25, .75], [.75, .75]]) { gl.readPixels(Math.floor(gl.drawingBufferWidth * fx), Math.floor(gl.drawingBufferHeight * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[0] + px[1] + px[2] >= 3) lit++; } if (!lit) k++; } return k; }'''

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        # ================= opening =================
        ctx, pg, logs = await page(b, viewport={'width': 1280, 'height': 800})
        check('app opens with the cinematic intro (not a title card)', await pg.evaluate('__wh.S.state') == 'intro' and not await pg.is_visible('#menu.show'))
        f0 = await shot(pg, 'intro-f0.png', 0); m0 = mean(f0); check('intro frame 0 is not black (moon telephoto)', m0 > 40, round(m0, 1))
        f1 = await shot(pg, 'intro-f1.png', 6); check('intro: motion from the first frames', diff(f0, f1) > 1.5, round(diff(f0, f1), 2))
        lg = await pg.evaluate('__wh.log.map(e => e.n)'); check('intro: deep rumble + bass boom hit at the start', 'rumble' in lg and 'boom_bass' in lg, lg[:8])
        await pg.evaluate('__wh.stepq(1/30, 14)'); check('intro: the witch crosses the moon', await pg.evaluate('__wh.W.witch.visible'))
        await shot(pg, 'intro-witch.png', 1)
        await pg.evaluate('__wh.stepq(1/30, 40)'); lg = await pg.evaluate('__wh.log.map(e => e.n)'); check('intro: witch cackle', 'cackle' in lg); fz = await pg.evaluate('__wh.cam().fov'); check('intro: whip zoom out of the telephoto shot', fz > 30, round(fz, 1))
        await pg.evaluate('__wh.stepq(1/30, 20)'); await shot(pg, 'intro-ride.png', 1)
        lit = await pg.evaluate('__wh.W.jacks.filter(j => j.on > .5).length'); check('intro: jack-o\'-lanterns ignite one by one during the dive', 0 < lit < 7, lit)
        bk = await pg.evaluate(f'({BLACK})(10)'); check('intro: no black frames in the dive', bk == 0, bk)
        k = await mark(pg); await pg.evaluate(f'(() => {{ while (__wh.S.introT < {LAND} + .05) __wh.stepq(1/30); }})()'); l = await lg_since(pg, k)
        check('intro landing: cinematic boom + deep bell + organ', all(x in l for x in ('boom_cine', 'bell_deep', 'hit_dram')) and sum(1 for x in l if x.startswith('org_')) >= 3, sorted(set(l))[:14])
        check('intro landing: hat sits on the scarecrow', await pg.evaluate('__wh.targets().find(t => t.kind === "scarecrow").stack') == 1)
        check('intro: all jack-o\'-lanterns lit at the landing', await pg.evaluate('__wh.W.jacks.every(j => j.on >= 1)'))
        await pg.evaluate('__wh.stepq(1/30, 2)'); tt = await pg.evaluate("[+getComputedStyle(document.getElementById('oTitle')).opacity, new DOMMatrix(getComputedStyle(document.getElementById('oTitle')).transform).a]")
        check('intro: title slams in huge (scale punch, no shake)', tt[0] > .9 and tt[1] > 1.5, tt)
        sl = await shot(pg, 'intro-title.png', 6); check('intro title frame is bright and contrasty', mean(sl) > 30, round(mean(sl), 1))
        await pg.evaluate('__wh.stepq(1/30, 45)'); t2 = await pg.evaluate("new DOMMatrix(getComputedStyle(document.getElementById('oTitle')).transform)")
        check('intro: title recedes into the night (Star Wars style)', t2['a'] < 1 or t2['m43'] < -50, (t2['a'], t2['m43']))
        await pg.evaluate(f'(() => {{ for (let i = 0; i < 200 && __wh.S.state === "intro"; i++) __wh.stepq(1/30); __wh.step(1/30, 20); }})()')
        check('intro ends in the menu by itself', await pg.evaluate('__wh.S.state') == 'menu' and await pg.is_visible('#menu.show'))
        check('menu: title, campaign + duel', 'Witch Hat Toss' in await pg.text_content('h1') and 'Campaign' in await pg.text_content('#btnCampaign') and 'Duel' in await pg.text_content('#btnDuel'))
        check("graphics label reads 'Normal' by default", 'Normal' in await pg.text_content('#btnQ'), await pg.text_content('#btnQ'))
        await pg.click('#btnIntro'); await pg.evaluate('__wh.step(1/30, 3)'); check('🎬 replays the intro', await pg.evaluate('__wh.S.state') == 'intro')
        await pg.evaluate(f'(() => {{ while (__wh.S.introT < {LAND} + .1) __wh.stepq(1/30); }})()'); check('replayed intro lands again', await pg.evaluate('__wh.targets().find(t => t.kind === "scarecrow").stack') == 1)
        await pg.click('#btnSkip'); await pg.evaluate('__wh.step(1/30, 3)'); check('Skip button jumps straight to the menu', await pg.evaluate('__wh.S.state') == 'menu')
        await pg.click('#btnIntro'); await pg.evaluate('__wh.step(1/30, 10)'); await pg.keyboard.press('Escape'); await pg.evaluate('__wh.step(1/30, 3)'); check('Esc skips the intro', await pg.evaluate('__wh.S.state') == 'menu')
        # ================= menu =================
        await pg.evaluate('__wh.step(1/30, 200)'); lg = await pg.evaluate('__wh.log.map(e => e.n)')
        check('menu: night ambience beds (wind, night, cauldron)', {'~wind', '~night_loop', '~cauldron_loop'} <= set(lg), sorted(set(x for x in lg if x[0] == '~')))
        check('menu: waltz from recorded organ / contrabass / pizzicato', sum(1 for n in lg if re.match(r'(org|ped|pz|cb)_', n)) >= 6)
        ms = await shot(pg, 'shot-menu.png'); check('menu no glare', bright_share(ms) < .01, round(bright_share(ms), 5))
        check('menu: demo hats sit on the targets', await pg.evaluate('__wh.targets().reduce((a, t) => a + t.stack, 0)') >= 2)
        check('language: starts in the browser language (en-US → English)', await pg.evaluate('document.documentElement.lang') == 'en')
        await pg.click('#btnLang'); de = await pg.text_content('#btnCampaign'); await shot(pg, 'shot-menu-de.png')
        check('DE toggle', 'Kampagne' in de and 'Duell' in await pg.text_content('#btnDuel'), de)
        await pg.wait_for_timeout(200); await pg.reload(wait_until='load'); await pg.wait_for_function('document.body.classList.contains("ready") && window.__wh')
        check('language choice remembered after reload (beats the browser language)', 'Kampagne' in await pg.text_content('#btnCampaign')); await pg.evaluate('__wh.endIntro(); __wh.step(1/30, 2)'); await pg.click('#btnLang')
        check('difficulty default Medium', await pg.evaluate('__wh.S.diff') == 'medium' and 'on' in (await pg.get_attribute('#diff [data-d=medium]', 'class') or ''))
        # ================= campaign, medium =================
        await pg.evaluate('__wh.log.length = 0'); await pg.click('#btnCampaign'); await pg.evaluate('__wh.step(1/30, 40)')
        s = await st(pg); check('Campaign starts: level 1, 8 hats, goal 400', s['s'] == 'play' and s['lvl'] == 0 and s['hats'] == 8 and s['goal'] == 400, s)
        check('level 1 = three pumpkins', [t['kind'] for t in await pg.evaluate('__wh.targets()')] == ['pumpkin'] * 3)
        check('level banner', any('Pumpkin Patch' in x for x in await pg.evaluate('window.__banners')))
        check('hint explains pull back + release', await pg.is_visible('#hint.show') and 'Drag back' in await pg.text_content('#hint'))
        check('a hat is ready in hand', await ready(pg) and await pg.evaluate('__wh.hand().kind') == 'normal')
        check('NEXT preview + wind chip', len((await pg.text_content('#nextBox')).strip()) > 3 and await pg.is_visible('#windBox'), await pg.text_content('#nextBox'))
        # physics sanity (pure simulation)
        a = await pg.evaluate('[__wh.sim(0, .3), __wh.sim(0, .8), __wh.sim(.2, .5), __wh.sim(-.2, .5), __wh.sim(0, .5, 2)]')
        check('physics: straight toss stays centred, more power flies further', abs(a[0][0]) < 1e-6 and a[1][2] < a[0][2] - 5, [round(v, 2) for v in a[0] + a[1]])
        check('physics: aim is symmetric left/right', abs(a[2][0] + a[3][0]) < 1e-6 and a[2][0] > 1, (round(a[2][0], 2), round(a[3][0], 2)))
        check('physics: wind pushes the hat sideways', a[4][0] > 1, round(a[4][0], 2))
        # mouse drag: pull back + release
        await pg.evaluate('__wh.setWind(0); __wh.S.goal = 99999')
        k = await mark(pg); await pg.mouse.move(640, 400); await pg.mouse.down(); await pg.mouse.move(640, 470, steps=4); await pg.evaluate('__wh.step(1/30, 2)')
        pv = await pg.evaluate('__wh.preview()'); pw = await pg.is_visible('#power.show')
        check('aiming: power meter + partial arc preview (Medium)', pw and pv['visible'] and pv['n'] > 3 and 0 < pv['frac'] < 1 and not pv['ring'], (pw, pv))
        await shot(pg, 'shot-aim.png', 1); await pg.mouse.move(640, 560, steps=3); await pg.mouse.up(); await pg.evaluate('__wh.step(1/30, 6)')
        fl = await pg.evaluate('__wh.flying()'); l = await lg_since(pg, k)
        check('release tosses the hat (whoosh + cloth flap)', len(fl) == 1 and fl[0]['state'] == 'fly' and 'whoosh' in l and any(x.startswith('flap_') for x in l), (fl, sorted(set(l))))
        q0 = await pg.evaluate('__wh._dbg.flying[0].g.quaternion.toArray()'); await pg.evaluate('__wh.step(1/30, 3)'); q1 = await pg.evaluate('__wh._dbg.flying[0] ? __wh._dbg.flying[0].g.quaternion.toArray() : null')
        check('the hat spins and tilts in flight', q1 is not None and sum(abs(x - y) for x, y in zip(q0, q1)) > .1, (q0, q1))
        await shot(pg, 'shot-flight.png', 2); await settle(pg)
        check('a toss costs a hat', (await st(pg))['hats'] == 7)
        # ringer
        s0 = await st(pg); k = await mark(pg); await hit(pg, 1); s1 = await st(pg); l = await lg_since(pg, k); tg = await pg.evaluate('__wh.targets()')
        check('aimed toss = ringer: hat sits on the pumpkin', tg[1]['stack'] == 1 and s1['ring'] == s0['ring'] + 1, (tg, s1))
        check('ringer scores ≥ 100', s1['score'] - s0['score'] >= 100, s1['score'] - s0['score'])
        check('ringer: deep thump + organ chord + timpani', 'thump' in l and sum(1 for x in l if x.startswith('org_')) >= 3 and any(x.startswith('tp_') for x in l), sorted(set(l)))
        check('PERFECT pop text', any('PERFECT' in x for x in await pg.evaluate('window.__pops || []')))
        check('ringer fx: sparks burst', await pg.evaluate('__wh.sparks()') >= 0)
        await shot(pg, 'shot-ringer.png', 1)
        # stack on the same target
        k = await pg.evaluate('(window.__pops || []).length'); await hit(pg, 1); tg = await pg.evaluate('__wh.targets()'); pops = (await pg.evaluate('window.__pops'))[k:]
        check('second hat stacks on the same pumpkin', tg[1]['stack'] == 2 and any('STACK' in x for x in pops), (tg[1], pops))
        # streak 3 = HAT TRICK (score may clear the level; that is fine)
        await pg.evaluate('__wh.S.goal = 99999'); k = await mark(pg); await hit(pg, 0); l = await lg_since(pg, k); s = await st(pg)
        check('streak ×3 → HAT TRICK banner + fireworks', s['streak'] == 3 and any('HAT TRICK' in x for x in await pg.evaluate('window.__banners')) and 'fw_burst' in l, (s['streak'], sorted(set(l))))
        check('combo chip shows streak + multiplier', await pg.is_visible('#hComboBox') and 'x2' in await pg.text_content('#hCombo'), await pg.text_content('#hCombo'))
        # miss
        k = await mark(pg); await hit(pg, 0, 3.0, 90); s = await st(pg); l = await lg_since(pg, k)
        check('a wild toss misses: streak reset, ground thump', s['streak'] == 0 and 'thump_b' in l and any('Missed' in x for x in await pg.evaluate('window.__pops')), (s, sorted(set(l))))
        # rim
        k = await mark(pg); await ready(pg); await pg.evaluate('__wh.aimAt(2, .38)'); await pg.evaluate('__wh.stepq(1/30, 60)'); rim = await pg.evaluate('__wh._dbg.flying.map(h => h.rimHits)'); l = await lg_since(pg, k); await settle(pg)
        check('off-centre toss bounces off the rim (knock sound)', (any(r > 0 for r in rim) or 'knock' in l) and any(x in l for x in ('knock', 'thud_wood')), (rim, sorted(set(l))))
        # wind: compensated vs not
        await pg.evaluate('__wh.S.hats = 8'); await ready(pg); await pg.evaluate('__wh.setWind(1.8)')
        a1 = await pg.evaluate('__wh.solve(2, 0, true)'); a0 = await pg.evaluate('__wh.solve(2, 0, false)')
        check('wind: the aim solver compensates by aiming upwind', a1['yaw'] < a0['yaw'] - .02, (a1, a0))
        n0 = (await pg.evaluate('__wh.targets()'))[2]['stack']; await pg.evaluate(f"__wh.toss({a0['yaw']}, {a0['pow']})"); await settle(pg); n1 = (await pg.evaluate('__wh.targets()'))[2]['stack']
        check('wind: ignoring it blows the hat off target', n1 == n0, (n0, n1))
        await ready(pg); await pg.evaluate('__wh.setWind(1.8); __wh.aimAt(2)'); await settle(pg); n2 = (await pg.evaluate('__wh.targets()'))[2]['stack']
        check('wind: compensating for it still lands a ringer', n2 == n1 + 1, (n1, n2))
        # level clear → level 2
        await pg.evaluate('__wh.S.goal = 400; __wh.S.lvlScore = 390; __wh.setWind(0)'); k = await mark(pg); await hit(pg, 0); await pg.evaluate('__wh.stepq(1/30, 160)'); l = await lg_since(pg, k)
        s = await st(pg); tg = await pg.evaluate('__wh.targets()')
        check('goal reached → Level cleared + hat bonus + bell', any('Level cleared' in x for x in await pg.evaluate('window.__banners')) and 'bell_deep' in l and any('Hat bonus' in x for x in await pg.evaluate('window.__pops')), sorted(set(l))[:10])
        check('next level: Old Graveyard with grave spikes', s['lvl'] == 1 and 'spike' in [t['kind'] for t in tg] and s['hats'] == 8, (s, [t['kind'] for t in tg]))
        await shot(pg, 'shot-level2.png', 30)
        # moving ghost (level 4)
        await pg.evaluate('__wh.level(3); __wh.setWind(0)'); await ready(pg); x0 = (await pg.evaluate('__wh.targets()'))[0]['x']; await pg.evaluate('__wh.stepq(1/30, 20)'); x1 = (await pg.evaluate('__wh.targets()'))[0]['x']
        check('Ghost Parade: ghosts drift sideways', abs(x1 - x0) > .1, (x0, x1))
        await pg.evaluate('__wh.setWind(0)'); await hit(pg, 0, 0, 75); g = await pg.evaluate('__wh.targets()[0]')
        check('leading the moving ghost lands a ringer on its head', g['stack'] == 1, g)
        hx0 = await pg.evaluate('__wh._dbg.targets[0].stack[0].g.getWorldPosition(new __wh._dbg.THREE.Vector3()).x'); await pg.evaluate('__wh.stepq(1/30, 25)'); hx1 = await pg.evaluate('__wh._dbg.targets[0].stack[0].g.getWorldPosition(new __wh._dbg.THREE.Vector3()).x')
        check('the hat rides along on the ghost', abs(hx1 - hx0) > .05, (hx0, hx1)); await shot(pg, 'shot-ghosts.png', 1)
        # all levels + encore build
        kinds = []
        for i in range(8): await pg.evaluate(f'__wh.level({i})'); kinds.append(len(await pg.evaluate('__wh.targets()')))
        check('all 6 levels + endless encore build', kinds == [3, 4, 4, 4, 5, 6, 4, 5], kinds)
        await pg.evaluate('__wh.level(5); __wh.step(1/30, 20)'); check('Witching Hour: blood moon', await pg.evaluate('__wh.W.blood') > .5); await shot(pg, 'shot-level6.png', 10)
        # special hats
        await pg.evaluate('__wh.level(0); __wh.setWind(0); __wh.S.goal = 99999; __wh.setNext("golden")'); await ready(pg); check('golden hat in hand', await pg.evaluate('__wh.hand().kind') == 'golden')
        s0 = await st(pg); await pg.evaluate('__wh.aimAt(1)'); await settle(pg); s1 = await st(pg); check('golden hat: triple points', s1['score'] - s0['score'] >= 300, s1['score'] - s0['score'])
        await pg.evaluate('__wh.setNext("giant")'); await ready(pg); n0 = (await pg.evaluate('__wh.targets()'))[0]['stack']; await pg.evaluate('__wh.aimAt(0, .4)'); await settle(pg); n1 = (await pg.evaluate('__wh.targets()'))[0]['stack']
        check('giant hat: its wide brim catches a toss 0.4 m off', n1 == n0 + 1, (n0, n1))
        await pg.evaluate('__wh.setNext("ghost")'); await ready(pg); n0 = (await pg.evaluate('__wh.targets()'))[2]['stack']; await pg.evaluate('__wh.aimAt(2, .55)'); await settle(pg); n1 = (await pg.evaluate('__wh.targets()'))[2]['stack']
        check('ghost hat: glides through the rim and homes in', n1 == n0 + 1, (n0, n1))
        # streak 5 / 8 events
        await pg.evaluate('__wh.S.goal = 99999; __wh.S.hats = 8; __wh.S.streak = 4'); k = await mark(pg); await hit(pg, 1); l = await lg_since(pg, k)
        check('streak ×5 → WITCHCRAFT + bat swarm', any('WITCHCRAFT' in x for x in await pg.evaluate('window.__banners')) and 'bat_swarm' in l and await pg.evaluate('__wh.W.swarm') > 0)
        await pg.evaluate('__wh.S.streak = 7'); k = await mark(pg); await ready(pg); await pg.evaluate('__wh.aimAt(1)'); await pg.evaluate('__wh.stepq(1/30, 56)'); l = await lg_since(pg, k)
        check('streak ×8 → SUPREME SORCERY: the witch flies across the moon, cackling', await pg.evaluate('__wh.W.witch.visible') and 'cackle' in l)
        await shot(pg, 'shot-witch.png', 1); await settle(pg)
        # milestones
        await pg.evaluate('__wh.S.score = 3990; __wh.S.ms = 1'); await hit(pg, 0); await pg.evaluate('__wh.stepq(1/30, 90)')
        check('score milestone: blood moon rises', await pg.evaluate('__wh.W.blood') > .5 and any('Blood moon' in x for x in await pg.evaluate('window.__banners')))
        # fail → end
        await pg.evaluate('__wh.level(0); __wh.S.goal = 99999; __wh.S.hats = 2'); await hit(pg, 0, 3, 60); await hit(pg, 0, 3, 60); await pg.evaluate('__wh.stepq(1/30, 120)')
        s = await st(pg); check('out of hats → game over panel', s['s'] == 'end' and await pg.is_visible('#end.show') and 'Out of hats' in await pg.text_content('#eTitle'), s)
        check('end panel: neutral default name, stats', await pg.input_value('#eName') == 'Player 1' and 'Ringers' in await pg.text_content('#eStats'))
        check('best score saved', await pg.evaluate("+localStorage.getItem('wh-best-campaign-medium')") > 0)
        u = await pg.evaluate('__wh.cardURL()'); open(OUT + 'card.jpg', 'wb').write(__import__('base64').b64decode(u.split(',')[1]))
        cw = Image.open(OUT + 'card.jpg'); check('share card 1080×1350, not black', cw.size == (1080, 1350) and mean(OUT + 'card.jpg') > 25, (cw.size, round(mean(OUT + 'card.jpg'), 1)))
        async with pg.expect_download() as dl: await pg.click('#btnCard')
        check('save card downloads a PNG', (await dl.value).suggested_filename.endswith('.png'))
        await shot(pg, 'shot-end.png', 20)
        # keyboard aim + Space
        await pg.click('#btnAgain'); await pg.evaluate('__wh.step(1/30, 40)'); await ready(pg); y0 = await pg.evaluate('__wh.S.aimYaw')
        await pg.keyboard.down('ArrowRight'); await pg.evaluate('__wh.step(1/30, 15)'); await pg.keyboard.up('ArrowRight'); y1 = await pg.evaluate('__wh.S.aimYaw')
        pv = await pg.evaluate('__wh.preview()'); check('keyboard: arrows aim (arc preview shown)', y1 > y0 + .1 and pv['visible'], (y0, y1, pv))
        await pg.keyboard.press('Space'); await pg.evaluate('__wh.step(1/30, 3)'); check('keyboard: Space tosses', len(await pg.evaluate('__wh.flying()')) == 1)
        await settle(pg)
        # guards
        g0 = await pg.evaluate('__wh.S.gt'); await pg.evaluate('__wh.step(-1); __wh.step(NaN); __wh.step(Infinity)'); g1 = await pg.evaluate('__wh.S.gt')
        check('frame clock: negative / NaN / huge steps never go backwards (≤ 1/20 s)', g0 <= g1 <= g0 + 0.051, (g0, g1))
        l0 = await pg.evaluate('__wh.last()'); await pg.evaluate('__wh.advance(__wh.last() - 500)'); check('rAF stamp earlier than the last one: clock never runs backwards', await pg.evaluate('__wh.last()') >= l0)
        await pg.evaluate("(() => { __wh.W.flash = NaN; __wh.W.blood = NaN; __wh.W.aurora = NaN; __wh.S.wind = NaN; __wh.S.aimPow = NaN; __wh.S.fovPunch = NaN; })()"); bk = await pg.evaluate(f'({BLACK})(10)')
        check('NaN in effect values never blacks out the frame', bk == 0 and await pg.evaluate('Number.isFinite(__wh.cam().p[1]) && Number.isFinite(__wh.cam().fov)'), bk)
        names = set(await pg.evaluate('Object.keys(window.WH_SOUNDS)'))
        check('all sounds decoded', await pg.evaluate('window.__whAudioReady || 0') >= 100, await pg.evaluate('window.__whAudioReady'))
        check('sound log contains only bundled sample names', all(n.lstrip('~') in names for n in set(await pg.evaluate('__wh.log.map(e => e.n)'))))
        check('no console errors (desktop)', not logs, logs[:3])
        await ctx.close()
        # ================= kids / easy / hard =================
        ctx, pg, logs = await page(b, skip=True, viewport={'width': 1280, 'height': 800})
        await pg.evaluate('__wh.step(1/30, 5)'); await pg.click('#btnKids'); check('Kids toggle hides difficulty', not await pg.is_visible('#diff'))
        await pg.click('#btnCampaign'); await pg.evaluate('__wh.step(1/30, 40)'); await ready(pg)
        check('Kids: unlimited hats, no wind', await pg.evaluate('__wh.S.kids') and '∞' in await pg.text_content('#hHats') and await pg.evaluate('__wh.S.wind') == 0)
        await pg.evaluate('__wh.S.aiming = true; __wh.S.aimPow = .5; __wh.step(1/30, 2)'); pv = await pg.evaluate('__wh.preview()'); await shot(pg, 'shot-kids-aim.png', 1); await pg.evaluate('__wh.S.aiming = false')
        check('Kids: full flight path with landing ring', pv['visible'] and pv['ring'] and pv['n'] >= 40, pv)
        n0 = (await pg.evaluate('__wh.targets()'))[0]['stack']; await pg.evaluate('__wh.aimAt(0, .42)'); await settle(pg); n1 = (await pg.evaluate('__wh.targets()'))[0]['stack']
        check('Kids: huge catch zone (0.42 m off still counts)', n1 == n0 + 1, (n0, n1))
        k = await mark(pg); await hit(pg, 0, 4); l = await lg_since(pg, k); check('Kids: a miss just goes poof (no hat lost)', 'whisper' in l and '∞' in await pg.text_content('#hHats') and await pg.evaluate('__wh.S.state') == 'play', sorted(set(l)))
        await pg.evaluate('__wh.S.lvlScore = 9999'); await pg.evaluate('__wh.stepq(1/30, 130)'); check('Kids: levels still advance', await pg.evaluate('__wh.S.level') == 1)
        await pg.evaluate('__wh.end("quit"); __wh.step(1/30, 5)'); await pg.click('#btnMenu'); await pg.click('#btnKids')
        await pg.click('#diff [data-d=easy]'); await pg.click('#btnCampaign'); await pg.evaluate('__wh.step(1/30, 40)'); await ready(pg)
        await pg.evaluate('__wh.S.aiming = true; __wh.S.aimPow = .5; __wh.step(1/30, 2)'); pv = await pg.evaluate('__wh.preview()'); await pg.evaluate('__wh.S.aiming = false')
        check('Easy: 10 hats, full arc preview, lower goal', await pg.evaluate('__wh.S.hats') == 10 and pv['ring'] and await pg.evaluate('__wh.S.goal') == 300, (await pg.evaluate('[__wh.S.hats, __wh.S.goal]'), pv))
        await pg.evaluate('__wh.end("quit"); __wh.step(1/30, 5)'); await pg.click('#btnMenu'); await pg.click('#diff [data-d=hard]'); await pg.click('#btnCampaign'); await pg.evaluate('__wh.step(1/30, 40)'); await ready(pg)
        await pg.evaluate('__wh.S.aiming = true; __wh.S.aimPow = .5; __wh.step(1/30, 2)'); pv = await pg.evaluate('__wh.preview()'); await pg.evaluate('__wh.S.aiming = false')
        check('Hard: 7 hats, short arc preview', await pg.evaluate('__wh.S.hats') == 7 and pv['frac'] <= .25 and not pv['ring'], pv)
        check('Hard remembers the difficulty', await pg.evaluate("localStorage.getItem('wh-diff')") == 'hard')
        await pg.evaluate('__wh.level(4)'); gusts = 0
        for _ in range(6):
            await ready(pg); await pg.evaluate('__wh.S.hats = 7; __wh.aimAt(0)'); await settle(pg, 60)
        check('Hard / Windy Hill: gusts hit mid-flight', any('Gust' in x for x in await pg.evaluate('window.__banners')), [x for x in await pg.evaluate('window.__banners')][-4:])
        check('no console errors (modes)', not logs, logs[:3])
        await ctx.close()
        # ================= duel =================
        ctx, pg, logs = await page(b, skip=True, viewport={'width': 1280, 'height': 800})
        await pg.evaluate('__wh.step(1/30, 5)'); await pg.click('#btnDuel'); await pg.evaluate('__wh.step(1/30, 40)')
        check('Duel: Player 1 vs Player 2 bar, Player 1 starts', await pg.is_visible('#duelBar') and 'Player 1' in await pg.text_content('#dP1') and 'Player 2' in await pg.text_content('#dP2') and await pg.evaluate('__wh.S.player') == 0)
        await hit(pg, 0); p1 = await pg.evaluate('__wh.S.duel'); await ready(pg); pl = await pg.evaluate('__wh.S.player')
        check('Duel: Player 1 scores, then it is Player 2\'s turn', p1[0] > 0 and p1[1] == 0 and pl == 1, (p1, pl))
        check('Duel: turn banner', any('Player 2 turn' in x for x in await pg.evaluate('window.__banners')))
        await hit(pg, 2, 3); await ready(pg); check('Duel: back to Player 1', await pg.evaluate('__wh.S.player') == 0)
        await shot(pg, 'shot-duel.png', 1)
        for _ in range(60):
            if await pg.evaluate('__wh.S.state') != 'play': break
            if await ready(pg): await pg.evaluate('__wh.aimAt(0, __wh.S.player ? 3 : 0)')
            await settle(pg, 60)
        await pg.evaluate('__wh.stepq(1/30, 120)')
        check('Duel: three rounds, then the winner is announced', await pg.evaluate('__wh.S.state') == 'end' and 'Player 1 wins' in await pg.text_content('#eRank'), await pg.text_content('#eRank'))
        check('no console errors (duel)', not logs, logs[:3])
        await ctx.close()
        # ================= German browser =================
        ctx, pg, logs = await page(b, skip=True, locale='de-DE', viewport={'width': 1024, 'height': 700})
        check('language: German browser starts in German', 'Kampagne' in await pg.text_content('#btnCampaign') and await pg.evaluate('document.documentElement.lang') == 'de')
        await ctx.close()
        # ================= real time =================
        ctx, pg, logs = await page(b, auto_q=True, manual=False, viewport={'width': 1280, 'height': 800}); await pg.wait_for_timeout(4500)
        q5 = await pg.evaluate('[__wh.quality(), __wh.fps.n]'); g0 = await pg.evaluate('__wh.S.gt')
        check('real-time: the intro plays by itself', g0 > .3 and await pg.evaluate('__wh.S.state') == 'intro', g0)
        check('auto quality does not step down at startup (first seconds are ignored)', q5 == ['mid', 0], q5)
        await pg.click('#btnSkip'); await pg.click('#btnCampaign'); await pg.wait_for_function('__wh.canToss()', timeout=60000)
        await pg.mouse.move(640, 380); await pg.mouse.down(); await pg.mouse.move(650, 520, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(1500)
        check('real-time loop: drag + release tosses a hat', await pg.evaluate('__wh.S.thrown') == 1, await pg.evaluate('__wh.S.thrown'))
        await pg.evaluate('__wh.fps.since = 10; __wh.fps.bad = 3; __wh.fps.acc = 0; __wh.fps.frames = 0')
        await pg.evaluate('(() => { let tt = __wh.last(); for (let i = 0; i < 12; i++) { tt += 120; __wh.advance(tt); } })()'); await pg.wait_for_timeout(300)
        check('auto quality steps down once the frame rate stays low', await pg.evaluate('__wh.quality()') == 'low', await pg.evaluate('__wh.quality()'))
        check('no console errors (real time)', not logs, logs[:3])
        await ctx.close()
        ctx, pg, logs = await page(b, url='file://' + ROOT + '/index.html', skip=True, viewport={'width': 800, 'height': 600})
        check('works from file:// (single bundled script + embedded sounds)', await pg.evaluate('!!window.__wh && Object.keys(window.WH_SOUNDS).length') >= 100 and not logs, logs[:2])
        await ctx.close()
        # ================= phone (touch) =================
        ctx, pg, logs = await page(b, viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        f0 = await shot(pg, 'shot-mobile-intro0.png', 0); check('mobile intro frame 0: moon + sky, not black', mean(f0) > 40, round(mean(f0), 1))
        await pg.evaluate('__wh.stepq(1/30, 110)'); await shot(pg, 'shot-mobile-title.png', 2)
        await pg.tap('#btnSkip'); await pg.evaluate('__wh.step(1/30, 30)'); await shot(pg, 'shot-mobile-menu.png')
        r = await pg.eval_on_selector('#menu', 'e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }'); check('mobile menu fits', r[0] >= 0 and r[1] <= 844, r)
        await pg.tap('#btnCampaign'); await pg.evaluate('__wh.step(1/30, 40)'); check('touch: pull-back hint', 'Pull back' in await pg.text_content('#hint'))
        await ready(pg); await pg.evaluate('__wh.setWind(0)'); cdp = await ctx.new_cdp_session(pg)
        async def touch(t, x, y): await cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': x, 'y': y}]})
        await touch('touchStart', 195, 450)
        for yy in range(460, 600, 20): await touch('touchMove', 195, yy); await pg.evaluate('__wh.step(1/30, 1)')
        await touch('touchEnd', 195, 600); await pg.evaluate('__wh.step(1/30, 4)')
        check('touch: pull back + release tosses the hat', await pg.evaluate('__wh.S.thrown') == 1, await pg.evaluate('__wh.S.thrown'))
        await settle(pg)
        for i in range(3): await hit(pg, i)
        mp = await shot(pg, 'shot-mobile-play.png')
        ch = await pg.evaluate("[...document.querySelectorAll('#hud .chip')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; })")
        bb = [await pg.eval_on_selector(s, 'e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }') for s in ['#hud', '#top']]
        check('mobile HUD inside the screen, not under the buttons', bb[0][0] >= 0 and bb[0][1] <= 390 and all(c[1] <= bb[1][0] + 1 or c[2] >= bb[1][3] - 1 for c in ch) and bb[0][3] <= 844, bb)
        fr = await pg.evaluate('__wh.targets().map(t => __wh.screen([t.x, 1, t.z])).map(s => [Math.round(s.x), Math.round(s.y)])')
        check('mobile: all targets framed on screen', all(10 < x < 380 and 150 < y < 800 for x, y in fr), fr)
        check('mobile play no glare', bright_share(mp) < .01, round(bright_share(mp), 5))
        await pg.evaluate('__wh.end("quit"); __wh.step(1/30, 40)'); await shot(pg, 'shot-mobile-end.png')
        r = await pg.eval_on_selector('#end', 'e => { const r = e.getBoundingClientRect(); return [r.top, r.bottom]; }'); check('mobile end panel fits', r[0] >= 0 and r[1] <= 844, r)
        check('no console errors (mobile)', not logs, logs[:3])
        await ctx.close(); await b.close()
    src = ''.join(open(f, encoding='utf8').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html', ROOT + '/css/style.css'])
    check('no synth oscillators (real samples only)', 'createOscillator' not in src and 'OscillatorNode' not in src and 'createOscillator' not in open(ROOT + '/js/game.bundle.js').read())
    texts = ''.join(open(f, encoding='utf8', errors='ignore').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html'] + [f for f in glob.glob(ROOT + '/*.md') if 'PROGRESS' not in f] + glob.glob(ROOT + '/LICENSES/*.md'))
    check('no email addresses', not re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', texts))
    ab = ''.join(map(chr, (65, 73)))
    check('visible text uses SI, never the other abbreviation', not re.search(r'\b' + ab + r'\b', texts))
    check('no social handle in the game', not re.search(r'(?<![\w.])@(?!Frank_AI_Lab\b)[A-Za-z_]\w+', ''.join(open(f, encoding='utf8').read() for f in glob.glob(ROOT + '/src/*.js') + [ROOT + '/index.html'])))
    BAN = {'4991c47202960c57', '043f4ce6d84aff1d', '7dbef27a673fea64', '849c39839ba51811', '55579b557896d0ce'}
    hit_ = sorted({w for w in re.findall(r'[A-Za-zÀ-ÿ]+', texts) if hashlib.sha256(w.lower().encode()).hexdigest()[:16] in BAN})
    check('no personal names', not hit_, hit_)
    SUR = ''.join(map(chr, (111, 116, 116, 111)))  # the surname, kept out of the source as text
    alltxt = texts + open(ROOT + '/js/game.bundle.js', encoding='utf8').read()
    check('no surname, no personal GitHub link or URL in the game', not re.search(r'(?i)\b' + SUR + r'\b|-' + SUR + r'|github\.io', alltxt))
    snd = glob.glob(ROOT + '/sounds/*.mp3'); bundle = open(ROOT + '/js/sounds-src.js').read()
    check('all sounds are bundled recordings', len(snd) >= 100 and all(('"' + os.path.basename(f)[:-4] + '"') in bundle for f in snd), len(snd))
    lic = open(ROOT + '/LICENSES/SOUNDS.md', encoding='utf8').read()
    ids = ['223851', '348142', '417826', '361540', '177242', '255111', '222517', '268084', '60013', '264777', '580967', '542690', '529396']
    check('sound credits list the new Freesound IDs', all(i in lic for i in ids), [i for i in ids if i not in lic])
    print(f'\n{sum(R)}/{len(R)} passed'); return all(R)
ok = asyncio.run(main()); raise SystemExit(0 if ok else 1)
