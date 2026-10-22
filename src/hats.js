// Witch hats (lathe cone with a bent, crumpled tip, wavy brim, band + buckle; felt texture) and the targets
// (pumpkin, iron grave spike, planted broom, scarecrow, floating ghost). Each target knows where a hat sits on it.
import * as THREE from 'three';
import { cv, tex, rnd, noise2, clothTexture } from './tex.js';
import { pumpkinGeo, pumpkinMats } from './world.js';

export const HAT_KINDS = {
  normal: { scale: 1, pts: 1, e: '🎩' },
  golden: { scale: 1, pts: 3, e: '👑' },
  giant: { scale: 1.55, pts: 1, e: '🧙' },
  ghost: { scale: 1, pts: 1.5, e: '👻' }
};
export const HAT_COLORS = ['#2a1f3a', '#1b2a22', '#3a1830', '#16182c', '#2c2418'];
export const BAND_COLORS = ['#ff8a1e', '#9a4dff', '#4dff8a', '#ff4d6a', '#ffd84d'];
function feltCanvas(seed, base) { const W = 128, [c, g] = cv(W, W), n = noise2(seed), col = base.match(/\w\w/g).map(h => parseInt(h, 16)); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = .78 + n(x / 5, y / 5) * .3 + n(x / 30, y / 30) * .25; const i = (y * W + x) * 4; im.data[i] = Math.min(255, col[0] * v); im.data[i + 1] = Math.min(255, col[1] * v); im.data[i + 2] = Math.min(255, col[2] * v); im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); return c; }
let GEO = null;
function hatGeos() { if (GEO) return GEO;
  // cone profile: wide at the brim, crumpled, then a tip bent over to one side
  const pts = []; const H = .62; for (let i = 0; i <= 24; i++) { const k = i / 24; const rr = .2 * Math.pow(1 - k, 1.15) + .004; pts.push(new THREE.Vector2(rr * (1 + .05 * Math.sin(k * 19)), k * H)); }
  const cone = new THREE.LatheGeometry(pts, 32); const p = cone.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = v.y / H; if (k > .45) { const b = (k - .45) / .55; v.x += b * b * .26; v.y -= b * b * .1; } v.x += Math.sin(v.y * 22) * .006; p.setXYZ(i, v.x, v.y + .015, v.z); }
  cone.computeVertexNormals();
  // brim: closed ring profile with a gentle upturn and wave
  const bp = [[.17, .028], [.24, .02], [.33, .012], [.385, .03], [.39, .012], [.33, -.004], [.24, .002], [.17, .006], [.17, .028]].map(([x, y]) => new THREE.Vector2(x, y));
  const brim = new THREE.LatheGeometry(bp, 48); const q = brim.attributes.position; for (let i = 0; i < q.count; i++) { v.fromBufferAttribute(q, i); const a = Math.atan2(v.z, v.x), rr = Math.hypot(v.x, v.z); v.y += Math.sin(a * 3) * .012 * Math.max(0, rr - .25) / .14; q.setXYZ(i, v.x, v.y, v.z); } brim.computeVertexNormals();
  const band = new THREE.CylinderGeometry(.188, .2, .07, 32, 1, true); band.translate(0, .06, 0);
  const buckle = new THREE.BoxGeometry(.075, .065, .02); buckle.translate(0, .06, .2);
  GEO = { cone, brim, band, buckle }; return GEO; }
const matCache = {};
function hatMats(kind, ci) { const key = kind + ci; if (matCache[key]) return matCache[key];
  let felt; if (kind === 'golden') felt = new THREE.MeshStandardMaterial({ color: '#ffc840', metalness: .85, roughness: .28, emissive: '#7a4a00', emissiveIntensity: .5 });
  else if (kind === 'ghost') felt = new THREE.MeshStandardMaterial({ color: '#a8f4ff', emissive: '#4ad8ff', emissiveIntensity: .9, transparent: true, opacity: .62, roughness: .4, depthWrite: false });
  else felt = new THREE.MeshStandardMaterial({ map: tex(feltCanvas(30 + ci, HAT_COLORS[ci % HAT_COLORS.length].slice(1))), roughness: .92, color: kind === 'giant' ? '#c0a0ff' : '#ffffff', emissive: '#1a0f2a', emissiveIntensity: .25 });
  const band = new THREE.MeshStandardMaterial({ color: kind === 'golden' ? '#5a1a8a' : kind === 'ghost' ? '#ffffff' : BAND_COLORS[ci % BAND_COLORS.length], roughness: .6, emissive: kind === 'ghost' ? '#7af' : '#000', emissiveIntensity: .4, side: THREE.DoubleSide });
  const buckle = new THREE.MeshStandardMaterial({ color: '#e8c060', metalness: .9, roughness: .25 });
  return (matCache[key] = { felt, band, buckle }); }
export function makeHat(kind = 'normal', ci = 0) { const G = hatGeos(), M = hatMats(kind, ci); const g = new THREE.Group(); const inner = new THREE.Group(); g.add(inner);
  const cone = new THREE.Mesh(G.cone, M.felt), brim = new THREE.Mesh(G.brim, M.felt), band = new THREE.Mesh(G.band, M.band), buckle = new THREE.Mesh(G.buckle, M.buckle);
  inner.add(cone, brim, band, buckle); inner.traverse(o => { if (o.isMesh) { o.castShadow = kind !== 'ghost'; o.receiveShadow = true; } }); const s = HAT_KINDS[kind].scale; inner.scale.setScalar(s);
  let glow = null; if (kind !== 'normal') { glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW(), color: kind === 'golden' ? '#ffcf50' : kind === 'ghost' ? '#6ae0ff' : '#b080ff', transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(1.3 * s); glow.position.y = .2 * s; g.add(glow); }
  return { g, inner, kind, ci, scale: s, glow }; }
let _glow = null; function GLOW() { if (_glow) return _glow; const [c, g] = cv(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.4, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (_glow = new THREE.CanvasTexture(c)); }

// ---------------- targets ----------------
// seat: local y where the first hat's brim origin rests; tip: local y the hat must clear (catch plane);
// tol: catch radius (hat centre to target axis) for medium; body: [y, r] spheres/cylinders a hat can bounce off
export const TARGETS = {
  pumpkin: { pts: 100, tol: .3, e: '🎃' },
  spike: { pts: 150, tol: .25, e: '⚰️' },
  broom: { pts: 200, tol: .24, e: '🧹' },
  scarecrow: { pts: 250, tol: .27, e: '🌾' },
  ghost: { pts: 300, tol: .3, e: '👻' }
};
let PM = null;
export function makeTarget(kind, seed = 1, W) { const r = rnd(seed); const g = new THREE.Group(); const T = { kind, g, stack: [], seat: 0, tip: 0, bodies: [], pts: TARGETS[kind].pts, tol: TARGETS[kind].tol, ph: r() * 6.28 };
  const sh = o => { o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
  if (kind === 'pumpkin') { if (!PM) { PM = pumpkinMats(5); Object.values(PM).forEach(m => m.userData.keep = true); } const s = .55 + r() * .1; const m = PM.body.clone(); m.emissiveIntensity = 1.2; const b = new THREE.Mesh(pumpkinGeo(30), m); b.scale.set(s * 1.08, s, s * 1.08); b.position.y = s * .72; g.add(sh(b)); T.face = m;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, .26, 7), PM.stem); st.position.y = s * 1.44 + .1; st.rotation.z = .15; g.add(sh(st));
    const gl = new THREE.PointLight('#ff8a30', 2.5, 4, 1.8); gl.position.set(0, s * .7, s * 1.2); g.add(gl); T.light = gl;
    T.seat = s * 1.42; T.tip = s * 1.44 + .22; T.bodies.push([s * .72, s * 1.05]); T.h = s * 1.5; }
  else if (kind === 'spike') { const stone = W.mats.stoneM; const slab = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.1, .2), stone); slab.position.y = .55; g.add(sh(slab));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .2, 20, 1, false, 0, Math.PI), stone); top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.rotation.set(0, 0, 0); top.geometry.rotateX(Math.PI / 2); top.geometry.rotateZ(-Math.PI / 2); top.geometry.rotateY(Math.PI / 2); top.position.y = 1.1; g.add(sh(top));
    const iron = new THREE.MeshStandardMaterial({ color: '#2a2c34', metalness: .85, roughness: .38 }); const rod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, 1.0, 8), iron); rod.position.y = 1.55 + .5 - .05; g.add(sh(rod));
    const tipM = new THREE.Mesh(new THREE.ConeGeometry(.06, .2, 8), iron); tipM.position.y = 2.1; g.add(sh(tipM)); for (const sx of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(.03, .14, 6), iron); leaf.position.set(sx * .06, 2.0, 0); leaf.rotation.z = sx * -.7; g.add(leaf); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.07, .015, 6, 16), iron); ring.position.y = 1.8; ring.rotation.x = Math.PI / 2; g.add(ring);
    T.seat = 1.72; T.tip = 2.2; T.bodies.push([.6, .5], [1.1, .48]); T.h = 2.2; }
  else if (kind === 'broom') { const wood = new THREE.MeshStandardMaterial({ color: '#6a4a2c', roughness: .8 }); const stick = new THREE.Mesh(new THREE.CylinderGeometry(.03, .035, 1.9, 8), wood); stick.position.y = 1.15; g.add(sh(stick));
    const bris = new THREE.Mesh(new THREE.ConeGeometry(.24, .6, 12, 1, true), W.mats.hayM); bris.position.y = .2; bris.rotation.x = Math.PI; g.add(sh(bris)); const tie = new THREE.Mesh(new THREE.TorusGeometry(.08, .02, 6, 12), new THREE.MeshStandardMaterial({ color: '#7a2a8a' })); tie.position.y = .52; tie.rotation.x = Math.PI / 2; g.add(tie);
    T.seat = 1.72; T.tip = 2.12; T.bodies.push([.25, .26]); T.h = 2.1; T.sway = true; }
  else if (kind === 'scarecrow') { const wood = W.mats.woodM; const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.3, .12), wood); post.position.y = 1.15; g.add(sh(post)); const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, .1, .1), wood); bar.position.y = 1.85; g.add(sh(bar));
    const shirt = new THREE.MeshStandardMaterial({ map: tex(clothTexture(seed, '6a4a30')), roughness: 1 }); const body = new THREE.Mesh(new THREE.CylinderGeometry(.26, .34, .9, 10), shirt); body.position.y = 1.55; g.add(sh(body));
    for (const sx of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, .7, 8), shirt); arm.rotation.z = Math.PI / 2; arm.position.set(sx * .55, 1.85, 0); g.add(sh(arm)); const straw = new THREE.Mesh(new THREE.ConeGeometry(.1, .25, 7, 1, true), W.mats.hayM); straw.rotation.z = sx * Math.PI / 2; straw.position.set(sx * .98, 1.85, 0); g.add(straw); }
    const sack = new THREE.MeshStandardMaterial({ map: tex(clothTexture(seed + 5, 'a8885a')), roughness: 1, emissive: '#ff7a1a', emissiveIntensity: 0 }); const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), sack); head.position.y = 2.3; head.scale.y = 1.08; g.add(sh(head)); T.headMat = sack; T.own = [shirt.map, sack.map];
    const eyeM = new THREE.MeshBasicMaterial({ color: '#ffb040' }); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 4), eyeM); e.position.set(sx * .08, 2.34, .2); g.add(e); }
    T.seat = 2.42; T.tip = 2.55; T.bodies.push([1.55, .34], [2.3, .22], [1.85, .3]); T.h = 2.6; }
  else if (kind === 'ghost') { const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20; const y = 1 - k; const rr = k < .35 ? Math.sin(k / .35 * Math.PI / 2) * .32 : .32 + (k - .35) * .25; pts.push(new THREE.Vector2(Math.max(.001, rr), y * 1.15)); }
    const gm = new THREE.MeshStandardMaterial({ color: '#e8f0ff', emissive: '#9ab8ff', emissiveIntensity: .55, transparent: true, opacity: .88, roughness: .5, side: THREE.DoubleSide });
    const geo = new THREE.LatheGeometry(pts, 24); const p = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y < .25) { const a = Math.atan2(v.z, v.x); v.y += Math.sin(a * 6) * .06 * (1 - v.y / .25); } p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals();
    const body = new THREE.Mesh(geo, gm); body.position.y = 0; const inner = new THREE.Group(); inner.add(body); inner.position.y = 1.2; g.add(inner); T.inner = inner;
    const eyeM = new THREE.MeshBasicMaterial({ color: '#0a0a14' }); for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), eyeM); e.scale.set(1, 1.5, .5); e.position.set(sx * .1, .92, .28); inner.add(e); } const mo = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), eyeM); mo.scale.set(1, 1.3, .5); mo.position.set(0, .76, .3); inner.add(mo);
    const gl = new THREE.PointLight('#8ab0ff', 2, 4, 1.8); gl.position.y = .8; inner.add(gl);
    T.seat = 2.32 - 1.2; T.tip = 2.42 - 1.2; T.bodies.push([.6, .45]); T.h = 2.4; T.moving = true; T.amp = 2.2 + r() * 1.5; T.spd = .45 + r() * .2; }
  return T; }
// world-space catch point (moving targets included)
export function catchY(T) { return T.g.position.y + (T.inner ? T.inner.position.y : 0) + T.seat + T.stack.length * .085; }
export function tipY(T) { return T.g.position.y + (T.inner ? T.inner.position.y : 0) + T.tip + T.stack.length * .085; }
