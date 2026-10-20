import asyncio, os, sys, json
from playwright.async_api import async_playwright
import threading, http.server, functools, socketserver
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
class _Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
_srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(_Q, directory=ROOT)); _srv.daemon_threads = True
threading.Thread(target=_srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % _srv.server_address[1]
OUT = ROOT + '/test/shots/'; os.makedirs(OUT, exist_ok=True)
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True, args=ARGS)
        phone = 'phone' in sys.argv
        vp = {'width': 1280, 'height': 800} if not phone else {'width': 390, 'height': 844}
        ctx = await b.new_context(viewport=vp, **({'has_touch': True, 'is_mobile': True, 'device_scale_factor': 2} if phone else {}))
        await ctx.add_init_script("window.__whSeed=4242;window.__whPDB=true;window.__whNoAutoQ=true;window.__whManual=true;")
        pg = await ctx.new_page(); logs = []
        pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None); pg.on('pageerror', lambda e: logs.append(f'PAGEERROR {e}'))
        await pg.goto(URL); await pg.wait_for_function('document.body.classList.contains("ready")', timeout=90000)
        pre = 'p-' if phone else ''
        tprev = 0
        for tt in ([0, .5, 1.0, 1.4, 1.7, 2.2, 3.0, 3.5, 3.7, 4.2, 5.5, 7.0] if 'intro' in sys.argv or not phone else [0, 1.0, 2.5, 3.7, 5]):
            n = round((tt - tprev) * 30); tprev = tt
            await pg.evaluate(f'__wh.step(1/30, {max(1,n)})'); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + f'{pre}intro-{tt}.png')
        await pg.evaluate('__wh.step(1/30, 60)'); await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + pre + 'menu.png')
        print('state', await pg.evaluate('__wh.S.state'))
        await pg.evaluate("__wh.start('campaign'); __wh.step(1/30, 40)"); await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + pre + 'play0.png')
        res = []
        for lv in range(int(os.environ.get('N', 6))):
            r = await pg.evaluate('''(() => { for (let i = 0; i < 200 && !__wh.canToss(); i++) __wh.stepq(1/30); const ts = __wh.targets(); const i = Math.floor(Math.random() * ts.length); __wh.aimAt(i); __wh.stepq(1/30, 8); return 1; })()''')
            await pg.evaluate('__wh.step(1/30, 12)'); await pg.wait_for_timeout(200)
            if lv == 1: await pg.screenshot(path=OUT + pre + 'flight.png')
            await pg.evaluate('__wh.stepq(1/30, 40)')
            res.append(await pg.evaluate('[__wh.S.score, __wh.S.streak, __wh.S.hats, __wh.S.level, __wh.targets().map(t=>t.stack).join("")]'))
        print(res)
        await pg.evaluate('__wh.step(1/30, 2)'); await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + pre + 'play1.png')
        await pg.evaluate("(() => { for (let i = 0; i < 200 && !__wh.canToss(); i++) __wh.stepq(1/30); __wh.S.aiming = true; __wh.S.aimPow = .6; __wh.S.aimYaw = .1; __wh.step(1/30, 2); })()"); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT + pre + 'aim.png')
        await pg.evaluate("__wh.S.aiming = false; __wh.level(3); __wh.step(1/30, 60)"); await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + pre + 'level4.png')
        await pg.evaluate("__wh.level(5); __wh.step(1/30, 60)"); await pg.wait_for_timeout(500); await pg.screenshot(path=OUT + pre + 'level6.png')
        print('LOGS', logs[:10])
        await b.close()
asyncio.run(main())
