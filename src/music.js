// Music, all played on recorded samples (VSCO 2 CE, CC0): an original E-minor witches' waltz (3/4) on pipe organ,
// contrabass, timpani, harp and pizzicato strings. Layers join as the night goes on (intensity 0..1).
import { note, play } from './audio.js';
const CH = { Em: { b: 40, p: [64, 67, 71, 76], o: [52, 55, 59] }, C: { b: 36, p: [60, 64, 67, 72], o: [52, 55, 60] }, Am: { b: 33, p: [57, 60, 64, 69], o: [52, 57, 60] }, B: { b: 35, p: [59, 63, 66, 71], o: [51, 54, 59] }, D: { b: 38, p: [62, 66, 69, 74], o: [50, 54, 57] }, G: { b: 31, p: [59, 62, 67, 71], o: [50, 55, 59] } };
const GROOVES = {
  menu: { bpm: 96, beats: 3, prog: ['Em', 'C', 'Am', 'B'], bar(b, c, k) { const E = [];
    E.push([0, () => c.o.forEach(m => note('org', m, .08 * k, 2.2, 0, .75))]); E.push([0, () => note('cb', c.b, .36 * k, 0, 0, .4)]);
    E.push([1, () => note('pz', c.p[1], .1 * k, 0, 0, .45, -.3)]); E.push([2, () => note('pz', c.p[2], .1 * k, 0, 0, .45, .3)]);
    if (b % 2 === 1) E.push([2, () => note('hp', c.p[3], .1 * k, 0, 0, .6)]); return E; } },
  game: { bpm: 108, beats: 3, prog: ['Em', 'Em', 'C', 'B', 'Am', 'D', 'G', 'B'], bar(b, c, k, I) { const E = [];
    E.push([0, () => note('cb', c.b, .42 * k, 0, 0, .35)]); E.push([1, () => note('pz', c.p[0], .13 * k, 0, 0, .4, -.25)]); E.push([2, () => note('pz', c.p[1], .13 * k, 0, 0, .4, .25)]);
    E.push([0, () => c.o.forEach(m => note('org', m, (.06 + .05 * I) * k, 2.6, 0, .75))]);
    if (I > .2) { E.push([0, () => play('tp_4', .26 * k, Math.pow(2, ((c.b - 40) % 12) / 24), 0, .4)]); }
    if (I > .45) [0, 1, 2].forEach(q => E.push([q + .5, () => note('pz', c.p[(q + b + 2) % 4], .1 * k, 0, 0, .45, (q - 1) * .3)]));
    if (I > .7) { E.push([1, () => c.o.forEach(m => note('org', m + 12, .08 * k, .25, 0, .6))]); E.push([2, () => c.o.forEach(m => note('org', m + 12, .08 * k, .25, 0, .6))]); }
    if (b % 4 === 0) E.push([0, () => play('bd', .26 * k, .8, 0, .4)]); return E; } }
};
export class Player {
  constructor() { this.g = null; this.on = false; this.vol = 1; this.I = 0; }
  start(name, t0) { this.g = GROOVES[name]; this.name = name; this.t0 = t0; this.spb = 60 / this.g.bpm; this.bar = -1; this.q = []; this.on = true; }
  stop() { this.on = false; this.q = []; }
  step(t) { if (!this.on) return; const nb = this.g.beats; const b = Math.floor((t - this.t0) / this.spb / nb);
    while (this.bar < b + 1) { this.bar++; if (this.bar < 0) continue; const ch = CH[this.g.prog[this.bar % this.g.prog.length]]; for (const [be, f] of this.g.bar(this.bar, ch, this.vol, this.I)) this.q.push([this.t0 + (this.bar * nb + be) * this.spb, f]); this.q.sort((a, b2) => a[0] - b2[0]); }
    while (this.q.length && this.q[0][0] <= t) { const [, f] = this.q.shift(); f(); } }
}
