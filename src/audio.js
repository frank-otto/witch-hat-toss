// WebAudio for the embedded CC0 recordings (window.WH_SOUNDS): zombie groans and grunts, wood, bone and stone thuds,
// a creaking crane rope, chains, thunder, rain and wind, bats, a real pipe organ (VSCO 2 CE), timpani, contrabass and
// pizzicato strings. Nothing is synthesized: pitched instruments re-pitch the nearest recorded note; the graveyard
// echo is a generated convolution reverb (processing only).
// Every sound (and every loop level change) is logged so tests and the video mix can replay it exactly.
let ctx = null, master = null, dry = null, conv = null, bufs = {}, ready = false, muted = false; const loops = {};
export const log = [];
let clock = () => 0;
export function setClock(f) { clock = f; }
function b64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
export const INS = {
  org: Object.fromEntries([48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81].map(m => [m, m])),
  ped: Object.fromEntries([24, 27, 30, 33, 36, 39, 42].map(m => [m, m])),
  pz: { D3: 50, A3: 57, C4: 60, E4: 64, G4: 67, D5: 74 },
  cb: { E1: 28, Fs1: 30, A1: 33, Cs2: 37, E2: 40 },
  hp: { D4: 62, A4: 69 }
};
const SORTED = Object.fromEntries(Object.entries(INS).map(([k, v]) => [k, Object.entries(v).sort((a, b) => a[1] - b[1])]));
export function sampleFor(ins, m) { const L = SORTED[ins]; let best = L[0]; for (const e of L) if (Math.abs(e[1] - m) < Math.abs(best[1] - m)) best = e; return { n: ins + '_' + best[0], r: Math.pow(2, (m - best[1]) / 12) }; }
function makeIR(sec = 3.2) { const sr = ctx.sampleRate, n = Math.floor(sr * sec), ir = ctx.createBuffer(2, n, sr); let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < n; i++) { const t = i / sr; lp += (rnd() - lp) * (.5 - .38 * t / sec); d[i] = lp * Math.exp(-t * 1.9) * (i < sr * .02 ? i / (sr * .02) : 1); } } return ir; }
export function state() { return ctx ? ctx.state : 'none'; }
export function isReady() { return ready; }
export async function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : .9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = .004; comp.release.value = .2; master.connect(comp); comp.connect(ctx.destination);
  dry = ctx.createGain(); dry.connect(master); conv = ctx.createConvolver(); conv.buffer = makeIR(); const wet = ctx.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(master);
  const src = window.WH_SOUNDS || {};
  // base64 → bytes is synchronous: do it a few sounds per tick so the first tap never freezes a frame (beds and loops first)
  const keys = Object.keys(src).sort((a, b) => (b.endsWith('_loop') || b === 'wind') - (a.endsWith('_loop') || a === 'wind')); const jobs = [];
  for (let i = 0; i < keys.length; i += 4) { for (const k of keys.slice(i, i + 4)) jobs.push(new Promise(res => { try { ctx.decodeAudioData(b64(src[k]), b => { bufs[k] = b; res(); }, () => res()); } catch (e) { res(); } })); await new Promise(r => setTimeout(r, 0)); }
  await Promise.all(jobs);
  ready = true; window.__whAudioReady = Object.keys(bufs).length; for (const k in loops) startLoop(k);
}
export function play(n, vol = 1, rate = 1, delay = 0, rev = .4, dur = 0, pan = 0) {
  if (!Number.isFinite(vol)) vol = 0; if (!Number.isFinite(rate) || rate <= 0) rate = 1; if (!Number.isFinite(delay)) delay = 0; if (!Number.isFinite(rev)) rev = 0; if (!Number.isFinite(dur)) dur = 0; if (!Number.isFinite(pan)) pan = 0;
  delay = Math.max(0, delay); log.push({ n, t: clock() + delay, v: vol, r: rate, rv: rev, d: dur, p: pan });
  if (log.length > 8000) log.splice(0, 1500);
  if (!ready || !bufs[n] || !(vol > 0)) return null;
  const s = ctx.createBufferSource(); s.buffer = bufs[n]; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = vol; s.connect(g); let out = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); out = p; }
  out.connect(dry); if (rev > 0) { const sg = ctx.createGain(); sg.gain.value = rev; out.connect(sg); sg.connect(conv); }
  const t0 = ctx.currentTime + delay; s.start(t0);
  if (dur > 0) { g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(.0008, t0 + dur + .4); s.stop(t0 + dur + .45); }
  return s;
}
export function note(ins, m, vol = .7, dur = 0, delay = 0, rev = .4, pan = 0) { const { n, r } = sampleFor(ins, m); return play(n, vol, r, delay, rev, dur, pan); }
// looping beds (rain, coil buzz, bubbling, mob): level/rate changes are logged as '~name'
function startLoop(k) { const L = loops[k]; if (!ready || L.src || !bufs[k]) return; L.g = ctx.createGain(); L.g.gain.value = L.v; L.src = ctx.createBufferSource(); L.src.buffer = bufs[k]; L.src.loop = true; L.src.playbackRate.value = L.r; L.src.connect(L.g); L.g.connect(dry); const sg = ctx.createGain(); sg.gain.value = .25; L.g.connect(sg); sg.connect(conv); L.src.start(); }
export function loop(k, v, r = 1, fade = .4) {
  if (!Number.isFinite(v)) v = 0; if (!Number.isFinite(r) || r <= 0) r = 1; if (!Number.isFinite(fade)) fade = .4;
  const L = loops[k] || (loops[k] = { v: 0, r: 1 }); if (Math.abs(L.v - v) < .004 && Math.abs(L.r - r) < .004) return; L.v = v; L.r = r;
  log.push({ n: '~' + k, t: clock(), v, r, f: fade }); startLoop(k);
  if (L.g) { const t = ctx.currentTime; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(v, t + fade); L.src.playbackRate.setTargetAtTime(r, t, .15); }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .9; }
export function isMuted() { return muted; }
const R = Math.random, rr = a => a[Math.floor(R() * a.length)], jit = (k = .06) => 1 + (R() - .5) * 2 * k;
export const sfx = {
  ui() { play('knock', .22, 1.1, 0, .15); },
  pick() { play(rr(['flap_1', 'flap_2', 'flap_3']), .3, .9 * jit(), 0, .2); },
  stretch(k) { play('wing', .12 + k * .15, .7 + k * .2, 0, .2, .5); },
  toss(k = .5, pan = 0) { play('whoosh', .45 + k * .35, (.62 + (1 - k) * .2) * jit(.05), 0, .3, 0, pan); play(rr(['flap_1', 'flap_2', 'flap_3']), .38 + k * .2, .78 * jit(), .02, .3, 0, pan); play('fwoosh', .2 + k * .2, .55, .05, .4, 0, pan); },
  flutter(pan = 0) { play(rr(['flap_1', 'flap_2', 'flap_3']), .2, .7 * jit(.08), 0, .35, 0, pan); },
  rim(pan = 0) { play(rr(['knock', 'thud_wood']), .5, .85 * jit(), 0, .35, 0, pan); play('flap_2', .3, .8, .02, .3, 0, pan); },
  land(kind, k = 1, pan = 0) { k = Math.max(.25, Math.min(1, k));
    if (kind === 'pumpkin') { play('thump', .55 * k + .2, .8 * jit(), 0, .35, 0, pan); play('splat', .15 * k, .6, .01, .3, 0, pan); }
    else if (kind === 'spike') { play('clank', .35 * k + .15, .62 * jit(), 0, .45, 0, pan); play('stone_1', .3 * k, .8, .01, .35, 0, pan); }
    else if (kind === 'broom') { play('thud_wood', .5 * k + .2, .85 * jit(), 0, .35, 0, pan); play('straw', .4, .9, .02, .3, 0, pan); }
    else if (kind === 'scarecrow') { play('straw', .55, .85 * jit(), 0, .35, 0, pan); play('thump_b', .45 * k + .15, .75, 0, .35, 0, pan); if (R() < .6) play('crow', .28, 1, .35, .5, 0, pan); }
    else if (kind === 'ghost') { play('thump', .4 * k + .15, .7, 0, .45, 0, pan); play('boo', .35, .8 * jit(), .08, .55, 0, pan); play('ghosts', .25, 1, .1, .6, 2, pan); }
    else { play('thump_b', .5 * k + .15, .7 * jit(), 0, .3, 0, pan); play('dirt', .3 * k, .9, .02, .3, 0, pan); }
    play('sub', .22 * k, 1, 0, .2); },
  ground(k = .6, pan = 0) { play('thump_b', .3 + k * .3, .6 * jit(), 0, .3, 0, pan); play('dirt', .3 * k, .8 * jit(), .02, .3, 0, pan); },
  ringer(n, perfect) { const step = [0, 2, 3, 5, 7, 10, 12, 14]; const m = 50 + step[Math.min(n - 1, step.length - 1)];
    [m, m + 3, m + 7].forEach((x, i) => note('org', x, (perfect ? .32 : .24) - i * .03, .9, 0, .65)); note('ped', 26 + (step[Math.min(n - 1, 7)] % 12), .38, 1.1, 0, .6);
    play(rr(['tp_1', 'tp_2', 'tp_3']), .42, 1, 0, .4); if (perfect) { play('bell_strike', .3, .62, .02, .6); play('choir_ah', .22, 1, .05, .6); } if (n >= 3) { play('cymcresc', .14, 1.1, 0, .5, .9); play('choir_swell', .2 + Math.min(.2, n * .03), 1, .05, .6); } },
  perfectHit() { play('hit_dram', .32, 1.15, 0, .3, .9); },
  streak(n) { play('gong', .4, .9, 0, .6); play('tproll', .3, 1, 0, .5, 1.2); if (n >= 5) play('cackle_s', .45, .9, .2, .55); if (n >= 8) play('cackle', .55, .9, .3, .55); },
  fireworks() { play('fw_burst', .45, .8 * jit(), 0, .5); play('fw_burst_b', .35, .75, .25, .5); play('fw_crackle', .3, .9, .5, .5); },
  levelUp() { [38, 45, 50, 53, 57, 62].forEach((m, i) => note(i < 2 ? 'ped' : 'org', m, i < 2 ? .5 : .3, 2.6, i * .02, .7)); play('bell_deep', .55, 1, 0, .6); play('choir_swell', .45, 1, .1, .7); play('tproll', .3, 1, 0, .5); },
  levelStart() { play('bell_strike', .4, .8, 0, .6); play('swoosh_rise', .3, .9, 0, .4); },
  fail() { [26, 29, 32].forEach((m, i) => note('ped', m, .5, 3, i * .05, .7)); [50, 53, 56].forEach((m, i) => note('org', m, .22, 3, .05 + i * .03, .7)); play('gong', .45, .7, 0, .6); play('cackle', .45, .85, .5, .55); },
  win() { play('success', .4, .9, 0, .4); play('choir_ah', .3, 1, .1, .6); play('bell_strike', .35, .9, 0, .6); },
  miss(pan = 0) { play('thump_b', .45, .62, 0, .35, 0, pan); play('dirt', .35, .9, .03, .35, 0, pan); },
  gust(k = .6) { play('fwoosh', .25 + k * .3, .6, 0, .4); },
  witch() { play('cackle', .5, 1, 0, .6, 0, -.3); play('swoosh_rise', .3, .7, 0, .5); },
  bats() { play('bat_swarm', .5, 1, 0, .4, 5); play('bats', .4, 1, .2, .4); },
  crow() { play('crow', .26, 1, 0, .5, 0, (R() - .5) * 1.2); },
  owl() { play('owl', .22, 1, 0, .6, 0, (R() - .5) * 1.4); },
  howl() { play('howl', .3, 1, 0, .7, 0, (R() - .5) * 1.2); },
  thunder() { play('thunder_soft', .35, jit(.04), 0, .3); },
  kids() { play('laugh_kids', .4, 1, 0, .4); },
  cheer() { play('cheer', .35, 1, 0, .4); play('applause', .3, 1, .1, .4); },
  poof() { play('whisper', .25, 1, 0, .4); play('fwoosh', .25, 1.1, 0, .3); },
  special(kind) { if (kind === 'golden') { play('bell_strike', .35, 1.1, 0, .6); play('harp', .3, .9, .05, .6); } else if (kind === 'ghost') { play('ghosts', .4, 1, 0, .6, 2.2); play('whisper', .3, 1, 0, .6); } else { play('thump', .4, .55, 0, .4); play('glissup', .25, .7, 0, .5); } },
  turn() { play('bell_far', .35, 1, 0, .6); },
  tick() { play('knock', .2, 1.4, 0, .1); },
  stinger() { play('stinger', .35, 1, 0, .5); }
};
