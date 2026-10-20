// The moonlit field: a huge full moon behind the targets (backlit silhouettes, long moon shadows toward the player),
// a sky dome with stars and drifting clouds, a pumpkin patch, picket fences, gravestones, dead trees, a witch's cottage
// with smoking chimney and a bubbling cauldron, hay bales, ground fog, fireflies, god rays, bats and a flying witch.
import * as THREE from 'three';
import { cv, tex, rnd, noise2, softTexture, smokeTexture, stoneTextures, woodTexture, grassTexture, pumpkinTexture } from './tex.js';

export const QUALITY = {
  low: { dpr: 1, shadows: false, bloom: .7, parts: .45, fog: 8, flies: 40, grass: 0 },
  mid: { dpr: 1.25, shadows: true, shadowSize: 1024, bloom: 1, parts: .75, fog: 14, flies: 90, grass: 1 },
  high: { dpr: 1.6, shadows: true, shadowSize: 2048, bloom: 1, parts: 1, fog: 18, flies: 140, grass: 1 },
  ultra: { dpr: 2, shadows: true, shadowSize: 2048, bloom: 1, parts: 1.3, fog: 22, flies: 200, grass: 1 }
};
export const MOON_DIR = new THREE.Vector3(.1, .2, -1).normalize();
const fin = (v, d = 0) => Number.isFinite(v) ? v : d;

function skyMaterial() {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { time: { value: 0 }, flash: { value: 0 }, blood: { value: 0 }, aurora: { value: 0 }, glowK: { value: 1 }, moonDir: { value: MOON_DIR.clone() } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vDir; uniform float time, flash, blood, aurora, glowK; uniform vec3 moonDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
      void main(){ vec3 d = normalize(vDir); float h = d.y; float md = max(dot(d, moonDir), 0.);
        vec3 low = mix(vec3(.10, .12, .24), vec3(.15, .08, .12), blood), high = vec3(.008, .012, .04);
        vec3 col = mix(low, high, smoothstep(-.02, .6, h));
        col += glowK * pow(md, 6.) * mix(vec3(.16, .2, .36), vec3(.3, .08, .05), blood) + glowK * pow(md, 40.) * mix(vec3(.25, .3, .45), vec3(.45, .15, .08), blood);
        vec2 sp = floor(d.xy * 380. + d.z * 41.); float tw = .6 + .4 * sin(time * (1.5 + hash(sp) * 3.) + hash(sp.yx) * 6.);
        col += step(.9962, hash(sp)) * smoothstep(.04, .35, h) * vec3(.75, .8, 1.) * tw * (1. - smoothstep(.96, .995, md));
        float au = aurora * smoothstep(.12, .35, h) * (1. - smoothstep(.55, .85, h)) * (.5 + .5 * sin(d.x * 9. + time * .4 + fbm(d.xz * 3. + time * .05) * 6.));
        col += au * vec3(.15, .9, .45) * .5;
        vec2 uv = d.xz / (h + .25) * 1.2 + vec2(time * .022, time * .006);
        float c = fbm(uv * 1.2 + fbm(uv * .5 + time * .012) * .7);
        float cl = smoothstep(.5, .78, c) * smoothstep(-.05, .2, h);
        vec3 ccol = mix(vec3(.04, .045, .08), vec3(.22, .24, .34), c) + pow(md, 12.) * vec3(.5, .55, .7) * c * 1.4;
        col = mix(col, ccol, cl * .85);
        col += flash * vec3(.5, .55, .8) * .12;
        gl_FragColor = vec4(col, 1.); }` });
}
function moonCanvas() { const S = 512, [c, g] = cv(S, S), n = noise2(77), r = rnd(78); const im = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const dx = (x - S / 2) / (S / 2 - 6), dy = (y - S / 2) / (S / 2 - 6), d = Math.hypot(dx, dy); const i = (y * S + x) * 4;
    if (d > 1) { im.data[i + 3] = 0; continue; } const mare = n(x / 70 + 2, y / 70) , v = .8 + n(x / 9, y / 9) * .2 - Math.max(0, mare - .45) * 1.1, limb = .72 + .28 * Math.sqrt(1 - d * d);
    im.data[i] = 255 * v * limb; im.data[i + 1] = 246 * v * limb; im.data[i + 2] = 222 * v * limb; im.data[i + 3] = 255 * Math.min(1, (1 - d) * 90); }
  g.putImageData(im, 0, 0); for (let k = 0; k < 40; k++) { const a = r() * 6.28, rr = Math.sqrt(r()) * S * .43, x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr, s = 3 + r() * r() * 26;
    const cg = g.createRadialGradient(x + s * .25, y + s * .25, 0, x, y, s); cg.addColorStop(0, 'rgba(60,54,50,.18)'); cg.addColorStop(.8, 'rgba(60,54,50,.1)'); cg.addColorStop(1, 'rgba(255,250,240,.12)'); g.fillStyle = cg; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.0)'; g.beginPath(); g.arc(x - s * .2, y - s * .2, s * .8, 0, 7); g.fill(); }
  return c; }
// witch on a broom, black silhouette (flies across the moon)
export function witchCanvas() { const [c, g] = cv(512, 256); g.fillStyle = '#05040a'; g.strokeStyle = '#05040a'; g.lineCap = 'round';
  g.lineWidth = 9; g.beginPath(); g.moveTo(40, 168); g.lineTo(380, 136); g.stroke(); // broom stick
  g.beginPath(); g.moveTo(370, 136); g.lineTo(470, 100); g.lineTo(492, 128); g.lineTo(480, 150); g.lineTo(500, 178); g.lineTo(372, 146); g.fill(); // bristles
  g.beginPath(); g.moveTo(170, 160); g.quadraticCurveTo(190, 92, 232, 84); g.lineTo(262, 92); g.quadraticCurveTo(280, 130, 300, 152); g.fill(); // body
  g.beginPath(); g.moveTo(232, 90); g.quadraticCurveTo(300, 70, 380, 54); g.quadraticCurveTo(330, 96, 300, 126); g.fill(); // cape
  g.beginPath(); g.arc(238, 72, 17, 0, 7); g.fill(); // head
  g.beginPath(); g.ellipse(236, 58, 40, 7, -.12, 0, 7); g.fill(); g.beginPath(); g.moveTo(214, 58); g.lineTo(262, 52); g.quadraticCurveTo(236, 20, 210, 6); g.quadraticCurveTo(226, 30, 214, 58); g.fill(); // hat
  g.lineWidth = 7; g.beginPath(); g.moveTo(222, 100); g.lineTo(196, 134); g.lineTo(160, 150); g.stroke(); // arm
  g.beginPath(); g.moveTo(258, 150); g.lineTo(250, 190); g.lineTo(226, 196); g.stroke(); // leg
  return c; }
function cottageWindowCanvas() { const [c, g] = cv(64, 96); const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, '#ffcf6a'); gr.addColorStop(1, '#ff7a1a'); g.fillStyle = gr; g.fillRect(0, 0, 64, 96); g.fillStyle = '#1a0e08'; g.fillRect(29, 0, 6, 96); g.fillRect(0, 44, 64, 6); return c; }
function faceCanvas() { const [c, g] = cv(256, 128); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(60, 50); g.lineTo(96, 50); g.lineTo(78, 22); g.fill(); g.beginPath(); g.moveTo(160, 50); g.lineTo(196, 50); g.lineTo(178, 22); g.fill();
  g.beginPath(); g.moveTo(118, 70); g.lineTo(138, 70); g.lineTo(128, 56); g.fill();
  g.beginPath(); g.moveTo(52, 82); g.quadraticCurveTo(128, 128, 204, 82); g.lineTo(184, 88); g.lineTo(176, 100); g.lineTo(160, 92); g.lineTo(144, 104); g.lineTo(128, 94); g.lineTo(112, 104); g.lineTo(96, 92); g.lineTo(80, 100); g.lineTo(72, 88); g.closePath(); g.fill(); return c; }
export function pumpkinGeo(seg = 28) { const g = new THREE.SphereGeometry(1, seg, Math.round(seg * .6)); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), rib = 1 - .07 * Math.pow(Math.abs(Math.cos(a * 5)), 2.5); const yk = v.y * (v.y < 0 ? .8 : .72); v.x *= rib; v.z *= rib; v.y = yk - (Math.abs(v.y) > .9 ? .08 * Math.sign(v.y) * (Math.abs(v.y) - .9) * 10 : 0); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; }
export function pumpkinMats(seed = 3) { const pt = tex(pumpkinTexture(seed)); return {
  body: new THREE.MeshStandardMaterial({ map: pt, roughness: .55, color: '#ffffff', emissiveMap: tex(faceCanvas()), emissive: '#ff8a20', emissiveIntensity: 0 }),
  plain: new THREE.MeshStandardMaterial({ map: pt, roughness: .6 }), stem: new THREE.MeshStandardMaterial({ color: '#4a5a24', roughness: .8 }) }; }
function treeGeo(r, depth = 4) { const parts = []; const grow = (p, dir, len, rad, d) => { const end = p.clone().addScaledVector(dir, len); const g = new THREE.CylinderGeometry(rad * .62, rad, len, 6, 1); g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); g.applyQuaternion(q); g.translate(p.x, p.y, p.z); parts.push(g);
    if (d <= 0) return; const n = d > 2 ? 3 : 2; for (let i = 0; i < n; i++) { const nd = dir.clone().add(new THREE.Vector3((r() - .5) * 1.5, (r() - .2) * .7, (r() - .5) * 1.2)).normalize(); grow(end, nd, len * (.62 + r() * .2), rad * .62, d - 1); } };
  grow(new THREE.Vector3(), new THREE.Vector3((r() - .5) * .2, 1, 0).normalize(), 2.4, .32, depth); return mergeGeos(parts); }
export function mergeGeos(list) { let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni); let o = 0, oi = 0;
  for (const g of list) { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + o; oi += g.index.count; } else { for (let i = 0; i < c; i++) idx[oi + i] = o + i; oi += c; } o += c; g.dispose(); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setIndex(new THREE.BufferAttribute(idx, 1)); return m; }

export function createWorld(renderer, q, seed = 12) {
  const S = new THREE.Scene(); const r = rnd(seed);
  const W = { scene: S, soft: softTexture(), smokeTex: smokeTexture(), bats: [], fogs: [], lanterns: [], smokes: [], rays: [], t: 0, flash: 0, blood: 0, aurora: 0, wind: 0, swarm: 0, witchT: -1, moonPunch: 0 };
  S.fog = new THREE.FogExp2('#0e1430', .019); S.background = new THREE.Color('#04050c');
  W.sky = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 24), skyMaterial()); W.sky.frustumCulled = false; W.sky.renderOrder = -10; S.add(W.sky);
  // ---- the big moon (billboard far away) + halo ----
  W.moonGrp = new THREE.Group(); S.add(W.moonGrp);
  W.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(moonCanvas()), transparent: true, fog: false, depthWrite: false, color: '#d8ccb4' })); W.moon.scale.setScalar(36); W.moon.renderOrder = -9; W.moonGrp.add(W.moon);
  W.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#8ea4ff', transparent: true, opacity: .55, fog: false, depthWrite: false, blending: THREE.AdditiveBlending })); W.halo.scale.setScalar(90); W.halo.renderOrder = -8; W.moonGrp.add(W.halo);
  W.witch = new THREE.Mesh(new THREE.PlaneGeometry(1, .5), new THREE.MeshBasicMaterial({ map: tex(witchCanvas()), transparent: true, fog: false, depthWrite: false })); W.witch.scale.setScalar(15); W.witch.visible = false; W.witch.renderOrder = -7; W.moonGrp.add(W.witch);
  W.moonGrp.position.copy(MOON_DIR).multiplyScalar(130);
  // ---- lights: cold moon key from behind the targets, warm porch lantern, dim hemisphere ----
  W.hemi = new THREE.HemisphereLight('#5d6fb8', '#1c1712', .9); S.add(W.hemi);
  W.key = new THREE.DirectionalLight('#aebfff', 2.6); W.key.position.copy(MOON_DIR).multiplyScalar(40).add(new THREE.Vector3(0, 6, -12)); W.key.target.position.set(0, 0, -12); S.add(W.key, W.key.target);
  const sc = W.key.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 18; sc.bottom = -18; sc.near = 5; sc.far = 90; W.key.shadow.bias = -.0005; W.key.shadow.normalBias = .04;
  W.front = new THREE.DirectionalLight('#7b8cd8', .55); W.front.position.set(2, 7, 9); W.front.target.position.set(0, 0, -10); S.add(W.front, W.front.target);
  W.porch = new THREE.PointLight('#ff9b4a', 9, 14, 1.5); W.porch.position.set(-3.4, 2.1, 1.6); S.add(W.porch);
  // ---- ground ----
  const gt = tex(grassTexture(seed), true, [40, 40]); const n = noise2(seed + 4);
  const gg = new THREE.PlaneGeometry(240, 240, 120, 120); gg.rotateX(-Math.PI / 2); { const p = gg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, groundH(x, z, n)); } gg.computeVertexNormals(); }
  W.ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: '#8c96a0' })); W.ground.receiveShadow = true; S.add(W.ground);
  // far hills silhouettes
  for (const [x, z, s] of [[-60, -95, 42], [10, -110, 55], [70, -90, 40], [-110, -50, 40], [110, -40, 40]]) { const h = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshStandardMaterial({ color: '#0a0d16', roughness: 1 })); h.scale.set(s, s * .3, s * .5); h.position.set(x, -3, z); S.add(h); }
  // ---- materials ----
  const woodT = tex(woodTexture(seed + 9, [84, 58, 40]), true); woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; const woodM = new THREE.MeshStandardMaterial({ map: woodT, roughness: .9, color: '#a89484' });
  const ST = stoneTextures(seed + 4, 512, 256); const stoneM = new THREE.MeshStandardMaterial({ map: tex(ST.map), normalMap: tex(ST.normal, false), roughness: .95, color: '#9a98ac' });
  const barkM = new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 1 }); W.mats = { woodM, stoneM, barkM };
  // ---- porch in the foreground: planks + railing + lantern + hat basket ----
  { const deck = new THREE.Mesh(new THREE.BoxGeometry(7, .16, 2.4), woodM); deck.position.set(0, .08, 2.2); deck.receiveShadow = true; S.add(deck);
    for (const x of [-3.4, -2.4, 2.4, 3.4]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.14, 1.1, .14), woodM); p.position.set(x, .7, 1.05); p.castShadow = true; S.add(p); }
    for (const sx of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(1.2, .1, .12), woodM); rail.position.set(sx * 2.9, 1.2, 1.05); S.add(rail); }
    const lan = new THREE.Group(); const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 2, .12), woodM); post.position.y = 1; lan.add(post); const cage = new THREE.Mesh(new THREE.CylinderGeometry(.14, .11, .3, 6), new THREE.MeshStandardMaterial({ color: '#ffcf80', emissive: '#ff9a3a', emissiveIntensity: 2.2 })); cage.position.y = 2.1; lan.add(cage);
    lan.position.set(-3.4, 0, 1.6); S.add(lan); W.lanterns.push({ pl: W.porch, cage, base: 9, ph: 1 }); }
  // ---- picket fences along both sides ----
  { const pg = new THREE.BoxGeometry(.09, .9, .05); const posts = []; for (const sx of [-1, 1]) for (let z = 0; z > -30; z -= .32) { if (r() < .05) continue; posts.push([sx * (8 + Math.sin(z * .3) * .3), .4 + r() * .1, z, (r() - .5) * .25]); }
    const im = new THREE.InstancedMesh(pg, woodM, posts.length); const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), e = new THREE.Euler();
    posts.forEach((p, i) => { e.set(0, 0, p[3]); qq.setFromEuler(e); m.compose(new THREE.Vector3(p[0], p[1], p[2]), qq, new THREE.Vector3(1, 1 + r() * .3, 1)); im.setMatrixAt(i, m); }); im.castShadow = true; S.add(im);
    for (const sx of [-1, 1]) for (const y of [.25, .62]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(.05, .07, 30), woodM); rail.position.set(sx * 8.05, y, -15); S.add(rail); } }
  // ---- decor pumpkins (instanced) along the sides ----
  { const PM = pumpkinMats(seed); W.pumpkinMats = PM; const pgeo = pumpkinGeo(18); const list = [];
    for (let i = 0; i < 70; i++) { const sx = r() < .5 ? -1 : 1; const x = sx * (5.4 + r() * 2.4), z = -2 - r() * 26; list.push([x, z, .18 + r() * .22]); }
    for (let i = 0; i < 26; i++) { const x = (r() - .5) * 24, z = -26 - r() * 10; list.push([x, z, .2 + r() * .25]); }
    const im = new THREE.InstancedMesh(pgeo, PM.plain, list.length); const m = new THREE.Matrix4(), qq = new THREE.Quaternion();
    list.forEach((p, i) => { qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6); m.compose(new THREE.Vector3(p[0], p[2] * .7, p[1]), qq, new THREE.Vector3(p[2], p[2], p[2])); im.setMatrixAt(i, m); }); im.castShadow = true; im.receiveShadow = true; S.add(im);
    // a few glowing jack-o'-lanterns (these ignite during the opening)
    const fgeo = pumpkinGeo(24); W.jacks = [];
    for (const [x, z, s] of [[-5.8, -4.5, .42], [6.0, -7, .45], [-5.6, -13, .5], [5.4, -17, .5], [-3.6, -22, .55], [3.2, -26, .6], [-7, -27, .6]]) {
      const mat = PM.body.clone(); const j = new THREE.Mesh(fgeo, mat); j.scale.setScalar(s); j.position.set(x, s * .7, z); j.lookAt(0, s * .7, 4); j.castShadow = true; S.add(j);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .2, 6), PM.stem); st.position.set(x, s * 1.4 + .05, z); S.add(st);
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.soft, color: '#ff8a2a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.set(x, s * .8, z + .2); gl.scale.setScalar(s * 2.6); S.add(gl);
      W.jacks.push({ mesh: j, mat, gl, on: 1, ph: r() * 6, x, z }); }
    W.jackLights = []; for (let i = 0; i < 3; i++) { const pl = new THREE.PointLight('#ff8a32', 0, 7, 1.6); S.add(pl); W.jackLights.push(pl); } }
  // ---- hay bales ----
  { const [c, g] = cv(128, 128); for (let i = 0; i < 900; i++) { g.strokeStyle = `hsl(${40 + r() * 12},${45 + r() * 20}%,${30 + r() * 30}%)`; g.beginPath(); const x = r() * 128, y = r() * 128; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 30, y + (r() - .5) * 6); g.stroke(); }
    const hayM = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 1, color: '#c8b088' }); W.mats.hayM = hayM;
    for (const [x, z, a] of [[-6.4, -9, .3], [6.6, -12, -.4], [-6.2, -19, .1], [6.8, -23, .6]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, .6, .65), hayM); b.position.set(x, .3, z); b.rotation.y = a; b.castShadow = b.receiveShadow = true; S.add(b); } }
  // ---- gravestones ----
  { const shapes = [new THREE.BoxGeometry(.6, .9, .14), new THREE.CylinderGeometry(.32, .32, .14, 16, 1, false, 0, Math.PI), new THREE.BoxGeometry(.14, 1, .12)];
    shapes[1].rotateX(Math.PI / 2); shapes[1].rotateZ(Math.PI / 2); shapes[1].rotateY(Math.PI / 2);
    for (let i = 0; i < 22; i++) { const sx = r() < .5 ? -1 : 1; const x = i < 16 ? sx * (9.5 + r() * 5) : (r() - .5) * 16, z = i < 16 ? -6 - r() * 22 : -29 - r() * 6; const k = Math.floor(r() * 3);
      const g = new THREE.Group(); const m = new THREE.Mesh(shapes[k], stoneM); m.position.y = k === 1 ? .5 : .45; g.add(m); if (k === 1) { const b = new THREE.Mesh(new THREE.BoxGeometry(.64, .5, .14), stoneM); b.position.y = .25; g.add(b); } if (k === 2) { const cr = new THREE.Mesh(new THREE.BoxGeometry(.6, .12, .12), stoneM); cr.position.y = .72; g.add(cr); }
      g.position.set(x, 0, z); g.rotation.set((r() - .5) * .15, (r() - .5) * .5, (r() - .5) * .2); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); S.add(g); } }
  // ---- dead trees ----
  for (const [x, z, s] of [[-10.5, -9, 1.2], [11, -14, 1.35], [-8.5, -24, 1.5], [9.5, -30, 1.6], [-16, -36, 1.9], [17, -40, 2]]) { const t = new THREE.Mesh(treeGeo(r, 4), barkM); t.position.set(x, 0, z); t.scale.setScalar(s); t.rotation.y = r() * 6; t.castShadow = true; S.add(t); }
  // ---- the witch's cottage + chimney smoke + cauldron ----
  { const cg = new THREE.Group(); const plaster = new THREE.MeshStandardMaterial({ color: '#3a3440', roughness: 1 }); const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), plaster); body.position.y = 1.6; cg.add(body);
    const roofM = new THREE.MeshStandardMaterial({ color: '#1c1620', roughness: 1 }); for (const sx of [-1, 1]) { const rf = new THREE.Mesh(new THREE.BoxGeometry(3.3, .18, 4.6), roofM); rf.position.set(sx * 1.35, 4.0, 0); rf.rotation.z = -sx * .78; cg.add(rf); }
    const gable = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.9, 3), plaster); gable.rotation.set(0, Math.PI / 2, 0); gable.position.set(0, 4.1, 0); gable.scale.set(1.36, 1, .02); cg.add(gable);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(.6, 2.2, .6), stoneM); ch.position.set(1.5, 4.8, -.6); ch.rotation.z = .06; cg.add(ch);
    const winM = new THREE.MeshStandardMaterial({ map: tex(cottageWindowCanvas()), emissive: '#ffffff', emissiveMap: tex(cottageWindowCanvas()), emissiveIntensity: 1.6 });
    for (const [x, y] of [[-1.4, 1.8], [1.4, 1.8], [0, 3.6]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.7, 1), winM); w.position.set(x, y, 2.01); w.scale.setScalar(y > 3 ? .7 : 1); cg.add(w); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.7), woodM); door.position.set(0, .85, 2.01); cg.add(door);
    cg.position.set(-12.5, 0, -36); cg.rotation.y = .45; cg.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); S.add(cg);
    const wl = new THREE.PointLight('#ff9a40', 6, 10, 1.6); wl.position.set(-11.3, 2, -33); S.add(wl); W.lanterns.push({ pl: wl, base: 6, ph: 3 });
    const chimTop = new THREE.Vector3(1.5, 6, -.6).applyMatrix4(cg.matrixWorld.compose(cg.position, cg.quaternion, cg.scale)); W.chimney = chimTop;
    for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.smokeTex, color: '#6a6680', transparent: true, opacity: 0, depthWrite: false })); s.userData.k = i / 10; S.add(s); W.smokes.push(s); }
    // cauldron with green glow (fireworks for streaks rise from here)
    const caul = new THREE.Group(); const pot = new THREE.Mesh(new THREE.SphereGeometry(.7, 20, 12, 0, Math.PI * 2, Math.PI * .28, Math.PI * .72), new THREE.MeshStandardMaterial({ color: '#1b1c20', metalness: .7, roughness: .45, side: THREE.DoubleSide })); pot.position.y = .62; caul.add(pot);
    const brew = new THREE.Mesh(new THREE.CircleGeometry(.6, 24), new THREE.MeshStandardMaterial({ color: '#5dff7a', emissive: '#39ff6a', emissiveIntensity: 1.4 })); brew.rotation.x = -Math.PI / 2; brew.position.y = 1.0; caul.add(brew);
    caul.position.set(-7.4, 0, -29); S.add(caul); W.cauldron = new THREE.Vector3(-7.4, 1.1, -29); W.brew = brew;
    W.caulLight = new THREE.PointLight('#4dff7a', 5, 8, 1.6); W.caulLight.position.set(-7.4, 1.6, -29); S.add(W.caulLight); }
  // ---- god rays from the moon ----
  { const [c, g] = cv(64, 256); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.3, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, 64, 256);
    const rt = tex(c); for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4 + r() * 4, 60), new THREE.MeshBasicMaterial({ map: rt, color: '#7d90d8', transparent: true, opacity: .05, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.position.set(-10 + i * 5 + r() * 2, 12, -40 - r() * 10); m.rotation.set(-.2, 0, (r() - .5) * .5 + (i - 2) * .12); S.add(m); W.rays.push({ m, ph: r() * 6, o: .035 + r() * .03 }); } }
  // ---- ground fog ----
  for (let i = 0; i < 22; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.smokeTex, color: '#8796c8', transparent: true, opacity: .1, depthWrite: false, fog: true })); s.position.set((r() - .5) * 30, .4 + r() * .7, -3 - r() * 30); s.scale.set(7 + r() * 6, 2 + r() * 1.5, 1); s.userData = { vx: (r() - .5) * .3, o: .07 + r() * .07 }; S.add(s); W.fogs.push(s); }
  // ---- fireflies / will-o'-wisps ----
  { const N = 200, p = new Float32Array(N * 3), c = new Float32Array(N * 3), s = new Float32Array(N), a = new Float32Array(N); W.flyBase = []; const col = new THREE.Color();
    for (let i = 0; i < N; i++) { const b = [(r() - .5) * 22, .3 + r() * 2.5, -2 - r() * 30]; W.flyBase.push({ b, ph: r() * 6.28, sp: .4 + r() * .8 }); col.set(r() < .7 ? '#c8ff6a' : '#ffb04a'); c.set([col.r, col.g, col.b], i * 3); s[i] = .06 + r() * .06; a[i] = 1; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('size', new THREE.BufferAttribute(s, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(a, 1));
    W.flyMat = new THREE.ShaderMaterial({ uniforms: { map: { value: W.soft }, scale: { value: 800 }, t: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float scale, t; void main(){ vC = color; vA = alpha * (.45 + .55 * sin(t * 3. + position.x * 4. + position.z)); vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a * max(vA, 0.)); }' });
    W.flies = new THREE.Points(g, W.flyMat); W.flies.frustumCulled = false; S.add(W.flies); }
  // ---- bats ----
  { const batM = new THREE.MeshBasicMaterial({ color: '#07070c', side: THREE.DoubleSide, fog: false }); const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, -.06, .32, .04, -.02, 0, 0, .08, .32, .04, -.02, .26, -.05, .07, 0, 0, .08]), 3));
    for (let i = 0; i < 40; i++) { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(.07, 6, 4), batM); b.scale.set(1, .8, 1.5); g.add(b); const L = new THREE.Mesh(wing, batM), R = new THREE.Mesh(wing, batM); R.scale.x = -1; g.add(L, R); g.visible = false; g.scale.setScalar(1.2 + r() * .9); S.add(g); W.bats.push({ g, L, R, ph: r() * 6.28, sp: .8 + r() * .6, dy: (r() - .5) * 3, dx: (r() - .5) * 8 }); } }
  W.setRes = () => {};
  return W;
}
export function groundH(x, z, n) { const far = Math.max(0, Math.abs(x) - 10) + Math.max(0, -z - 32); return far > 0 ? (n ? (n(x * .04 + 5, z * .04) - .4) * Math.min(1, far / 10) * 3 : 0) : 0; }
export function swarm(W) { W.swarm = 7; W.bats.forEach((b, i) => { b.g.visible = true; b.t0 = i * .04; }); }
export function flyWitch(W, dur = 4.5, low = false) { W.witchT = 0; W.witchDur = dur; W.witchLow = low; W.witch.scale.setScalar(low ? 21 : 15); W.witch.visible = true; } // low: across the lower half of the moon (stays in view on phones)
const _a = new THREE.Vector3(), _c = new THREE.Vector3();
export function updateWorld(W, t, dt, I = {}) {
  W.t = t; const u = W.sky.material.uniforms; u.time.value = t; u.flash.value = fin(W.flash); u.blood.value = fin(W.blood); u.aurora.value = fin(W.aurora); u.glowK.value = fin(W.haloK ?? 1, 1);
  W.flash = Math.max(0, fin(W.flash) - dt * 2.2); W.moonPunch = Math.max(0, fin(W.moonPunch) - dt * 1.5);
  if (I.camX !== undefined) { W.sky.position.set(I.camX, I.camY, I.camZ); W.moonGrp.position.set(I.camX, I.camY, I.camZ).addScaledVector(MOON_DIR, 130); W.moonGrp.lookAt(I.camX, I.camY, I.camZ); }
  const mc = W.moon.material.color; mc.setRGB(.86, .8 - .4 * W.blood, .7 - .5 * W.blood); W.halo.material.color.setRGB(.56 + .3 * W.blood, .64 - .25 * W.blood, 1 - .55 * W.blood); W.halo.material.opacity = (.42 + W.moonPunch * .35 + W.flash * .25) * fin(W.haloK ?? 1);
  W.moon.scale.setScalar(36 * (1 + W.moonPunch * .06)); W.key.color.setRGB(.68 + .3 * W.blood, .75 - .3 * W.blood, 1 - .55 * W.blood);
  for (const L of W.lanterns) { const f = .85 + .1 * Math.sin(t * 9 + L.ph) + .06 * Math.sin(t * 23 + L.ph * 2); L.pl.intensity = L.base * f; }
  // jack-o'-lanterns: flicker; 3 shared point lights follow the 3 nearest lit ones in front of the camera
  const lit = []; for (const j of W.jacks) { const k = fin(j.on) * (.8 + .2 * Math.sin(t * 11 + j.ph) * Math.sin(t * 7.3 + j.ph)); j.mat.emissiveIntensity = k * 2.2; j.gl.material.opacity = k * .38; if (j.on > .05) lit.push(j); }
  lit.sort((a, b) => Math.hypot(a.x - fin(I.camX), a.z - fin(I.camZ) + 6) - Math.hypot(b.x - fin(I.camX), b.z - fin(I.camZ) + 6));
  W.jackLights.forEach((pl, i) => { const j = lit[i]; if (j) { pl.position.set(j.x, .9, j.z + .5); pl.intensity = 4 * j.on * (.8 + .2 * Math.sin(t * 11 + j.ph)); } else pl.intensity = 0; });
  W.fogs.forEach((s, i) => { s.position.x += s.userData.vx * dt + fin(W.wind) * dt * .5; if (s.position.x > 18) s.position.x = -18; if (s.position.x < -18) s.position.x = 18; s.material.opacity = s.userData.o * (i < (I.fogN || 14) ? 1 : 0); });
  W.rays.forEach(R => R.m.material.opacity = R.o * (.7 + .3 * Math.sin(t * .4 + R.ph)) * (1 + W.moonPunch));
  W.smokes.forEach(s => { const k = (s.userData.k + t * .08) % 1; s.position.copy(W.chimney).add(_a.set(k * 2.5 + fin(W.wind) * k * 3, k * 5, -k)); s.scale.setScalar(.8 + k * 3.5); s.material.opacity = Math.sin(k * Math.PI) * .35; });
  W.brew.material.emissiveIntensity = 1.2 + .3 * Math.sin(t * 3); W.caulLight.intensity = 4 + Math.sin(t * 5) * .8 + (W.caulBoost || 0); W.caulBoost = Math.max(0, (W.caulBoost || 0) - dt * 8);
  // fireflies
  { const p = W.flies.geometry.attributes.position, a = W.flies.geometry.attributes.alpha, N = I.flies || 90; for (let i = 0; i < W.flyBase.length; i++) { const f = W.flyBase[i]; const ph = f.ph + t * f.sp;
      f.b[0] += fin(W.wind) * dt * .35; if (f.b[0] > 12) f.b[0] -= 24; if (f.b[0] < -12) f.b[0] += 24; p.setXYZ(i, f.b[0] + Math.sin(ph) * .8, f.b[1] + Math.sin(ph * 1.7) * .3, f.b[2] + Math.cos(ph * .8) * .8); a.setX(i, i < N ? 1 : 0); }
    p.needsUpdate = true; a.needsUpdate = true; W.flyMat.uniforms.t.value = t; if (I.scale) W.flyMat.uniforms.scale.value = I.scale; }
  // bats: sweep across the field toward the moon
  if (W.swarm > 0) { W.swarm -= dt; const e = 7 - W.swarm; W.bats.forEach((b, i) => { const k = Math.max(0, e - b.t0); b.ph += dt * 14 * b.sp; const fl = Math.sin(b.ph) * .9; b.L.rotation.z = fl; b.R.rotation.z = -fl;
      b.g.position.set(-14 + k * 5.5 + b.dx, 2 + b.dy + k * 1.3 + Math.sin(k * 2 + i) * .6, -6 - k * 4 - i * .1); b.g.lookAt(_c.set(b.g.position.x + 5, b.g.position.y + 1.3, b.g.position.z - 4)); });
    if (W.swarm <= 0) W.bats.forEach(b => b.g.visible = false); }
  // the witch flies across the moon
  if (W.witchT >= 0) { W.witchT += dt; const k = W.witchT / W.witchDur; W.witch.position.set(-30 + k * 60, W.witchLow ? Math.sin(k * Math.PI) * 2.5 - 10.5 : Math.sin(k * Math.PI) * 5 - 3, 2); W.witch.rotation.z = Math.sin(k * 6) * .05 + .05; if (k >= 1) { W.witchT = -1; W.witch.visible = false; } }
}
