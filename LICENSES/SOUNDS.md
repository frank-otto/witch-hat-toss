# Sounds – sources & licenses (Witch Hat Toss)

All sounds are real recordings released under **CC0 1.0** (https://creativecommons.org/publicdomain/zero/1.0/). No synthesizer, no oscillators, no beeps. They were trimmed, faded, made mono and loudness-matched; looping beds got a crossfaded seam. `tools/build.mjs` embeds them as base64 into `js/sounds-src.js` so the game also runs via `file://`. The night-air reverb is a generated convolution impulse (processing only). Credit is not required for CC0 and is given voluntarily, by source ID only.

## New for this game – Freesound (CC0 1.0)
| File | Used for | Source |
|---|---|---|
| cackle, cackle_b, cackle_s | the witch's cackle (opening, big streaks, game over) | Freesound #223851, #348142, #417826 |
| cauldron_loop | the bubbling cauldron bed | Freesound #361540 |
| rumble | the low rumble under the moon shot of the opening | Freesound #177242 |
| boom_cine | the big boom when the opening hat lands | Freesound #255111 |
| hit_dram | deep dramatic hit (opening landing, PERFECT ringers) | Freesound #222517 |
| boom_bass | bass boom at the start of the opening | Freesound #268084 |
| whoosh | the hat leaving your hand | Freesound #60013 |
| swoosh_rise | rising swoosh (opening, level start, the witch flying by) | Freesound #264777 |
| flap_1 … flap_3 | the felt hat flapping in flight | Freesound #580967 |
| straw | hats landing on the scarecrow and the broom | Freesound #542690 |
| thump, thump_b | deep thumps: hats landing on pumpkins, ghosts, the ground; jack-o'-lanterns igniting | Freesound #529396 |

## Reused from earlier games of this series (all CC0 1.0)
| File | Source |
|---|---|
| thud_wood, knock, punch, splat, stone_1, stone_2, gravel_1, dirt, crack | Freesound #447922, #268500, #269232, #445117, #265580, #179341, #155934, #157804 |
| thunder, thunder_big, thunder_soft | Freesound #194364, #243614, #244053 |
| wind | Freesound #481139, #697217 |
| owl, howl, crow, whisper, boo, ghosts | Freesound #558214, #398430, #404687, #175944, #607205, #763804 |
| bats, bat_swarm | Freesound #546823, #245768 |
| fwoosh, stinger, sub, riser | Freesound #557812, #754771, #428073, #822419 |
| choir_ah, choir_swell | Freesound #764330, #458146 |
| success, laugh_kids, cheer, applause, harp | Freesound #615099, #754399, #32260, #160493, #610703 |
| bell_deep, bell_strike, bell_far | Freesound #240586, #219047, #341866 |
| boom | Freesound #264031 |
| fw_burst, fw_burst_b, fw_crackle | Freesound #587184, #335983, #505264 |
| night_loop, eerie_loop | Freesound #251340, #32805, #159509, #437475 |
| wing | Freesound #389634 |

## Music and orchestral hits – VSCO 2 Community Edition (CC0 1.0)
https://github.com/sgossner/VSCO-2-CE – trimmed, faded and loudness-matched; the game re-pitches the nearest recorded note. Original E-minor witches' waltz (menu and game), sequenced note by note.

| Files | Instrument |
|---|---|
| org_48 … org_75 (10), ped_24 … ped_42 (7) | pipe organ manual and pedal |
| pz_D3 … pz_D5 (6), cb_E1 … cb_E2 (5) | violin and contrabass pizzicato |
| hp_D4, hp_A4, glissup | harp, harp glissando |
| tp_1 … tp_4, tproll, bd, crash, gong, cymcresc | timpani, bass drum, cymbals, gong |
| clank, bubbles_a | VSCO "Miscellania": metal clank, bubbling |

Code: three.js (MIT, see three.js-MIT.txt). Font: Fredoka (SIL Open Font License 1.1, see Fredoka-OFL.txt).
