# 🧙 Witch Hat Toss

Day 12 of a daily Halloween web-game series – **8 days to Halloween 🎃**

Midnight under a giant full moon. A witch races across the sky and flings her hat – now it's your turn. Toss witch hats onto pumpkins, iron grave spikes, planted brooms, a scarecrow and drifting ghosts, in real 3D with a physical arc, spin and wind.

## How to play
- **Pull back** anywhere on the screen (mouse or finger) and **let go** to toss. Pull further for more power, sideways to aim – like a slingshot.
- Keyboard: **← →** aim, **↑ ↓** power, **Space** toss.
- A hat that drops cleanly over a target is a **ringer**. Dead-centre = **PERFECT**, no rim touch = **Swish**. Hats **stack** on the same target for bonus points.
- Ringers in a row build a **streak** (×2 at 3, ×3 at 5, ×4 at 8): HAT TRICK fireworks from the cauldron, a bat swarm, and the witch herself flies across the moon.
- **Wind** (shown top right) pushes the hat sideways; on Medium and Hard the arc preview ignores it and gusts can hit mid-flight.
- **Special hats**: 👑 Golden (triple points), 🧙 Giant (extra-wide brim), 👻 Ghost (glides through rims and seeks targets).
- Score milestones light up the sky: the moon flares, a blood moon rises, witch lights appear.

**Campaign:** six haunted levels (Pumpkin Patch, Old Graveyard, Scarecrow Field, Ghost Parade, Windy Hill, Witching Hour) plus an endless encore – reach each level's goal before your hats run out.
**Duel:** Player 1 vs Player 2, taking turns on one device, three rounds.
**Difficulty:** Easy / Medium / Hard. **Kids mode:** huge catch zones, the full flight path with a landing ring, no wind, unlimited hats, no game over.

The game opens with a cinematic intro – **one tap or click anywhere** jumps straight into the campaign (sound starts on that same tap). The start screen has one big **PLAY** button; duel, difficulty, kids mode, graphics and the intro replay are in **⚙ Modes & options**. English / German (starts in your browser language, remembers your choice), a 1080×1350 share card, quality levels (Normal by default, auto step-down only if the frame rate stays low).

## Tech
- Three.js (WebGL): moonlit field with sky shader (stars, drifting clouds, blood moon, witch lights), billboard moon with halo and god rays, moon-light shadows, fog, fireflies, jack-o'-lanterns, a witch's cottage with chimney smoke, a bubbling cauldron, bloom.
- Custom hat flight: gravity, wind, air drag, spin and precession; ring-toss catch test at each target's tip, rim bounces, body bounces, stacking, moving targets; an aim solver drives the tests and the video.
- Sounds: real CC0 recordings only, no oscillators. Sample-based music. See `LICENSES/SOUNDS.md`.
- Everything is bundled into `js/game.bundle.js` + `js/sounds-src.js`, so it also runs straight from the file system (`start.command` or open `index.html`).

## Build & test
```
npm install
node tools/build.mjs
python3 test/test_game.py   # headless Chrome (SwiftShader) via Playwright
python3 test/test_mobile.py # phones: WebKit iPhone 13 / 8 / SE + Chromium Pixel 7, portrait + landscape, real taps
```

Built with Grok Bot. Sound credits by source ID in `LICENSES/SOUNDS.md`. Code licenses: three.js (MIT), Fredoka font (OFL).
