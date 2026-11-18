# gta6-01-roni

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty — $1,666 in USDC.

# FROSTLINE — a 3D open-world crime game

A third-person open-world action game in the browser. You are Mara Voss, getaway driver for the Whiteout Crew, working Frostline Pass — a remote snowy alpine resort town at dusk, aurora in the sky, a frozen lake, pine forests, a ski lodge and a chairlift. Steal cars, outrun the ski patrol, and run six story missions from the lodge to the south gate.

## Run it

Open `game/index.html` in a desktop browser (or serve the `game/` folder with any static file server: `node serve.ts` → http://localhost:8080).

No build step, no network requests, no fetched assets: Three.js is vendored under `game/vendor/`, the town and textures are generated in code, and the sounds are synthesized with WebAudio.

## The game

- **Open world:** procedural alpine resort town — a main street of shops and a diner, the Frostline Lodge, seven cabins, a chairlift climbing the north slope, a frozen lake with an ice-fishing hut, pine forests, and an icy mountain pass road to the south gate. Dusk light, aurora ribbons, drifting snow.
- **On foot + driving:** third-person on foot (run, jump) and five car types to steal and drive, with arcade handling that slides on ice, damage and smoke.
- **Traffic + pedestrians:** AI cars follow the town roads, pedestrians stroll the sidewalks and flee when shots are fired.
- **Wanted 1–5 stars:** car theft, hitting pedestrians and shooting raise your stars; patrol SUVs chase and ram, roadblocks go up at 3+ stars. Lay low to cool off, or clear stars at the Snowline Garage ($150 respray).
- **6 story missions:** First Pickup, Powder Run, Lift House Heist, Hot Getaway, Lodge Shootout, Whiteout Escape — with objective markers, cash rewards and progression. Final mission runs on a 150-second timer in a blizzard.
- **Combat:** pistol with tracers and aim assist, drive-by shooting from a car, fists, health/armor/ammo pickups, armed rivals in the lodge shootout.
- **HUD + minimap:** cash, health/armor, ammo, wanted stars, speed, objective + distance, and a live 2D minimap with roads, the frozen lake, mission marker and police blips.
- **Save:** progress (cash, missions, health/armor/ammo) persists in localStorage; start screen, pause menu, busted/wasted and game-complete screens.

## Controls

- **W A S D** move / drive · **Mouse** look/aim (click to lock) · **Shift** sprint · **Space** jump / handbrake
- **E** enter/exit car · **Click** shoot · **F** punch
- **R** drive-by while driving · **G** respray at the garage ($150, clears wanted)
- **P / Esc** pause · **M** mute

## Tips

- **Wanted?** Drive into the Snowline Garage and press **G** ($150) to clear your stars — or lay low until the heat cools off.
- **Ice is slick:** the frozen lake and snowy ground slide — brake early, steer gently, and use the handbrake to swing around.

## Files

- `game/` — the playable game; open `game/index.html`
- `game/src/` — game code (config, world, player, vehicles, people, wanted, combat, missions, HUD, audio, shots)
- `game/vendor/` — vendored Three.js, works fully offline
- `screenshots/` — staged renders of the game
- `main.ts` — builds the submission dossier
