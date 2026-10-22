"""Witch Hat Toss – phone start-screen regression test (real touch emulation).
WebKit (iPhone 13, iPhone 8 = 375×667, iPhone SE = 320×568) + Chromium (Pixel 7), portrait and landscape.
Checks: ONE tap from page load lands in the campaign and a hat can be thrown; sound unlocks on that tap; every start-screen,
options-sheet and in-game control can be TAPPED (≥ 44 px, nothing covers it, nothing off-screen, no scrolling); language
auto-detect + DE/EN toggle; no overflow in German; no console errors.
Run: python3 test/test_mobile.py [base-url]   (exit code 0 = all checks passed; screenshots → test/shots/mobile/)"""
import asyncio, os, sys, threading, http.server, functools, socketserver, json
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('WH_SHOTS', ROOT + '/test/shots/mobile/'); os.makedirs(OUT, exist_ok=True)
if len(sys.argv) > 1: URL = sys.argv[1]
else:
    class _Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    _srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
    threading.Thread(target=_srv.serve_forever, daemon=True).start(); URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
ONLY = os.environ.get('WH_ONLY', '')
R = []
def check(n, ok, info=''): R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + (f' — {info}' if info != '' else ''), flush=True)
DEVICES = [  # engine, descriptor, landscape, browser locale
    ('webkit', 'iPhone 13', False, 'de-DE'), ('webkit', 'iPhone 13', True, 'en-US'), ('webkit', 'iPhone 8', False, 'de-AT'), ('webkit', 'iPhone 8', True, 'en-GB'),
    ('webkit', 'iPhone SE', False, 'en-US'), ('webkit', 'iPhone SE', True, 'de-DE'), ('chromium', 'Pixel 7', False, 'de-DE'), ('chromium', 'Pixel 7', True, 'en-US')]
HIT = """ids => ids.map(sel => { const e = document.querySelector(sel); if (!e) return [sel, 'missing'];
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2) return [sel, 'hidden'];
  if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return [sel, 'off-screen ' + [r.left, r.top, r.right, r.bottom].map(Math.round)];
  for (const [fx, fy] of [[.5, .5], [.2, .5], [.8, .5]]) { const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy); if (!t || !(t === e || e.contains(t))) return [sel, 'covered by ' + (t ? (t.id || t.tagName) : 'nothing')]; }
  if (r.height < 43.5 || r.width < 43.5) return [sel, 'too small ' + Math.round(r.width) + 'x' + Math.round(r.height)]; return [sel, 'ok']; })"""
async def ev(pg, js): return await pg.evaluate(js)
async def until(pg, js, secs=20):
    for _ in range(int(secs * 5)):
        try:
            if await pg.evaluate(js): return True
        except Exception: pass
        await pg.wait_for_timeout(200)
    return False
async def hits(pg, sel): h = dict(await ev(pg, f'({HIT})({json.dumps(sel)})')); return {k: v for k, v in h.items() if v != 'ok'}, h
async def run(p, eng, dev, land, loc):
    d = dict(p.devices[dev]); d.pop('default_browser_type', None)
    if land: d['viewport'] = {'width': d['viewport']['height'], 'height': d['viewport']['width']}
    W, H = d['viewport']['width'], d['viewport']['height']; tag = f"{dev.replace(' ', '')}-{'land' if land else 'port'}"; T = f'[{tag} {eng} {W}×{H} {loc}]'
    kw = {} if eng == 'webkit' else dict(executable_path='/usr/bin/google-chrome', args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    b = await (p.webkit if eng == 'webkit' else p.chromium).launch(**kw)
    ctx = await b.new_context(**d, locale=loc); await ctx.add_init_script("window.__whNoAutoQ = true; try{if(!sessionStorage.getItem('whInit')){sessionStorage.setItem('whInit','1'); localStorage.clear();}}catch(e){}")
    pg = await ctx.new_page(); pg.set_default_timeout(30000); errs = []; fails = []
    pg.on('console', lambda m: errs.append(m.text[:160]) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)[:160]))
    pg.on('requestfailed', lambda r: fails.append(r.url[-60:]))
    await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready") && window.__wh', timeout=90000)
    # ---------- 1) ONE TAP from page load → playing, and a hat can be thrown ----------
    await pg.wait_for_timeout(1200); st0 = await ev(pg, '__wh.S.state'); await pg.screenshot(path=f'{OUT}{tag}-0-opening.png')
    bad, _ = await hits(pg, ['#btnSkip']); check(f'{T} opens on the cinematic intro, "tap anywhere to play" label on screen (≥ 44 px)', st0 == 'intro' and not bad, (st0, bad))
    want = 'de' if loc.startswith('de') else 'en'; check(f'{T} language auto-detected from the browser ({want})', await ev(pg, '__wh.S.lang') == want and await ev(pg, 'document.documentElement.lang') == want)
    await pg.touchscreen.tap(W / 2, H * .45)  # ONE tap, anywhere
    ok = await until(pg, "__wh.S.state === 'play'", 10); info = await ev(pg, '[__wh.S.state, __wh.S.mode, __wh.S.level, __wh.S.diff, __wh.S.thrown]')
    check(f'{T} a single tap goes straight into the campaign (level 1, medium, nothing thrown by that tap)', ok and info == ['play', 'campaign', 0, 'medium', 0], info)
    check(f'{T} sound unlocks on that first tap (sound on by default)', await until(pg, "__wh.audioState() === 'running'", 5) and '🔊' in await ev(pg, "document.getElementById('btnSound').textContent"), await ev(pg, '__wh.audioState()'))
    check(f'{T} short in-game hint "pull back and let go"', await until(pg, "document.getElementById('hint').classList.contains('show')", 30) and len(await ev(pg, "document.getElementById('hint').textContent")) < 60, await ev(pg, "document.getElementById('hint').textContent"))
    await until(pg, '__wh.canToss()', 90); await pg.wait_for_timeout(300); await pg.screenshot(path=f'{OUT}{tag}-1-play.png')
    x, y0, y1 = W / 2, H * .5, H * .5 + min(W, H) * .3
    if eng == 'chromium':
        cdp = await ctx.new_cdp_session(pg)
        async def touch(t, xx, yy): await cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': xx, 'y': yy}]})
        await touch('touchStart', x, y0)
        for k in range(1, 9): await touch('touchMove', x, y0 + (y1 - y0) * k / 8); await pg.wait_for_timeout(30)
        await touch('touchEnd', x, y1)
    else:  # Playwright has no touch drag for WebKit: the same pointer-event path with a mouse pointer
        await pg.mouse.move(x, y0); await pg.mouse.down()
        for k in range(1, 9): await pg.mouse.move(x, y0 + (y1 - y0) * k / 8); await pg.wait_for_timeout(30)
        await pg.mouse.up()
    check(f'{T} pull back + let go throws the hat', await until(pg, '__wh.S.thrown === 1', 5), await ev(pg, '__wh.S.thrown'))
    bad, h = await hits(pg, ['#btnQuit', '#btnQ', '#btnSound', '#btnLang']); check(f'{T} in play: ✕, quality, sound, DE/EN tappable (≥ 44 px)', not bad, bad or h)
    of = await ev(pg, "[...document.querySelectorAll('#hud .chip, #side .chip, #hint')].filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0).filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1; }).map(e => e.id)")
    check(f'{T} in play: HUD and hint on screen', not of, of)
    # ---------- 2) the start screen: one big PLAY, everything else in the sheet, all tappable ----------
    await ev(pg, '__wh.end("quit"); __wh.toMenu()'); await pg.wait_for_timeout(1300); await pg.screenshot(path=f'{OUT}{tag}-2-menu.png')
    lay = await ev(pg, """(() => { const r = s => document.querySelector(s).getBoundingClientRect(); const p = r('#btnPlay'), h = r('#menu h1'), c = r('#menu .credit'), m = r('#btnMore'), sub = r('#menu .sub');
      const ov = (a, b) => a.width > 0 && b.width > 0 && !(a.bottom <= b.top || a.top >= b.bottom) && !(a.right <= b.left || a.left >= b.right);
      return { p: [p.left, p.top, p.width, p.height].map(Math.round), cy: (p.top + p.height / 2) / innerHeight, overlap: ov(h, p) || ov(sub, p) || ov(h, r('#top')),
        scroll: document.scrollingElement.scrollHeight > innerHeight + 1 || document.getElementById('menu').scrollHeight > document.getElementById('menu').clientHeight + 1, inView: (c.height === 0 || c.bottom <= innerHeight + 1) && m.bottom <= innerHeight + 1 && h.top >= 0 }; })()""")
    check(f'{T} start screen: one big PLAY (≥ 60 px tall, ≥ 220 px wide) in the thumb zone, title clear of it, no scrolling', lay['p'][3] >= 60 and lay['p'][2] >= 220 and (.45 if land else .55) <= lay['cy'] <= .92 and not lay['overlap'] and not lay['scroll'] and lay['inView'], lay)
    bad, h = await hits(pg, ['#btnPlay', '#btnMore', '#btnLang', '#btnSound']); check(f'{T} start screen: PLAY, options, DE/EN and sound are all tappable (≥ 44 px, nothing covers them)', not bad, bad or h)
    check(f'{T} start screen: no toast, no HUD, no hidden panel painted', await ev(pg, "['toast', 'hud', 'side', 'end', 'more', 'hint'].every(id => getComputedStyle(document.getElementById(id)).visibility === 'hidden')"))
    l0 = await ev(pg, '__wh.S.lang'); await pg.tap('#btnLang'); l1 = await ev(pg, '__wh.S.lang'); p1 = await ev(pg, "document.getElementById('btnPlay').textContent"); await pg.tap('#btnLang'); l2 = await ev(pg, '__wh.S.lang')
    check(f'{T} tap DE/EN toggles the language and back', l0 != l1 and l2 == l0 and (('Spielen' in p1) == (l1 == 'de')), (l0, l1, l2, p1))
    s0 = await ev(pg, "document.getElementById('btnSound').textContent"); await pg.tap('#btnSound'); s1 = await ev(pg, "document.getElementById('btnSound').textContent"); await pg.tap('#btnSound')
    check(f'{T} tap sound mutes / unmutes', s0 != s1 and await ev(pg, "document.getElementById('btnSound').textContent") == s0, (s0, s1))
    # German (the longest strings) must fit
    await ev(pg, "__wh.S.lang === 'de' || document.getElementById('btnLang').click()")
    OF = "[...document.querySelectorAll('#menu button, #menu button *, #more button, #more button *, #menu h1 span, #menu .kicker, #btnSkip')].filter(e => e.getBoundingClientRect().width > 0).filter(e => e.scrollWidth > e.clientWidth + 2 || e.getBoundingClientRect().right > innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => e.id || e.className || e.tagName)"
    of = await ev(pg, OF); check(f'{T} German: no text overflows its button or the screen (start screen)', not of, of)
    await pg.tap('#btnMore'); await pg.wait_for_timeout(900); await pg.screenshot(path=f'{OUT}{tag}-3-options-de.png')
    check(f'{T} German labels: "⚙ Modi & Optionen" button and sheet title', (await ev(pg, "document.getElementById('btnMore').textContent")).strip() == '⚙ Modi & Optionen' and await ev(pg, "document.getElementById('moreT').textContent") == 'Modi & Optionen')
    sh = await ev(pg, "(() => { const m = document.getElementById('more'); return [m.classList.contains('show'), m.scrollHeight > m.clientHeight + 1]; })()")
    sel = ['#btnMoreX', '#btnDuel', '#diff button[data-d=easy]', '#diff button[data-d=medium]', '#diff button[data-d=hard]', '#btnKids', '#btnQ2', '#btnIntro']
    bad, h = await hits(pg, sel); of = await ev(pg, OF)
    check(f'{T} options sheet: duel, difficulty, kids, quality, intro, close all on screen and tappable (≥ 44 px), no scrolling, German fits', sh[0] and not sh[1] and not bad and not of, (sh, bad or h, of))
    q0 = await ev(pg, '__wh.quality()'); await pg.tap('#btnQ2'); await pg.wait_for_timeout(500); q1 = await ev(pg, '__wh.quality()'); ql = await ev(pg, "document.getElementById('btnQ2').textContent"); await ev(pg, "__wh.quality('mid')")
    await pg.tap('#btnKids'); k1 = await ev(pg, '__wh.S.kids'); await pg.tap('#btnKids'); k2 = await ev(pg, '__wh.S.kids')
    await pg.tap('#diff button[data-d=easy]'); d1 = await ev(pg, '__wh.S.diff'); await pg.tap('#diff button[data-d=medium]'); d2 = await ev(pg, '__wh.S.diff')
    check(f'{T} options by tap: quality switches, kids mode on/off, difficulty easy → medium', q0 != q1 and k1 and not k2 and d1 == 'easy' and d2 == 'medium', (q0, q1, ql, k1, k2, d1, d2))
    await pg.tap('#btnMoreX'); await pg.wait_for_timeout(500); closed = not await ev(pg, "document.getElementById('more').classList.contains('show')")
    await pg.tap('#btnMore'); await pg.wait_for_timeout(600); await pg.tap('#btnDuel'); duel = await until(pg, "__wh.S.state === 'play' && __wh.S.mode === 'duel'", 8)
    check(f'{T} close (✕) works; duel (Player 1 vs Player 2) starts by tap', closed and duel, (closed, duel))
    await ev(pg, '__wh.end("quit"); __wh.toMenu()'); await pg.wait_for_timeout(700); await pg.tap('#btnMore'); await pg.wait_for_timeout(600); await pg.tap('#btnIntro'); intro = await until(pg, "__wh.S.state === 'intro'", 5)
    await pg.wait_for_timeout(800); await pg.touchscreen.tap(W * .3, H * .3); intro2 = await until(pg, "__wh.S.state === 'play' && __wh.S.mode === 'campaign'", 8)
    check(f'{T} intro replay from the sheet, and a tap on the replayed intro goes into play', intro and intro2, (intro, intro2))
    await ev(pg, '__wh.end("quit"); __wh.toMenu()'); await pg.wait_for_timeout(900); await pg.tap('#btnPlay'); pl = await until(pg, "__wh.S.state === 'play' && __wh.S.mode === 'campaign'", 8)
    check(f'{T} tap PLAY starts the campaign', pl)
    check(f'{T} no console errors, no failed requests', not errs and not fails, (errs[:3], fails[:3]))
    await b.close()
async def main():
    async with async_playwright() as p:
        for eng, dev, land, loc in DEVICES:
            if ONLY and ONLY not in dev.replace(' ', ''): continue
            for attempt in (1, 2):  # headless WPE WebKit's software compositor sometimes segfaults: retry once, say so
                n0 = len(R)
                try: await run(p, eng, dev, land, loc); break
                except Exception as e:
                    msg = str(e).split('\n')[0][:300]
                    if attempt == 1 and 'crash' in msg.lower(): del R[n0:]; print(f'RETRY [{dev} {"land" if land else "port"}] browser process crashed ({msg}) – rerunning this device once', flush=True); continue
                    check(f'[{dev} {"land" if land else "port"}] run finished', False, msg)
    print(f'\n{sum(R)}/{len(R)} checks passed'); sys.exit(0 if R and all(R) else 1)
asyncio.run(main())
