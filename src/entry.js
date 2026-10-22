import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createWorld, updateWorld, swarm, flyWitch, QUALITY, MOON_DIR } from './world.js';
import { HAT_KINDS, makeHat, makeTarget, catchY, tipY, TARGETS } from './hats.js';
import { createFX, sparks, puff, updateFX } from './fx.js';
import { Player } from './music.js';
import * as A from './audio.js';
import { T } from './i18n.js';

const CREDIT_TXT = 'Built with Grok Bot · 8 days to Halloween 🎃';
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let seed = (window.__whSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x), fin = (v, d = 0) => Number.isFinite(v) ? v : d;
const eo = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3), eio = k => { k = clamp(k, 0, 1); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
const browserLang = () => { try { return (navigator.languages && navigator.languages[0] || navigator.language || 'en').toLowerCase().startsWith('de') ? 'de' : 'en'; } catch (e) { return 'en'; } };
// ---------------- rules ----------------
const DIFF = {
  easy: { hats: 10, goal: .75, wind: .45, tol: 1.3, preview: 1, special: 4, gust: 0 },
  medium: { hats: 8, goal: 1, wind: 1, tol: 1, preview: .45, special: 5, gust: 1 },
  hard: { hats: 7, goal: 1.25, wind: 1.5, tol: .8, preview: .2, special: 6, gust: 1 },
  kids: { hats: 0, goal: .6, wind: 0, tol: 1.75, preview: 1, special: 3, gust: 0 }
};
const LEVELS = [
  { t: [['pumpkin', -2.4, -6.5], ['pumpkin', 2.3, -8.5], ['pumpkin', 0, -11.5]], wind: [0, 0], goal: 400 },
  { t: [['pumpkin', -3.1, -7], ['spike', -1.7, -12.5], ['spike', 1.9, -13.5], ['pumpkin', 3, -9]], wind: [0, .7], goal: 650 },
  { t: [['broom', -3.5, -10], ['scarecrow', 0, -18], ['broom', 3.6, -12.5], ['pumpkin', -.8, -7.5]], wind: [.3, 1.2], goal: 900 },
  { t: [['ghost', 0, -11], ['ghost', 0, -16.5], ['spike', -4.2, -9], ['pumpkin', 3.8, -7]], wind: [.3, 1.2], goal: 1100 },
  { t: [['spike', -3, -11], ['broom', 3, -14], ['scarecrow', -1, -20], ['pumpkin', 1.6, -7.5], ['spike', 4.6, -9.5]], wind: [1, 2.2], gusts: true, goal: 1300 },
  { t: [['ghost', 0, -13], ['scarecrow', 3.5, -20], ['broom', -4, -15], ['pumpkin', -2, -7], ['spike', 2.5, -9.5], ['ghost', 0, -19]], wind: [.6, 2], gusts: true, goal: 1700, blood: true }
];
const GRAV = 9.81, ORIGIN = new THREE.Vector3(0, 1.8, 1.2), EL = .70, VMIN = 4.6, VMAX = 15.6, DUEL_HATS = 5, DUEL_LEVELS = 3;
const MILESTONES = [[1500, 'm1000'], [4000, 'm2500'], [8000, 'm5000']];
const S = { state: 'intro', mode: 'campaign', lang: ls.get('wh-lang', '') || browserLang(), diff: ls.get('wh-diff', 'medium'), kids: ls.get('wh-kids', '0') === '1', q: ls.get('wh-q', ''), qUser: !!ls.get('wh-q', ''),
  name: ls.get('wh-name', 'Player 1') || 'Player 1', gt: 0, score: 0, lvlScore: 0, level: 0, encore: 0, hats: 0, streak: 0, bestStreak: 0, ringers: 0, perfects: 0, thrown: 0, ms: 0, wind: 0, windBase: 0,
  aimYaw: 0, aimPow: .5, aiming: false, kbAim: false, vx: 0, vy: 0, fovPunch: 0, player: 0, duel: [0, 0], duelHats: [0, 0], introT: 0, newBest: false, end: '' };
if (!DIFF[S.diff] || S.diff === 'kids') S.diff = 'medium';
if (!QUALITY[S.q]) { S.q = 'mid'; S.qUser = false; }
const dkey = () => S.kids ? 'kids' : S.diff, D = () => DIFF[dkey()], bestKey = (m = S.mode) => `wh-best-${m}-${dkey()}`;
A.setClock(() => S.gt);
const t = k => T[S.lang][k] ?? T.en[k] ?? k;

// ---------------- renderer / scene ----------------
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__whPDB });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2; renderer.shadowMap.type = THREE.PCFShadowMap;
const W = createWorld(renderer, QUALITY[S.q], 12); const scene = W.scene;
const camera = new THREE.PerspectiveCamera(50, 1, .1, 400);
const F = createFX(scene, W.soft, W.smokeTex);
let composer, bloom;
function buildComposer() { if (composer) composer.dispose(); composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera)); bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .45, .5, .82); composer.addPass(bloom); composer.addPass(new OutputPass()); }
function applyQuality(qn, user) {
  S.q = qn; if (user) { S.qUser = true; ls.set('wh-q', qn); } const q = QUALITY[qn];
  renderer.shadowMap.enabled = q.shadows; W.key.castShadow = q.shadows; if (q.shadows) { W.key.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (W.key.shadow.map) { W.key.shadow.map.dispose(); W.key.shadow.map = null; } }
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  buildComposer(); resize(); $('btnQ').textContent = '⚙ ' + t('q_' + qn); if ($('btnQ2')) $('btnQ2').textContent = `⚙ ${t('q_' + qn)}${S.qUser ? '' : ' · ' + t('auto')}`;
}
let VW = 1, VH = 1; const portrait = () => VW / VH < .85, wide = () => VW >= 820 && VW >= VH;
function resize() { VW = window.innerWidth; VH = window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, QUALITY[S.q].dpr);
  renderer.setPixelRatio(dpr); renderer.setSize(VW, VH, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(VW, VH); } camera.aspect = VW / VH; camera.updateProjectionMatrix(); }

// ---------------- targets / level layout ----------------
const targets = []; const flying = []; let hand = null, handKind = 'normal', queue = [];
// free every target's own GPU resources when a level is rebuilt (shared world/pumpkin/hat materials and cached label textures are kept)
function clearTargets() { const keep = new Set(Object.values(W.mats));
  for (const T0 of targets) { for (const H of T0.stack) H.g.parent && H.g.parent.remove(H.g); scene.remove(T0.g);
    T0.g.traverse(o => { if (o.geometry && !o.isSprite) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!keep.has(m) && !m.userData.keep) m.dispose(); }); });
    (T0.own || []).forEach(x => x.dispose()); } targets.length = 0; }
function levelDef(i) { if (S.mode === 'duel') return LEVELS[i % 3]; return i < LEVELS.length ? LEVELS[i] : LEVELS[3 + ((i - LEVELS.length) % 3)]; }
const MARK_COL = { pumpkin: '#ffa040', spike: '#9ab8ff', broom: '#c890ff', scarecrow: '#ffe070', ghost: '#7af0ff' };
const _labels = {}; function labelTex(txt, col) { const key = txt + col; if (_labels[key]) return _labels[key]; const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.font = '700 64px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(10,6,24,.85)'; g.strokeText(txt, 128, 50); g.fillStyle = col; g.fillText(txt, 128, 50); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return (_labels[key] = tx); }
function addMarker(T0) { const col = MARK_COL[T0.kind]; const m = new THREE.Mesh(new THREE.RingGeometry(.62, .78, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); m.rotation.x = -Math.PI / 2; m.position.y = .03; T0.g.add(m); T0.ring = m;
  const lab = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('+' + T0.pts, col), transparent: true, depthWrite: false, fog: false })); lab.scale.set(1.1, .41, 1); lab.position.y = T0.tip + (T0.inner ? 1.2 : 0) + .55; T0.g.add(lab); T0.label = lab; }
function buildLevel(i) { clearTargets(); const L = levelDef(i); L.t.forEach(([k, x, z], j) => { const T0 = makeTarget(k, 100 + i * 17 + j * 5, W); T0.x0 = x; T0.z0 = z; T0.g.position.set(x, 0, z); addMarker(T0); scene.add(T0.g); targets.push(T0); });
  W.blood = L.blood || S.ms >= 2 ? 1 : 0; S.lvlScore = 0; S.goal = Math.round(L.goal * D().goal * (1 + .25 * Math.max(0, i - 5)) / 10) * 10; }
function moveTargets(dt) { for (const T0 of targets) { if (T0.moving) { const k = 1 + .15 * Math.max(0, S.level - 3); T0.g.position.x = T0.x0 + Math.sin(S.gt * T0.spd * k + T0.ph) * T0.amp; T0.inner.position.y = 1.2 + Math.sin(S.gt * 1.7 + T0.ph) * .14; T0.inner.rotation.y = Math.sin(S.gt * .9 + T0.ph) * .3; }
    if (T0.ring) { T0.ring.material.opacity = (S.state === 'play' ? .38 : .18) + Math.sin(S.gt * 3 + T0.ph) * .12; T0.ring.scale.setScalar(1 + Math.sin(S.gt * 3 + T0.ph) * .04); T0.label.visible = S.state === 'play'; T0.label.position.y = T0.tip + (T0.inner ? T0.inner.position.y : 0) + .55 + T0.stack.length * .085 + Math.sin(S.gt * 2 + T0.ph) * .05; }
    if (T0.sway) T0.g.rotation.z = Math.sin(S.gt * 1.3 + T0.ph) * .03 + S.wind * .012;
    if (T0.squash > 0) { T0.squash = Math.max(0, T0.squash - dt * 3); const k = Math.sin(T0.squash * 14) * T0.squash * .12; T0.g.scale.set(1 + k * .5, 1 - k, 1 + k * .5); } else T0.g.scale.set(1, 1, 1);
    if (T0.face) T0.face.emissiveIntensity = 1.1 + (T0.flare || 0) * 3 + Math.sin(S.gt * 9 + T0.ph) * .15; if (T0.headMat) T0.headMat.emissiveIntensity = (T0.flare || 0) * .8; T0.flare = Math.max(0, (T0.flare || 0) - dt * 1.5);
    T0.stack.forEach((h, i) => { h.wob = Math.max(0, (h.wob || 0) - dt * 1.6); const w = Math.sin(S.gt * 13 + i) * h.wob * .25; h.g.rotation.set(w, h.g.rotation.y + h.spin * dt, w * .6); h.spin *= Math.exp(-dt * 2.5); }); } }
function targetAxis(T0, out) { T0.g.updateMatrixWorld(); return out.set(T0.g.position.x, 0, T0.g.position.z); }

// ---------------- hats: queue, hand, toss, flight ----------------
function genKind(n) { const sp = D().special; if (n > 0 && n % sp === sp - 1) return ['golden', 'giant', 'ghost'][Math.floor(n / sp) % 3]; return 'normal'; }
function nextHat() { while (queue.length < 2) queue.push(genKind(S.thrown + queue.length)); return queue[0]; }
function spawnHand() { if (hand) return; const k = nextHat(); handKind = k; hand = makeHat(k, (S.thrown + (S.player ? 2 : 0)) % 5); hand.g.position.copy(ORIGIN); hand.spawnT = S.gt; scene.add(hand.g); A.sfx.pick(); if (k !== 'normal') { banner(t(k)); A.sfx.special(k); } renderNext(); newWind(); }
function newWind() { const L = levelDef(S.level); const [lo, hi] = L.wind; const w = (lo + rng() * (hi - lo)) * D().wind * (S.mode === 'duel' ? .8 : 1); S.windBase = (rng() < .5 ? -1 : 1) * w; S.wind = S.windBase; S.gust = null; }
function launchVel(yaw, pow, out) { const v = lerp(VMIN, VMAX, clamp(pow, 0, 1)); return out.set(Math.sin(yaw) * Math.cos(EL) * v, Math.sin(EL) * v, -Math.cos(yaw) * Math.cos(EL) * v); }
function canToss() { return S.state === 'play' && hand && S.gt - hand.spawnT > .35 && !S.lvlDone && (S.kids || S.mode === 'duel' || S.hats > 0); }
function toss(yaw = S.aimYaw, pow = S.aimPow) { if (!canToss()) return false; yaw = clamp(fin(yaw), -.6, .6); pow = clamp(fin(pow), 0, 1);
  const H = hand; hand = null; queue.shift(); if (H.glow) { H.glow.material.opacity = .45; H.glow.scale.setScalar(1.3 * H.scale); } H.v = launchVel(yaw, pow, new THREE.Vector3()); H.p = ORIGIN.clone(); H.g.position.copy(H.p); H.state = 'fly'; H.t0 = S.gt; H.spinA = 0; H.spinW = 9 + pow * 7; H.rimHits = 0; H.bounces = 0; H.prevY = H.p.y; H.yaw = yaw; H.pow = pow; H.player = S.player;
  flying.push(H); S.thrown++; if (!S.kids && S.mode !== 'duel') S.hats--; if (S.mode === 'duel') S.duelHats[S.player]--; A.sfx.toss(pow, clamp(yaw * 1.5, -.7, .7)); S.aiming = false; $('power').classList.remove('show'); $('hint').classList.remove('show');
  if (levelDef(S.level).gusts && D().gust && rng() < .55) S.gust = { at: S.gt + .3 + rng() * .5, k: (rng() < .5 ? -1 : 1) * (.8 + rng() * 1.2) * D().wind };
  S.nextHandAt = S.gt + .7; setUI(); return true; }
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _ax = new THREE.Vector3();
// one physics sub-step for a flying hat (shared by the game, the arc preview and the aim solver)
function hatStep(p, v, h, wind, kind, prevY) { v.x += wind * h; v.y -= GRAV * h; const dr = Math.exp(-.06 * h); v.multiplyScalar(dr); p.addScaledVector(v, h); }
function flyUpdate(H, dt) { const h = 1 / 120; H.acc = (H.acc || 0) + dt; let n = 0;
  while (H.acc >= h && n < 30 && H.state === 'fly') { H.acc -= h; n++; const py = H.p.y;
    if (H.kind === 'ghost' && H.v.y < 0) { let best = null, bd = 1.8; for (const T0 of targets) { const dx = T0.g.position.x - H.p.x, dz = T0.g.position.z - H.p.z, d = Math.hypot(dx, dz); if (d < bd && H.p.y > tipY(T0) - .1) { bd = d; best = [dx / (d || 1), dz / (d || 1)]; } } if (best) { H.v.x += best[0] * 5 * h; H.v.z += best[1] * 5 * h; } }
    hatStep(H.p, H.v, h, S.wind, H.kind); H.spinA += H.spinW * h;
    if (!Number.isFinite(H.p.x + H.p.y + H.p.z + H.v.x + H.v.y + H.v.z)) { H.p.set(0, -1, -5); H.v.set(0, 0, 0); }
    if (!H.rel) H.rel = new Map(); for (const T0 of targets) { const ty = tipY(T0), rel = H.p.y - ty, pr = H.rel.has(T0) ? H.rel.get(T0) : py - ty; H.rel.set(T0, rel); if (pr > 0 && rel <= 0 && H.v.y < 0) { /* relative crossing: a bobbing ghost can rise past the hat between frames */ const dx = H.p.x - T0.g.position.x, dz = H.p.z - T0.g.position.z, d = Math.hypot(dx, dz); const tol = T0.tol * D().tol * H.scale, rimW = .2 * H.scale;
        if (d <= tol || (H.kind === 'ghost' && d <= tol + rimW + .12)) { catchHat(H, T0, d, tol, d > tol); break; }
        if (d <= tol + rimW && H.rimHits < 3) { H.rimHits++; const nx = dx / (d || 1), nz = dz / (d || 1); const vn = H.v.x * nx + H.v.z * nz; H.v.x -= 1.6 * Math.min(0, vn) * nx; H.v.z -= 1.6 * Math.min(0, vn) * nz; H.v.x = H.v.x * .45 + nx * 1.4; H.v.z = H.v.z * .45 + nz * 1.4; H.v.y = Math.abs(H.v.y) * .35 + 1.2; H.p.y = ty + .01; H.spinW *= -.7; H.wobT = 1;
          A.sfx.rim(pan(H.p.x)); popAt(t('rim'), '#cfd8ff', .9, H.p); sparks(F, H.p.clone(), 14, { colors: ['#ffd9a0', '#ffffff'], speed: 2, up: 1, life: .5, grav: 4, size: .05 }); T0.squash = .5; } } }
    if (H.state !== 'fly') break;
    for (const T0 of targets) for (const [by, br] of T0.bodies) { const cy = T0.g.position.y + (T0.inner ? T0.inner.position.y : 0) + by; const dx = H.p.x - T0.g.position.x, dz = H.p.z - T0.g.position.z, d = Math.hypot(dx, dz), dy = H.p.y - cy;
      if (d < br + .18 * H.scale && Math.abs(dy) < br * .9 && H.bounces < 4) { H.bounces++; const nx = dx / (d || 1), nz = dz / (d || 1); H.p.x = T0.g.position.x + nx * (br + .19 * H.scale); H.p.z = T0.g.position.z + nz * (br + .19 * H.scale); H.v.x = nx * 1.6 + H.v.x * .2; H.v.z = nz * 1.6 + H.v.z * .2; H.v.y = Math.max(H.v.y * .3, .6); H.wobT = 1; A.sfx.rim(pan(H.p.x)); T0.squash = .4; } }
    if (H.p.y <= 0) { H.p.y = 0; if (!H.missed) { H.missed = true; missHat(H); } if (Math.abs(H.v.y) > 1.2 && H.bounces < 6) { H.bounces++; H.v.y = -H.v.y * .25; H.v.x *= .45; H.v.z *= .45; H.spinW *= .5; } else { H.state = 'down'; H.downT = S.gt; H.v.set(0, 0, 0); } } }
  if (n >= 30) H.acc = 0; }
function hatPose(H, dt) { // spin about its own axis, tilt with the flight path, precession wobble
  const vh = Math.hypot(H.v.x, H.v.z); H.wobT = Math.max(0, (H.wobT || 0) - dt * 1.2);
  _ax.set(Math.sin(H.spinA * .23) * (.12 + H.wobT * .5) + H.v.x * .02, 1, Math.cos(H.spinA * .23) * (.12 + H.wobT * .5) + H.v.z * .02 - H.v.y * .012).normalize();
  _q.setFromUnitVectors(_up, _ax); _q2.setFromAxisAngle(_up, H.spinA); H.g.quaternion.copy(_q).multiply(_q2); H.g.position.copy(H.p); }
function pan(x) { return clamp(x / 6, -.8, .8); }
const comboMult = n => n >= 8 ? 4 : n >= 5 ? 3 : n >= 3 ? 2 : 1;
function catchHat(H, T0, d, tol, saved) { H.state = 'seat'; H.seatT = 0; H.target = T0; H.from = H.p.clone(); H.idx = T0.stack.length; T0.stack.push(H);
  const perfect = !saved && d <= tol * .38, swish = H.rimHits === 0 && !saved, kind = HAT_KINDS[H.kind];
  if (S.mode === 'duel') { S.pstreak = S.pstreak || [0, 0]; S.pstreak[H.player]++; S.streak = S.pstreak[H.player]; } else S.streak++;
  S.bestStreak = Math.max(S.bestStreak, S.streak); S.ringers++; if (perfect) S.perfects++;
  const pts = Math.round(((T0.pts * (perfect ? 1.5 : 1)) + (swish ? 25 : 0) + 60 * H.idx) * kind.pts * comboMult(S.streak) / 5) * 5; addScore(pts, H.player);
  const k = clamp(Math.abs(H.v.y) / 8, .3, 1); A.sfx.land(T0.kind, k, pan(H.p.x)); A.sfx.ringer(S.streak, perfect); if (perfect) A.sfx.perfectHit();
  T0.squash = 1; T0.flare = 1; H.spin = H.spinW * .4; S.fovPunch = perfect ? 1 : .6;
  const at = new THREE.Vector3(T0.g.position.x, catchY(T0), T0.g.position.z); const gold = H.kind === 'golden';
  sparks(F, at, Math.round((perfect ? 110 : 60) * QUALITY[S.q].parts), { colors: gold ? ['#ffe080', '#ffffff', '#ffb030'] : perfect ? ['#ffcf6a', '#ffffff', '#c890ff'] : ['#ffb04a', '#ffe0a0'], speed: perfect ? 3.6 : 2.6, up: 1.8, life: .9, grav: 3, size: .09 });
  puff(F, at, 3, '#8a7aa8', .7); ring(at, perfect ? '#ffcf6a' : '#c890ff');
  const lab = saved ? t('saved') : perfect ? t('perfect') : swish ? t('swish') : t('ringer'); const stk = H.idx > 0 ? `  ${t('stack')} ×${H.idx + 1}` : '';
  popAt(`${lab}${stk}  +${pts}`, perfect ? '#ffcf6a' : '#d8c0ff', perfect ? 1.35 : 1.15, at);
  if (S.streak === 3) { banner(t('hattrick')); fireworks(3); A.sfx.streak(3); } else if (S.streak === 5) { banner(t('witchcraft')); swarm(W); A.sfx.bats(); A.sfx.streak(5); fireworks(4); }
  else if (S.streak === 8 || (S.streak > 8 && S.streak % 4 === 0)) { banner(t('sorcery')); flyWitch(W, 3.4, true); A.sfx.witch(); A.sfx.streak(8); fireworks(6); }
  if (S.kids && S.streak % 2 === 0) A.sfx.kids(); setUI(); }
function addScore(pts, player) { S.score += pts; S.lvlScore += pts; if (S.mode === 'duel') S.duel[player] += pts; checkMilestones(); }
function missHat(H) { if (S.mode === 'duel') { S.pstreak = S.pstreak || [0, 0]; S.pstreak[H.player] = 0; } S.streak = 0; A.sfx.ground(.6, pan(H.p.x)); puff(F, H.p.clone(), 4, '#5a5068', .8);
  if (S.kids) { A.sfx.poof(); popAt(t('poof'), '#ffc8f0', 1, H.p); sparks(F, H.p.clone(), 40, { colors: ['#ffc8f0', '#c8a8ff', '#ffffff'], speed: 2.5, up: 2, life: .9, grav: 2, size: .08 }); } else popAt(t('miss'), '#ff9a8a', 1.1, H.p); setUI(); }
function seatUpdate(H, dt) { H.seatT += dt; const T0 = H.target; const k = eo(H.seatT / .28); const tx = T0.g.position.x, tz = T0.g.position.z, ty = catchY(T0) - (T0.stack.length - 1 - H.idx) * .085 - .085 * 0;
  const y = T0.g.position.y + (T0.inner ? T0.inner.position.y : 0) + T0.seat + H.idx * .085; H.p.set(lerp(H.from.x, tx, k), lerp(H.from.y, y, k), lerp(H.from.z, tz, k)); H.spinA += H.spinW * dt * (1 - k * .7); H.wobT = 1 - k * .5; hatPose(H, dt);
  if (H.seatT >= .28) { H.state = 'on'; const par = T0.inner || T0.g; H.g.position.set(0, T0.seat + H.idx * .085 - (T0.inner ? 0 : 0), 0); H.g.rotation.set(0, H.spinA, 0); H.g.quaternion.setFromEuler(H.g.rotation); par.add(H.g); H.wob = 1; T0.stack.forEach(o => o.wob = Math.max(o.wob || 0, .6)); const i = flying.indexOf(H); if (i >= 0) flying.splice(i, 1); } }
// ---------------- fx helpers ----------------
const rings = []; function ring(at, col) { const m = new THREE.Mesh(new THREE.RingGeometry(.3, .4, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.copy(at); scene.add(m); rings.push({ m, t: 0 }); }
const rockets = []; function fireworks(n) { A.sfx.fireworks(); W.caulBoost = 10; for (let i = 0; i < n; i++) rockets.push({ p: W.cauldron.clone(), v: new THREE.Vector3((rng() - .5) * 4 + 2.5, 11 + rng() * 4, (rng() - .5) * 3 + 2), t: -i * .22, col: ['#7dff8a', '#ffb04a', '#c890ff', '#ffe080'][i % 4] }); }
function updateRockets(dt) { for (let i = rockets.length - 1; i >= 0; i--) { const R = rockets[i]; R.t += dt; if (R.t < 0) continue; R.v.y -= 9 * dt; R.p.addScaledVector(R.v, dt); if (rng() < .7) sparks(F, R.p.clone(), 2, { colors: ['#ffd090'], speed: .4, life: .4, grav: 1, size: .06 });
    if (R.v.y < 1.5) { sparks(F, R.p.clone(), Math.round(150 * QUALITY[S.q].parts), { colors: [R.col, '#ffffff', R.col], speed: 6, up: 0, life: 1.4, grav: 1.6, size: .14 }); rockets.splice(i, 1); } } }
function checkMilestones() { while (S.ms < MILESTONES.length && S.score >= MILESTONES[S.ms][0]) { const [, k] = MILESTONES[S.ms++]; banner(t(k)); A.sfx.levelUp();
    if (k === 'm1000') { W.moonPunch = 1; W.flash = .6; } else if (k === 'm2500') { S.bloodT = S.gt; A.sfx.howl(); } else { S.auroraT = S.gt; flyWitch(W, 4, true); A.sfx.witch(); } } }

// ---------------- the arc preview + aim solver ----------------
const NDOT = 48; const dotGeo = new THREE.BufferGeometry(); const dotPos = new Float32Array(NDOT * 3), dotA = new Float32Array(NDOT), dotS = new Float32Array(NDOT), dotC = new Float32Array(NDOT * 3);
for (let i = 0; i < NDOT; i++) { dotC.set([1, .78, .45], i * 3); dotS[i] = .09; }
dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3)); dotGeo.setAttribute('alpha', new THREE.BufferAttribute(dotA, 1)); dotGeo.setAttribute('size', new THREE.BufferAttribute(dotS, 1)); dotGeo.setAttribute('color', new THREE.BufferAttribute(dotC, 3));
const dots = new THREE.Points(dotGeo, F.mat.clone()); dots.frustumCulled = false; dots.renderOrder = 6; scene.add(dots);
const landRing = new THREE.Mesh(new THREE.RingGeometry(.22, .3, 40), new THREE.MeshBasicMaterial({ color: '#ffcf6a', transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); landRing.rotation.x = -Math.PI / 2; landRing.visible = false; scene.add(landRing);
function simulate(yaw, pow, wind, maxT = 3.2, onStep) { const p = ORIGIN.clone(), v = launchVel(yaw, pow, new THREE.Vector3()); const h = 1 / 120; let tt = 0; while (tt < maxT && p.y > 0) { const py = p.y; hatStep(p, v, h, wind, 'normal'); tt += h; if (onStep && onStep(p, v, tt, py)) break; } return { p, v, t: tt }; }
function updatePreview() { const show = S.state === 'play' && hand && (S.aiming || S.kbAim) && canToss(); dots.visible = show; landRing.visible = false; if (!show) return;
  const frac = D().preview, wind = frac >= 1 ? S.wind : 0; const pts = []; let land = null; simulate(S.aimYaw, S.aimPow, wind, 3.2, (p, v, tt) => { if (Math.round(tt * 120) % 3 === 0) pts.push(p.clone()); for (const T0 of targets) { const ty = tipY(T0); if (v.y < 0 && Math.abs(p.y - ty) < .05 && Math.hypot(p.x - T0.g.position.x, p.z - T0.g.position.z) < 1) land = p.clone(); } return false; });
  const n = Math.max(2, Math.floor(pts.length * frac)); for (let i = 0; i < NDOT; i++) { const P = pts[Math.floor(i / NDOT * n)]; if (P && i / NDOT * n < n) { dotPos.set([P.x, P.y, P.z], i * 3); dotA[i] = .85 * (1 - i / NDOT * .5) * (frac < 1 ? 1 - i / NDOT : 1); } else dotA[i] = 0; }
  dotGeo.attributes.position.needsUpdate = true; dotGeo.attributes.alpha.needsUpdate = true; dots.material.uniforms.scale.value = F.mat.uniforms.scale.value;
  if (frac >= 1) { const e = pts[pts.length - 1]; const L = land || (e && new THREE.Vector3(e.x, .03, e.z)); if (L) { landRing.visible = true; landRing.position.copy(L); landRing.position.y += .02; } } }
// solve yaw + power so the hat drops dead-centre onto a target (bot, tests, video); err = deliberate miss offset (m)
function solveAim(T0, err = 0, useWind = true) { let yaw = Math.atan2(T0.g.position.x - ORIGIN.x, -(T0.g.position.z - ORIGIN.z)), pow = .5; const wind = useWind ? S.wind : 0; let lastT = 0;
  for (let it = 0; it < 40; it++) { let hit = null; const ty = tipY(T0) + (T0.moving && lastT ? (Math.sin((S.gt + lastT) * 1.7 + T0.ph) - Math.sin(S.gt * 1.7 + T0.ph)) * .14 : 0); simulate(yaw, pow, wind, 4, (p, v, tt, py) => { if (py > ty && p.y <= ty && v.y < 0) { hit = { x: p.x, z: p.z, t: tt }; return true; } return false; });
    let tx = T0.g.position.x, tz = T0.g.position.z; if (T0.moving && hit) { const k = 1 + .15 * Math.max(0, S.level - 3); tx = T0.x0 + Math.sin((S.gt + hit.t + .02) * T0.spd * k + T0.ph) * T0.amp; }
    tx += err; if (hit) lastT = hit.t; if (!hit) { pow = Math.min(1, pow + .08); continue; }
    const dHit = Math.hypot(hit.x - ORIGIN.x, hit.z - ORIGIN.z), dT = Math.hypot(tx - ORIGIN.x, tz - ORIGIN.z); pow = clamp(pow + (dT - dHit) * .035, 0, 1);
    const aHit = Math.atan2(hit.x - ORIGIN.x, -(hit.z - ORIGIN.z)), aT = Math.atan2(tx - ORIGIN.x, -(tz - ORIGIN.z)); yaw = clamp(yaw + (aT - aHit), -.6, .6);
    if (Math.abs(dT - dHit) < .01 && Math.abs(aT - aHit) < .0005) break; }
  return { yaw, pow }; }

// ---------------- levels / flow ----------------
const timers = []; function setTimer(d, f) { timers.push({ t: S.gt + d, f }); } function clearTimers() { timers.length = 0; }
const music = new Player();
function clearHats() { for (const H of flying) scene.remove(H.g); flying.length = 0; if (hand) { scene.remove(hand.g); hand = null; } for (const T0 of targets) { for (const H of T0.stack) H.g.parent && H.g.parent.remove(H.g); T0.stack.length = 0; } queue = []; for (const r of rings) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); } rings.length = 0; rockets.length = 0; }
function resetRun() { clearTimers(); clearHats(); S.score = 0; S.lvlScore = 0; S.level = 0; S.streak = 0; S.bestStreak = 0; S.ringers = 0; S.perfects = 0; S.thrown = 0; S.ms = 0; S.wind = 0; S.windBase = 0; S.gust = null; S.lvlDone = false; S.end = ''; S.newBest = false; S.duel = [0, 0]; S.player = 0; S.pstreak = [0, 0]; S.bloodT = null; S.auroraT = null; W.blood = 0; W.aurora = 0; S.aimYaw = 0; S.aimPow = .5; S.kbAim = false; S.aiming = false; }
function start(mode) { A.unlock(); resetRun(); S.mode = mode; S.state = 'play'; S.more = false; window.__banners = []; $('end').classList.remove('show'); $('menu').classList.remove('show'); music.start('game', S.gt + .3); music.vol = .85; A.sfx.stinger();
  beginLevel(0); $('hint').textContent = t(isTouch ? 'hintT' : 'hint'); setTimer(.6, () => $('hint').classList.add('show')); setTimer(6.5, () => $('hint').classList.remove('show')); setUI(); }
function beginLevel(i) { S.level = i; buildLevel(i); S.lvlDone = false; S.hats = D().hats; S.duelHats = [DUEL_HATS, DUEL_HATS]; S.player = 0; S.lvlT = S.gt; if (hand) { scene.remove(hand.g); hand = null; } S.nextHandAt = S.gt + .8;
  banner(levelTitle(i)); A.sfx.levelStart(); setUI(); }
function levelTitle(i) { const n = i < LEVELS.length || S.mode === 'duel' ? `L${(S.mode === 'duel' ? i % 3 : i) + 1}` : `L${4 + ((i - LEVELS.length) % 3)}`; return `${S.mode === 'duel' ? t('round') : t('levelL')} ${i + 1} · ${t(n)}${i >= LEVELS.length && S.mode !== 'duel' ? ' · ' + t('encore') : ''}`; }
function checkLevel() { if (S.state !== 'play' || S.lvlDone) return; const busy = flying.some(H => H.state === 'fly' || H.state === 'seat');
  if (S.mode === 'duel') { if (!busy && !hand && S.duelHats[0] <= 0 && S.duelHats[1] <= 0) { S.lvlDone = true; if (S.level + 1 >= DUEL_LEVELS) { setTimer(1.2, () => endRun('duel')); } else { banner(`${t('round')} ${S.level + 1} ✓`); A.sfx.levelUp(); setTimer(2.2, () => transition(S.level + 1)); } } return; }
  if (S.lvlScore >= S.goal) { S.lvlDone = true; const left = S.kids ? 0 : S.hats; banner(t('levelClear')); A.sfx.levelUp(); fireworks(5); if (hand) { scene.remove(hand.g); hand = null; }
    if (left > 0) for (let i = 0; i < left; i++) setTimer(.6 + i * .18, () => { addScore(50, 0); A.sfx.tick(); popText(`${t('bonusHats')} +50`, '#ffe08a', .9); setUI(); });
    setTimer(2.8 + left * .18, () => { if (S.level + 1 === LEVELS.length) { banner(t('allClear')); A.sfx.cheer(); } transition(S.level + 1); }); return; }
  if (!S.kids && S.hats <= 0 && !hand && !busy) { S.lvlDone = true; banner(t('failed')); A.sfx.fail(); setTimer(2.2, () => endRun('failed')); } }
function transition(i) { S.trans = { t0: S.gt, i, swapped: false }; A.sfx.levelStart(); }
function endRun(why) { if (S.state === 'end' || S.state === 'menu') return; S.state = 'end'; S.end = why || 'quit'; clearTimers(); if (hand) { scene.remove(hand.g); hand = null; } S.trans = null;
  const best = +ls.get(bestKey(), 0); if (S.mode === 'campaign') { S.newBest = S.score > best && S.score > 0; if (S.newBest) ls.set(bestKey(), S.score); S.best = Math.max(best, S.score); const bl = +ls.get(bestKey() + '-lvl', 0); if (S.level + 1 > bl) ls.set(bestKey() + '-lvl', S.level + 1); }
  music.start('menu', S.gt + .8); music.vol = .7; S.rank = rankOf(S.score);
  if (S.mode === 'duel') { const [a, b] = S.duel; $('eTitle').textContent = t('duelEnd'); $('eRank').textContent = a === b ? t('draw') : `${t(a > b ? 'p1' : 'p2')} ${t('wins')}`; $('eScore').textContent = `${a} : ${b}`; $('eBest').textContent = `${t('p1')} · ${t('p2')}`; }
  else { $('eTitle').textContent = why === 'failed' ? t('failed') : t('finish'); $('eRank').textContent = t('r' + S.rank); $('eScore').textContent = S.score; $('eBest').textContent = S.newBest ? t('newBest') : `${t('best')}: ${S.best}`; }
  $('eStats').innerHTML = `<span>${t('reached')}: <b>${S.level + 1}</b></span><span>${t('ringers')}: <b>${S.ringers}/${S.thrown}</b></span><span>${t('perfects')}: <b>${S.perfects}</b></span><span>${t('comboL')}: <b>×${S.bestStreak}</b></span>`;
  $('eName').value = S.name; $('end').classList.add('show'); setUI(); A.sfx.win(); }
const rankOf = s => s < 400 ? 0 : s < 1200 ? 1 : s < 2500 ? 2 : s < 4500 ? 3 : s < 7000 ? 4 : 5;
function toMenu() { resetRun(); S.state = 'menu'; S.more = false; $('menu').classList.add('show'); $('end').classList.remove('show'); music.start('menu', S.gt + .4); music.vol = .8; buildLevel(2); demoHats(); applyLang(); setUI(); }
function demoHats() { targets.forEach((T0, i) => { if (i % 2 === 0 || T0.kind === 'scarecrow') { const H = makeHat(i === 1 ? 'golden' : 'normal', i); H.idx = 0; H.spin = 0; H.state = 'on'; H.target = T0; (T0.inner || T0.g).add(H.g); H.g.position.set(0, T0.seat, 0); H.g.rotation.y = i; T0.stack.push(H); } }); }

// ---------------- the cinematic opening ----------------
// 0–1.7 s: telephoto on the giant moon, clouds racing, the witch crosses the moon and flings her hat at the lens.
// 1.7–3.55 s: the camera rides the spinning hat down over the field, jack-o'-lanterns ignite as it passes.
// 3.55 s: the hat lands on the scarecrow: BOOM + bell + organ, flash, sparks; WITCH HAT TOSS slams in huge and recedes into the night.
const INTRO_LEN = 7.4, LAND = 3.55; let introHat = null; const IP0 = new THREE.Vector3(-7, 15, -4), IP1 = new THREE.Vector3(-3.5, 6.5, -9), IP2 = new THREE.Vector3(0, 2.66, -18);
function introPath(u, out) { const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; return out.set(IP0.x * a + IP1.x * b + IP2.x * c, IP0.y * a + IP1.y * b + IP2.y * c, IP0.z * a + IP1.z * b + IP2.z * c); }
const INTRO_SND = [[0, () => { A.play('rumble', .7, 1, 0, .3); A.play('boom_bass', .55, .8, 0, .3); A.play('wind', .4, 1.3, 0, .2, 3.5); }], [.35, () => A.play('swoosh_rise', .6, .85, 0, .4)], [.75, () => A.play('cackle', .7, .95, 0, .55, 0, -.2)],
  [1.4, () => { A.play('whoosh', .95, .5, 0, .3); A.play('flap_1', .7, .7, 0, .3); }], [1.62, () => A.play('fwoosh', .75, .5, 0, .5)], [1.9, () => A.play('riser', .5, 1, 0, .5)],
  [LAND, () => { A.play('boom_cine', 1, 1, 0, .4); A.play('hit_dram', .85, .9, 0, .5); A.play('bell_deep', .8, .85, 0, .7); A.play('sub', .9, 1, 0, .2); A.play('gong', .6, .75, .04, .6); A.play('crash', .4, .8, .04, .6); A.play('straw', .5, .9, 0, .4);
    [26, 33, 38].forEach((m, i) => A.note('ped', m, .55, 4, i * .02, .7)); [50, 53, 57, 62].forEach((m, i) => A.note('org', m, .3, 3.6, .04 + i * .02, .7)); A.play('choir_swell', .55, 1, .15, .7); }], [LAND + .35, () => A.play('thunder_big', .4, .9, 0, .4)]];
function startIntro() { clearTimers(); resetRun(); S.state = 'intro'; S.introT0 = S.gt; $('menu').classList.remove('show'); $('end').classList.remove('show'); buildLevel(2); W.jacks.forEach(j => j.on = 0); music.stop(); S.introSnd = 0; S.witchDone = false; S.landed = false;
  if (introHat) scene.remove(introHat.g); introHat = makeHat('golden', 0); introHat.g.visible = false; scene.add(introHat.g); W.witchT = -1; W.witch.visible = false; S.skySpeed = 1; setUI(); }
function endIntro() { if (S.state !== 'intro') return; W.haloK = 1; if (introHat) { scene.remove(introHat.g); introHat = null; } W.jacks.forEach(j => j.on = 1); W.witchT = -1; W.witch.visible = false; $('oTitle').style.opacity = 0; $('oSub').style.opacity = 0; toMenu(); }
const _cp = new THREE.Vector3(), _cl = new THREE.Vector3(), _d1 = new THREE.Vector3();
function introStep() { const e = S.gt - S.introT0; S.introT = e;
  while (S.introSnd < INTRO_SND.length && INTRO_SND[S.introSnd][0] <= e) INTRO_SND[S.introSnd++][1]();
  const moonAt = _d1.copy(MOON_DIR).multiplyScalar(130); let pos, look, fov;
  W.haloK = e < 1.75 ? .08 : e < LAND ? .6 : 1;
  if (e < 1.75) { // telephoto on the moon: slow push, the witch crosses
    if (e > .15 && W.witchT < 0 && !S.witchDone) { flyWitch(W, 1.9); S.witchDone = true; }
    pos = _cp.set(0, 5.2, 3); look = _cl.copy(pos).add(moonAt); fov = lerp(13, 10.5, e / 1.75);
    if (e > 1.2) { const k = (e - 1.2) / .55; fov = lerp(10.5, 58, eio(k)); look.lerpVectors(_cl, introPath(0, new THREE.Vector3()), eio(k)); } // whip-zoom out to the hat
    if (e > 1.15) { introHat.g.visible = true; const k = clamp((e - 1.15) / .6, 0, 1); const far = new THREE.Vector3().copy(MOON_DIR).multiplyScalar(60).add(pos); introPath(0, _d1); introHat.p = new THREE.Vector3().lerpVectors(far, _d1, eo(k)); introHat.g.scale.setScalar(lerp(14, 1.6, eo(k))); }
  } else if (e < LAND) { const u = eio((e - 1.75) / (LAND - 1.75)) * .985 + ((e - 1.75) / (LAND - 1.75)) * .015; introPath(u, _d1); introHat.p = _d1.clone(); introHat.g.scale.setScalar(lerp(1.6, 1, u));
    const ahead = introPath(Math.min(1, u + .08), new THREE.Vector3()); const dir = ahead.clone().sub(_d1).normalize();
    pos = _cp.copy(_d1).addScaledVector(dir, -2.6 - (1 - u) * 1.5).add(new THREE.Vector3(.6, .9 + (1 - u) * .6, 0)); look = _cl.copy(_d1).addScaledVector(dir, 1.5); fov = lerp(58, 48, u);
    for (const j of W.jacks) if (j.on < 1 && _d1.z < j.z + 3) { j.on = 1; j.flare = 1; A.play('thump', .4, .62, 0, .4, 0, pan(j.x)); sparks(F, new THREE.Vector3(j.x, .6, j.z), 30, { colors: ['#ffb04a', '#ffe0a0'], speed: 2, up: 2, life: .7, grav: 2, size: .07 }); }
  } else { const k = (e - LAND) / (INTRO_LEN - LAND); if (!S.landed) { S.landed = true; const sc = targets.find(x => x.kind === 'scarecrow'); if (sc) { const H = makeHat('golden', 0); H.idx = 0; H.spin = 6; H.state = 'on'; H.target = sc; sc.g.add(H.g); H.g.position.set(0, sc.seat, 0); H.wob = 1; sc.stack.push(H); sc.squash = 1; sc.flare = 1; }
      introHat.g.visible = false; W.flash = 1; W.moonPunch = 1; S.fovPunch = 1.6; flashScreen(.5); W.caulBoost = 12; W.jacks.forEach(j => { j.on = 1; j.flare = 1; }); const at = IP2.clone(); sparks(F, at, Math.round(240 * QUALITY[S.q].parts), { colors: ['#ffe080', '#ffffff', '#ffb030', '#c890ff'], speed: 6, up: 2.5, life: 1.3, grav: 2.5, size: .13 }); puff(F, at, 8, '#8a7aa8', 1.4); ring(at, '#ffcf6a'); ring(at.clone().setY(.05), '#ff9a3a'); fireworks(4); }
    const a = eo(k * 1.4); pos = _cp.set(lerp(1.6, 0, a), lerp(3.1, 3.6, a), lerp(-13.6, 5.5, a)); look = _cl.set(0, lerp(2.5, 2.2, a), lerp(-18, -12, a)); fov = lerp(44, 50, a); }
  if (introHat && introHat.g.visible) { introHat.spinA = (introHat.spinA || 0) + 1 / 30 * 14; introHat.v = introHat.v || new THREE.Vector3(0, -1, -3); hatPose(introHat, 1 / 30); }
  // title: slams in huge at the landing, then recedes into the night (Star Wars style)
  const tE = e - LAND; const ot = $('oTitle'), os = $('oSub');
  if (tE > 0) { const slam = eo(tE / .45), rec = Math.max(0, tE - .45); const sc = lerp(3.4, 1, slam) * Math.max(.18, 1 - rec * .16); const z = -rec * 120; ot.style.opacity = Math.min(1, tE / .1) * (e > INTRO_LEN - .8 ? Math.max(0, (INTRO_LEN - e) / .8) : 1); ot.style.transform = `translateZ(${z.toFixed(1)}px) scale(${sc.toFixed(3)})`;
    os.style.opacity = clamp((tE - .6) / .4, 0, 1) * (e > INTRO_LEN - .8 ? Math.max(0, (INTRO_LEN - e) / .8) : 1); os.style.transform = `scale(${(1 + Math.max(0, .3 - (tE - .6)) ).toFixed(3)})`; } else { ot.style.opacity = 0; os.style.opacity = 0; }
  if (e >= INTRO_LEN) endIntro();
  return { pos, look, fov }; }

// ---------------- UI ----------------
function setUI() { const st = S.state; document.body.dataset.state = st; const more = !!S.more && st === 'menu'; document.body.dataset.more = more ? '1' : '0'; $('more').classList.toggle('show', more); $('btnMore').setAttribute('aria-expanded', more); document.body.dataset.mode = S.mode; document.body.dataset.kids = S.kids ? '1' : '0';
  $('hScore').textContent = S.mode === 'duel' ? S.duel[S.player] : S.score; $('hCombo').textContent = S.streak >= 2 ? `🔥 ×${S.streak}${comboMult(S.streak) > 1 ? '  ·  x' + comboMult(S.streak) : ''}` : ''; $('hComboBox').style.display = S.streak >= 2 ? '' : 'none';
  $('hLvlL').textContent = `${S.mode === 'duel' ? t('round') : t('levelL')} ${S.level + 1}`; $('hLvl').textContent = S.mode === 'duel' ? `${t('round')} ${S.level + 1}/${DUEL_LEVELS}` : `${t('goalL')} ${Math.min(S.lvlScore, S.goal || 0)}/${S.goal || 0}`; $('hGoal').style.width = S.mode === 'duel' ? `${(S.level + 1) / DUEL_LEVELS * 100}%` : `${clamp(S.lvlScore / (S.goal || 1), 0, 1) * 100}%`;
  const hatsLeft = S.mode === 'duel' ? S.duelHats[S.player] : S.hats; $('hHats').textContent = S.kids && S.mode !== 'duel' ? '🎩 ∞' : `🎩 ×${Math.max(0, hatsLeft)}`;
  $('dP1').textContent = `${t('p1')}: ${S.duel[0]}`; $('dP2').textContent = `${t('p2')}: ${S.duel[1]}`; $('dP1').classList.toggle('on', S.player === 0); $('dP2').classList.toggle('on', S.player === 1); $('dTurn').textContent = `${t(S.player ? 'p2' : 'p1')} ${t('turn')}`;
  $('btnQuit').textContent = S.kids && st === 'play' ? '✓ ' + t('finish') : '✕'; }
function renderNext() { const k = queue[1] || genKind(S.thrown + 1); $('nextBox').innerHTML = `<small>${t('next')}</small><span>${HAT_KINDS[k].e}</span><b>${t(k + 'C')}</b>`; }
function renderWind() { const w = S.wind; $('windV').textContent = Math.abs(w) < .05 ? t('calm') : `${Math.abs(w).toFixed(1)}`; $('windA').style.transform = `rotate(${w < 0 ? 180 : 0}deg) scale(${(.7 + Math.min(1.2, Math.abs(w) * .35)).toFixed(2)})`; $('windA').style.opacity = Math.abs(w) < .05 ? .25 : 1; }
function applyLang() { document.documentElement.lang = S.lang; document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t)); $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN';
  $('keysTip').textContent = t(isTouch ? 'keysHintT' : 'keysHint'); $('btnSkip').textContent = t(isTouch ? 'tapPlay' : 'clickPlay'); $('oSub').textContent = S.lang === 'de' ? 'Noch 8 Tage bis Halloween 🎃' : '8 days to Halloween 🎃';
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids); document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('on', b.dataset.d === S.diff)); $('diff').style.display = S.kids ? 'none' : '';
  const b = +ls.get(bestKey('campaign'), 0); $('playL').textContent = `${t('campaignT')} · ${S.kids ? t('kidsT') : t(S.diff)}${b ? ' · 🏆 ' + b : ''}`;
  $('btnSound').classList.toggle('on', !A.isMuted()); $('btnSound').textContent = A.isMuted() ? '🔇' : '🔊'; $('btnQ').textContent = '⚙ ' + t('q_' + S.q); $('btnQ2').textContent = `⚙ ${t('q_' + S.q)}${S.qUser ? '' : ' · ' + t('auto')}`; renderNext(); renderWind(); setUI(); }
let popQ = 0;
const _sp = new THREE.Vector3();
function popAt(txt, col, big, at) { (window.__pops = window.__pops || []).push(txt); let x = 0, y = 0; if (at) { _sp.copy(at).project(camera); x = clamp(_sp.x * .5 * VW, -VW * .38, VW * .38); y = clamp(-_sp.y * .5 * VH + VH * .06 - VH * .06, -VH * .3, VH * .3) - 40; }
  const now = performance.now(), delay = Math.max(0, popQ - now); popQ = Math.max(now, popQ) + 260;
  setTimeout(() => { const el = document.createElement('div'); el.className = 'pop'; el.textContent = txt; el.style.color = col; el.style.left = x + 'px'; el.style.top = (y - VH * .44 + VH * .5) + 'px'; el.style.fontSize = (28 * big * (VW < 600 ? .78 : 1)) + 'px'; $('pops').appendChild(el); setTimeout(() => el.remove(), 1400); }, delay); }
function popText(txt, col, big = 1) { popAt(txt, col, big, null); }
function banner(s) { (window.__banners = window.__banners || []).push(s); const el = $('banner'); el.textContent = s; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function toast(s) { if (S.state !== 'play') return; const el = $('toast'); el.textContent = s; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
function flashScreen(k) { const el = $('flash'); el.style.transition = 'none'; el.style.opacity = Math.min(.5, k); void el.offsetWidth; el.style.transition = 'opacity .7s ease-out'; el.style.opacity = 0; }

// ---------------- input: pull back + release ----------------
let isTouch = (() => { try { return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0; } catch (e) { return false; } })(), drag = null;
window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } }, true);
function aimFromDrag(x, y) { const sc = Math.min(VW, VH) * .42; const dx = (x - drag.x) / sc, dy = (y - drag.y) / sc; S.aimPow = clamp(dy, 0, 1); S.aimYaw = clamp(-dx * .55, -.6, .6); $('powerFill').style.width = (S.aimPow * 100) + '%'; S.dragAmt = Math.hypot(dx, dy); }
function unlockAudio() { A.unlock(); setTimeout(audioBadge, 60); }
function audioBadge() { document.body.dataset.audio = A.state() === 'running' ? 'on' : 'locked'; }
canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } unlockAudio(); e.preventDefault(); if (S.state !== 'play' || !canToss()) return; drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; S.aiming = true; S.kbAim = false; S.aimPow = 0; S.dragAmt = 0; try { canvas.setPointerCapture(e.pointerId); } catch (er) {} $('power').classList.add('show'); A.sfx.pick(); });
canvas.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; aimFromDrag(e.clientX, e.clientY); if (hand) { hand.pull = S.aimPow; } });
function endDrag(e) { if (!drag || (e && e.pointerId !== drag.id)) return; if (e) aimFromDrag(e.clientX, e.clientY); drag = null; const ok = S.aimPow > .04; $('power').classList.remove('show'); if (ok) toss(); else { S.aiming = false; } }
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', () => { drag = null; S.aiming = false; $('power').classList.remove('show'); });
const keys = {};
window.addEventListener('keydown', e => { if (e.target && e.target.tagName === 'INPUT') return; unlockAudio(); const k = e.code; keys[k] = true;
  if (S.state === 'intro' && (k === 'Enter' || k === 'Space')) { e.preventDefault(); playNow(); return; }
  if (S.state === 'intro' && k === 'Escape') { e.preventDefault(); endIntro(); return; }
  if (S.state === 'menu' && S.more && k === 'Escape') { S.more = false; setUI(); return; }
  if (S.state === 'play' && (k === 'Space' || k === 'Enter') && !e.repeat) { e.preventDefault(); if (canToss()) { S.kbAim = false; toss(); } return; }
  if (S.state === 'play' && /^Arrow/.test(k)) { e.preventDefault(); S.kbAim = true; }
  if (k === 'Escape') { if (S.state === 'play') endRun('quit'); else if (S.state === 'end') toMenu(); return; }
  if (S.state === 'menu' && !S.more && k === 'Enter') start('campaign'); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
function keyAim(dt) { if (S.state !== 'play') return; const a = (keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0), p = (keys.ArrowUp ? 1 : 0) + (keys.ArrowDown ? -1 : 0); if (a) S.aimYaw = clamp(S.aimYaw + a * dt * .45, -.6, .6); if (p) S.aimPow = clamp(S.aimPow + p * dt * .5, 0, 1); }
$('btnPlay').onclick = () => start('campaign'); $('btnDuel').onclick = () => start('duel');
$('btnAgain').onclick = () => start(S.mode); $('btnMenu').onclick = () => { A.sfx.ui(); toMenu(); };
$('btnQuit').onclick = () => { if (S.state === 'play') endRun('quit'); else if (S.state === 'end') toMenu(); };
$('btnCard').onclick = () => saveCard(false); $('btnShare').onclick = () => saveCard(true);
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('wh-lang', S.lang); applyLang(); A.sfx.ui(); };
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { S.diff = b.dataset.d; ls.set('wh-diff', S.diff); applyLang(); A.unlock(); A.sfx.ui(); });
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('wh-kids', S.kids ? '1' : '0'); applyLang(); A.unlock(); A.sfx.ui(); };
$('btnSound').onclick = () => { A.unlock(); A.setMuted(!A.isMuted()); applyLang(); };
$('btnQ').onclick = () => { const o = ['low', 'mid', 'high', 'ultra']; applyQuality(o[(o.indexOf(S.q) + 1) % 4], true); };
// ---- ONE TAP TO PLAY: the first tap/click anywhere on the opening goes straight into the campaign (sound unlocks on that same tap) ----
let eatClick = 0;
function playNow() { if (S.state !== 'intro') return; A.unlock(); setTimeout(audioBadge, 60); endIntro(); start('campaign'); }
function introTap(e) { if (S.state !== 'intro') return; if (e.pointerType === 'touch' && !isTouch) { isTouch = true; applyLang(); } eatClick = performance.now() + 450; playNow(); }
window.addEventListener('pointerup', introTap);
window.addEventListener('click', e => { if (performance.now() < eatClick) { e.stopPropagation(); e.preventDefault(); eatClick = 0; return; } introTap(e); }, true); // the same tap must not also hit a menu button
for (const ev of ['touchend', 'click', 'keydown']) window.addEventListener(ev, () => A.unlock(), { capture: true, passive: true }); // iOS: resume audio inside a real user gesture
$('btnMore').onclick = () => { S.more = true; A.unlock(); A.sfx.ui(); setUI(); }; $('btnMoreX').onclick = $('moreBg').onclick = () => { S.more = false; A.sfx.ui(); setUI(); };
$('btnQ2').onclick = () => { $('btnQ').onclick(); applyLang(); };
$('btnIntro').onclick = () => { A.unlock(); S.more = false; startIntro(); };
$('eName').addEventListener('keydown', e => e.stopPropagation());
window.addEventListener('resize', resize);

// ---------------- share card ----------------
async function makeCard() {
  S.name = ($('eName').value || '').trim() || 'Player 1'; ls.set('wh-name', S.name); try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const CW = 1080, CH = 1350; renderer.setPixelRatio(1); renderer.setSize(CW, CH, false); composer.setPixelRatio(1); composer.setSize(CW, CH);
  const old = { a: camera.aspect, f: camera.fov, p: camera.position.clone(), q: camera.quaternion.clone() }; const hv = dots.visible; dots.visible = false; landRing.visible = false; if (hand) hand.g.visible = false;
  camera.clearViewOffset(); camera.aspect = CW / CH; camera.fov = 50; camera.position.set(1.2, 3.4, 3.2); camera.lookAt(0, 1.7, -12); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  updateWorld(W, S.gt, 0, { camX: camera.position.x, camY: camera.position.y, camZ: camera.position.z, fogN: 22, flies: 120 }); composer.render();
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d'); k.drawImage(renderer.domElement, 0, 0, CW, CH);
  camera.aspect = old.a; camera.fov = old.f; camera.position.copy(old.p); camera.quaternion.copy(old.q); dots.visible = hv; if (hand) hand.g.visible = true; resize();
  const gr = k.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, 'rgba(6,4,16,.9)'); gr.addColorStop(.3, 'rgba(6,4,16,.05)'); gr.addColorStop(.7, 'rgba(6,4,16,.1)'); gr.addColorStop(1, 'rgba(6,4,16,.95)'); k.fillStyle = gr; k.fillRect(0, 0, CW, CH);
  const Fo = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`; k.textAlign = 'center'; k.lineJoin = 'round';
  const txt = (s, x, y, fill, stroke = 'rgba(10,6,20,.88)', lw = 8) => { k.strokeStyle = stroke; k.lineWidth = lw; k.strokeText(s, x, y); k.fillStyle = fill; k.fillText(s, x, y); };
  k.font = Fo(700, 84); txt('🧙 Witch Hat Toss', CW / 2, 108, '#ffe2a8', 'rgba(40,16,60,.92)', 10);
  if (S.mode === 'duel') { const [a, b] = S.duel; k.font = Fo(700, 120); txt(`${a} : ${b}`, CW / 2, 262, '#fff0c0', 'rgba(30,16,4,.9)', 14); k.font = Fo(600, 50); txt(a === b ? t('draw') : `${t(a > b ? 'p1' : 'p2')} ${t('wins')}`, CW / 2, 336, '#ffb35a'); }
  else { k.font = Fo(700, 150); txt(String(S.score), CW / 2, 268, '#fff0c0', 'rgba(30,16,4,.9)', 14); k.font = Fo(600, 50); txt(t('r' + rankOf(S.score)), CW / 2, 336, '#ffb35a'); k.font = Fo(500, 38); txt(`${t('by')} ${S.name.slice(0, 18)}`, CW / 2, 392, '#ffffff'); }
  k.font = Fo(600, 38); txt(`${t(S.mode === 'duel' ? 'duelT' : 'campaignT')} · ${S.kids ? t('kidsT') : t(S.diff)} · ${t('reached')} ${S.level + 1} · ${t('ringers')} ${S.ringers} · ${t('comboL')} ×${S.bestStreak}`, CW / 2, 1150, '#ffe08a');
  k.font = Fo(600, 44); txt(t('cardTag'), CW / 2, 1236, '#d8c0ff'); k.font = Fo(400, 32); txt(CREDIT_TXT, CW / 2, 1292, 'rgba(255,255,255,.92)');
  window.__whCard = { w: c.width, h: c.height }; return c; }
async function saveCard(share) { const c = await makeCard(); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'my-witch-hat-toss.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Witch Hat Toss — ${S.score}! ${t('cardTag')}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-witch-hat-toss.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); toast(t('saved2')); }

// ---------------- simulation ----------------
function beds() { A.loop('wind', .12 + Math.min(.3, Math.abs(S.wind) * .1), 1 + Math.abs(S.wind) * .08, 1.2); A.loop('night_loop', S.state === 'play' ? .16 : .22, 1, 1.5); A.loop('cauldron_loop', .1, 1, 1); }
let owlT = 9, crowT = 15; function ambient(dt) { owlT -= dt; if (owlT <= 0) { owlT = 14 + rng() * 14; rng() < .5 ? A.sfx.owl() : A.sfx.howl(); } crowT -= dt; if (crowT <= 0) { crowT = 18 + rng() * 16; A.sfx.crow(); } }
const camPos = new THREE.Vector3(0, 3, 6), look = new THREE.Vector3(0, 1.2, -10), _tp = new THREE.Vector3(), _tl = new THREE.Vector3();
function camTarget(dt) { const st = S.state, pt = portrait(); let fov = pt ? 64 : 50;
  if (st === 'menu' || st === 'end') { const a = S.gt * .05; _tp.set(Math.sin(a) * 4.5, pt ? 4.2 : 3.6, pt ? 6.5 : 4.8); _tl.set(Math.sin(a * .7) * 1.5, 1.6, -13); }
  else { _tp.set(0, pt ? 4.5 : 3.2, pt ? 5.6 : 4.7); _tl.set(S.aimYaw * 4, pt ? .1 : .85, -10); fov = pt ? 60 : 46;
    const H = flying.find(x => x.state === 'fly'); if (H) { _tl.lerp(_v.set(H.p.x, Math.min(H.p.y, 4), H.p.z), .28); _tp.z -= Math.min(1.2, (S.gt - H.t0) * .8); }
    if (S.trans) { const e = S.gt - S.trans.t0, k = e < 1.1 ? eio(e / 1.1) : 1 - eio((e - 1.1) / 1.1); _tl.lerp(_v.copy(MOON_DIR).multiplyScalar(60).add(_tp), k * .9); fov += k * 6; } }
  return fov; }
function step(dt) {
  dt = Math.max(0, Math.min(fin(dt), 1 / 20)); S.gt += dt; // never step backwards, never jump
  for (let i = timers.length - 1; i >= 0; i--) if (timers[i].t <= S.gt) { const f = timers[i].f; timers.splice(i, 1); f(); }
  for (const k of ['flash', 'blood', 'aurora', 'wind', 'moonPunch', 'caulBoost']) if (!Number.isFinite(W[k])) W[k] = 0; // NaN guards
  for (const k of ['wind', 'windBase', 'aimYaw', 'aimPow', 'fovPunch', 'score', 'lvlScore']) if (!Number.isFinite(S[k])) S[k] = k === 'aimPow' ? .5 : 0;
  music.I = clamp((S.level + S.streak * .25) / 5, 0, 1); music.step(S.gt); ambient(dt); beds(); keyAim(dt);
  const st = S.state; let ic = null;
  if (st === 'intro') ic = introStep();
  if (st === 'play') { if (!hand && !S.lvlDone && !S.trans && S.gt >= (S.nextHandAt || 0) && !flying.some(H => H.state === 'fly')) {
      if (S.mode === 'duel') { if (S.thrown > 0 && !S.turnSet) { S.player = 1 - S.player; if (S.duelHats[S.player] <= 0) S.player = 1 - S.player; } S.turnSet = false; if (S.duelHats[S.player] > 0) { spawnHand(); if (S.thrown > 0) { banner(`${t(S.player ? 'p2' : 'p1')} ${t('turn')}`); A.sfx.turn(); } } }
      else if (S.kids || S.hats > 0) spawnHand(); setUI(); }
    if (S.gust && S.gt >= S.gust.at && flying.some(H => H.state === 'fly')) { S.wind = S.windBase + S.gust.k; banner(`${t('gust')} ${S.gust.k > 0 ? '→' : '←'}`); A.sfx.gust(Math.abs(S.gust.k) / 2); S.gust = null; S.gustEnd = S.gt + 1.6; }
    if (S.gustEnd && S.gt > S.gustEnd) { S.wind = S.windBase; S.gustEnd = 0; }
    checkLevel(); }
  if (S.trans) { const e = S.gt - S.trans.t0; if (e > 1.1 && !S.trans.swapped) { S.trans.swapped = true; clearHats(); beginLevel(S.trans.i); } if (e > 2.2) S.trans = null; }
  moveTargets(dt);
  // hand hat: idle bob, pulled back while aiming
  if (hand) { const pl = S.aiming ? S.aimPow : 0; hand.g.position.set(ORIGIN.x + Math.sin(S.aimYaw) * .3, ORIGIN.y - pl * .2 + Math.sin(S.gt * 2.4) * .03, ORIGIN.z + pl * .28); hand.g.rotation.set(-.25 - pl * .4, S.gt * .8 + S.aimYaw, Math.sin(S.gt * 1.7) * .08); if (hand.glow) { hand.glow.material.opacity = .16 + Math.sin(S.gt * 4) * .06; hand.glow.scale.setScalar(.9 * hand.scale); } }
  for (let i = flying.length - 1; i >= 0; i--) { const H = flying[i]; if (H.state === 'fly') { flyUpdate(H, dt); if (H.state === 'fly' || H.state === 'down') hatPose(H, dt); if (H.state === 'fly') { if (rng() < dt * 1.4) A.sfx.flutter(pan(H.p.x)); const sp = H.kind !== 'normal'; if (rng() < (sp ? 1 : .45)) sparks(F, H.p.clone(), sp ? 3 : 1, { colors: H.kind === 'golden' ? ['#ffe080', '#ffb030'] : H.kind === 'ghost' ? ['#8af0ff', '#ffffff'] : ['#c890ff', '#ffcf8a'], speed: .3, life: .55, grav: .4, size: sp ? .08 : .05 }); } }
    else if (H.state === 'seat') seatUpdate(H, dt); else if (H.state === 'down') { const e = S.gt - H.downT; if (e > (S.kids ? .2 : 1.2)) { H.g.scale.setScalar(Math.max(.01, 1 - (e - (S.kids ? .2 : 1.2)) * 3)); if (e > (S.kids ? .55 : 1.55)) { scene.remove(H.g); flying.splice(i, 1); if (!S.kids) puff(F, H.p.clone(), 2, '#6a6078', .6); } } } }
  updatePreview(); updateRockets(dt);
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = r.t / .8; r.m.scale.setScalar(1 + k * 4); r.m.material.opacity = .7 * (1 - k); if (k >= 1) { scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); } }
  if (S.bloodT != null) W.blood = Math.max(W.blood, smooth((S.gt - S.bloodT) / 3)); if (S.auroraT != null) W.aurora = smooth((S.gt - S.auroraT) / 3);
  W.wind = S.wind; if (Math.floor(S.gt * 4) !== S._w) { S._w = Math.floor(S.gt * 4); renderWind(); }
  // camera
  let fov; if (ic) { camPos.copy(ic.pos); look.copy(ic.look); const asp = VW / VH; fov = asp < 1.6 ? Math.min(72, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(ic.fov / 2)) * Math.min(1.6 / asp, 2.4)))) : ic.fov; } else { fov = camTarget(dt); const kc = 1 - Math.exp(-dt * (S.trans ? 3 : 2.4)); camPos.lerp(_tp, kc); look.lerp(_tl, kc); }
  if (!Number.isFinite(camPos.x + camPos.y + camPos.z)) camPos.set(0, 3, 6); if (!Number.isFinite(look.x + look.y + look.z)) look.set(0, 1.2, -10);
  S.fovPunch = Math.max(0, S.fovPunch - dt * 2.5); camera.fov = fin(ic ? fov : lerp(camera.fov, fov, 1 - Math.exp(-dt * 3)), 50) - S.fovPunch * 2.5; // impact = smooth zoom punch, never a shake
  camera.position.copy(camPos); camera.lookAt(look);
  const W2 = wide(); const vx = (st === 'menu' || st === 'end') ? (W2 ? -.17 : 0) : 0, vy = (st === 'menu' || st === 'end') && !W2 ? .2 : 0; const kv = 1 - Math.exp(-dt * 2.5); S.vx = lerp(fin(S.vx), vx, kv); S.vy = lerp(fin(S.vy), vy, kv);
  camera.setViewOffset(VW, VH, S.vx * VW, S.vy * VH, VW, VH); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const pscale = VH * renderer.getPixelRatio() * .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  updateWorld(W, S.gt * (st === 'intro' && S.introT < 1.75 ? 1 : 1), dt, { camX: camera.position.x, camY: camera.position.y, camZ: camera.position.z, fogN: QUALITY[S.q].fog, flies: QUALITY[S.q].flies, scale: pscale });
  if (st === 'intro') W.sky.material.uniforms.time.value = S.gt + Math.max(0, Math.min(S.introT, 1.75)) * 6; // clouds race across the moon in the opening
  bloom.strength = (st === 'intro' ? .6 : .45) * QUALITY[S.q].bloom;
  updateFX(F, dt, pscale);
}
function render() { composer.render(); }
const fps = { n: 0, acc: 0, frames: 0, bad: 0, since: 0 };
function fpsTick(dt) { if (document.hidden) return; fps.since += dt; if (fps.since < 6 || dt > .25) return; fps.acc += dt; fps.frames++; // ignore the first 6 s (shader compile, decode): no false step-down at startup
  if (fps.acc >= 1) { const f = fps.frames / fps.acc; fps.acc = 0; fps.frames = 0; fps.n++; fps.bad = f < 32 ? fps.bad + 1 : 0; fps.last = f;
    if (!S.qUser && !window.__whNoAutoQ && fps.bad >= 4 && S.q !== 'low') { const o = ['low', 'mid', 'high', 'ultra']; const nq = o[o.indexOf(S.q) - 1]; applyQuality(nq); toast(`${t('autoQ')} ${t('q_' + nq)} (${Math.round(f)} fps)`); fps.bad = 0; fps.since = 0; } } }

applyQuality(S.q); applyLang(); resize();
A.unlock(); audioBadge(); setTimeout(audioBadge, 400);
if (window.__whSkipIntro) toMenu(); else startIntro();
window.addEventListener('pageshow', e => { if (e.persisted) audioBadge(); });
try { renderer.compile(scene, camera); } catch (e) {}
let last = performance.now();
function advance(now) { const dt = Math.max(0, (now - last) / 1000) || 0; last = Math.max(last, now || 0); if (!window.__whManual) { step(dt); fpsTick(dt); } return dt; } // rAF stamps can be earlier than the last one: never run the clock backwards
function frameLoop(now) { advance(now); render(); requestAnimationFrame(frameLoop); }
step(0); requestAnimationFrame(frameLoop);
window.__wh = { S, W, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); }, stepq: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); }, log: A.log, quality: q => q ? applyQuality(q, true) : S.q, renderer, start, end: endRun, toMenu, toss, startIntro, endIntro,
  hand: () => hand && { kind: hand.kind, age: S.gt - hand.spawnT }, canToss, flying: () => flying.map(H => ({ kind: H.kind, state: H.state, p: H.p.toArray(), rim: H.rimHits })), targets: () => targets.map(T0 => ({ kind: T0.kind, x: T0.g.position.x, z: T0.g.position.z, stack: T0.stack.length, tip: tipY(T0), moving: !!T0.moving })),
  solve: (i, err = 0, useWind = true) => solveAim(targets[i], err, useWind), aimAt: (i, err = 0) => { const a = solveAim(targets[i], err); return toss(a.yaw, a.pow); }, setWind: w => { S.windBase = w; S.wind = w; S.gust = null; }, queue: () => queue.slice(), setNext: k => { nextHat(); queue[0] = k; if (hand) { scene.remove(hand.g); hand = null; } S.nextHandAt = 0; },
  level: i => { clearHats(); beginLevel(i); }, sim: (yaw, pow, wind = 0) => { const r = simulate(yaw, pow, wind); return r.p.toArray(); }, camera, cam: () => ({ p: camera.position.toArray(), fov: camera.fov }), screen: v => { _sp.set(...v).project(camera); return { x: (_sp.x * .5 + .5) * VW, y: (-_sp.y * .5 + .5) * VH, z: _sp.z }; },
  fps, card: saveCard, cardURL: async () => (await makeCard()).toDataURL('image/jpeg', .92), sparks: () => { let n = 0; for (let i = 0; i < F.n; i++) if (F.life[i] > 0) n++; return n; }, advance, last: () => last, play: A.play, sfx: A.sfx, audioState: A.state, fireworks, preview: () => ({ visible: dots.visible, ring: landRing.visible, n: Array.from(dotA).filter(a => a > 0).length, frac: D().preview }),
  _dbg: { scene, camera, composer, bloom, F, THREE, targets, flying } };
document.body.classList.add('ready');
