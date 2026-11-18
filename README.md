# gta6-01-roni

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty — $1,666 in USDC.

# DUSTLINE — a 3D open-world crime game

A third-person open-world action game in the browser. You are Jax Marlowe, a driver for The Dustline Runners, working Copper Flats — a sun-baked desert highway town at golden hour: steal cars, outrun the law, and run six story missions from the gas station strip to the canyon bridge.

## Run it

Open `game/index.html` in a desktop browser (or serve the `game/` folder with any static file server).

No build step, no network requests, no fetched assets: Three.js is vendored under `game/vendor/`, the town and textures are generated in code, and the sounds are synthesized with WebAudio.

## The game

- **Open world:** procedural desert highway town — highway strip with gas stations, motels and glowing diner signs, a low-rise downtown with a water tower, a canyon bridge, a quarry, and desert outskirts with mesas and drifting dust. Golden-hour sun, long shadows, dust haze.
- **On foot + driving:** third-person on foot (run, jump) and several car types to steal and drive, with arcade handling, damage and smoke.
- **Traffic + pedestrians:** AI cars follow the roads, pedestrians walk the sidewalks and flee when shots are fired.
- **Wanted 1–5 stars:** car theft, hitting pedestrians and shooting raise your stars; foot cops chase, patrol cars ram you with light bars flashing. Lay low to cool off, or clear stars at the paint shop.
- **6 story missions:** First Pickup, Bridge Run, Quarry Heist, Hot Getaway, Main-Street Shootout, Desert Escape — with objective markers, cash rewards and progression.
- **Combat:** pistol with tracers, drive-by shooting from a car, fists, health/armor/ammo pickups, armed rivals.
- **HUD + minimap:** cash, health/armor, ammo, wanted stars, speed, objective + distance, and a live 2D minimap.
- **Save:** progress (cash, missions, unlocks) persists in localStorage; start screen, pause menu, busted/wasted/game-complete screens.

## Controls

- **W A S D** move · **Mouse** look/aim · **Shift** sprint · **Space** jump
- **E** enter/exit car · **Click** shoot · **F** punch
- **R** drive-by while driving · **G** respray at the blue SPRAY garage ($150, clears wanted)
- **P / Esc** pause · **M** mute

## Tips

- **Wanted?** Steal a car and hit the blue SPRAY garage ($150) to clear your stars — or lay low until the heat cools off.

## Files

- `game/` — the playable game; open `game/index.html`
- `game/src/` — game code (city, player, vehicles, traffic, police, missions, combat, HUD, audio)
- `game/vendor/` — vendored Three.js, works fully offline
- `screenshots/` — staged renders of the game
- `main.ts` — builds the submission dossier
