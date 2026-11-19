# EMBER ISLE — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A GTA-style open-world crime game on a **volcanic tropical island**, built for the
[Make GTA 6 bounty on make.fun](https://make.fun/bounty/gta6-01) ($1,666, ends 24 Nov 2026).

## The island

Ember Isle is not another coastal city. An active volcano crowns the north, lava
flows run down its slopes, the beaches are black sand, the jungle is thick, and
one small port town — Port Ember — is the only place with streetlights. You play
**Rico**, getaway driver for Mama Lava's smuggling crew.

## What is in the game

- **Open world, on foot and by car** — steal parked cars, drive the island's road
  network (or cut across the jungle and the beach), with traffic cruising the roads
  and civilians who flee from gunfire.
- **6 story missions** — steal the sunset buggy, run a package to the jungle drop,
  raid the volcano observatory on foot, beat the last ferry's 2:30 deadline, hold
  the jungle stash against two rival waves, and finally grab the crater gold while
  the volcano erupts and the lava spreads — then escape by boat.
- **Wanted system, 1–5 stars** — crimes raise the heat; police cruisers chase and
  ram, foot cops join from 2 stars, and the heat cools off if you stay quiet.
- **Combat** — mouse-aim pistol, guards and rivals who shoot back, wreckable cars
  that explode, lava that burns on foot and wrecks cars.
- **HUD + minimap** — health, cash, wanted stars, objective banner, mission timer,
  off-screen objective arrow, and a live minimap with police, rival and objective blips.
- **Save** — progress and cash save automatically after every mission; the title
  screen continues from the highest unlocked mission.
- **Sound** — everything is synthesized with WebAudio (engine hum, sirens,
  gunshots, explosions). No audio files, no network requests.
- **Screenshots** — `?shot=cover|foot|chase|mission` stages a real played scene
  from a fixed seed, so the four screenshots are honest frames of the game.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse + click | Aim, shoot |
| E | Enter / exit car |
| Space | Handbrake |
| P | Pause |
| R | Restart mission |
| M | Mute |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` with the vendored make.fun library (`vendor/makefun-game.ts`).

## Source layout

| File | Job |
| --- | --- |
| `game/src/main.js` | Boot, game loop, screens, saving |
| `game/src/config.js` | Every tunable number |
| `game/src/world.js` | Island generation, roads, lava, collision |
| `game/src/player.js` | Rico on foot |
| `game/src/vehicles.js` | Cars: player, traffic, police |
| `game/src/people.js` | Civilians, guards, rivals, cops |
| `game/src/combat.js` | Bullets, explosions, particles |
| `game/src/wanted.js` | Heat, stars, police response |
| `game/src/missions.js` | The six missions |
| `game/src/hud.js` | HUD + minimap |
| `game/src/render.js` | All drawing + screens |
| `game/src/autopilot.js` | Plays the game (verify run + shot scenes) |
| `game/src/shots.js` | The four screenshot scenes |
| `game/src/input.js` | Keyboard/mouse, incl. virtual keys |
| `game/src/audio.js` | Synthesized WebAudio sound |
| `game/src/random.js` | Seeded RNG + helpers |

All characters, places, story, art and sound are original — nothing from Rockstar Games.
