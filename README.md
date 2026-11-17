# gta6-01-roni

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/anjay1933/gta6-01-roni/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Built for make.fun's [Make GTA 6](https://make.fun/bounty/gta6-01) bounty — $1,666 in USDC.

# NEON HARBOR — a 3D open-world crime game

A third-person open-world action game in the browser. You are Dana Cruz, a driver for the Harbor Crew, working a rain-slick neon port city at night: steal cars, outrun the law, and run six story missions from the docks to downtown.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no fetched assets: Three.js is vendored under `game/vendor/`, the city and textures are generated in code, and the sounds are synthesized with WebAudio.

## The game

- **Open world:** procedural 9×9 neon port city — dock district with cranes and container stacks, downtown towers with lit windows and neon signs, a bridge, a beach road. Night, rain, fog.
- **On foot + driving:** third-person on foot (run, jump) and 6 car types to steal and drive (sedan, taxi, truck, sport, van, police), with arcade handling, damage and smoke.
- **Traffic + pedestrians:** AI cars follow the road grid, 22 pedestrians walk the sidewalks and flee when shots are fired.
- **Wanted 1–5 stars:** car theft, hitting pedestrians and shooting raise your stars; foot cops chase and shoot, patrol cars ram you with light bars flashing. Lay low to cool off, or clear stars at the pay-n-spray ($150).
- **6 story missions:** First Pickup, Bridge Run, Container Yard, Hot Getaway, Downtown Shootout, Harbor Escape — with objective markers, cash rewards and progression.
- **Combat:** pistol with tracers, drive-by shooting from a car, fists, health/armor/ammo pickups, armed rivals.
- **HUD + minimap:** cash, health/armor, ammo, wanted stars, speed, objective + distance, and a live 2D minimap.
- **Save:** progress (cash, missions, unlocks) persists in localStorage; start screen, pause menu, busted/wasted/game-complete screens.

## Controls

- **W A S D** move · **Mouse** look/aim · **Shift** sprint · **Space** jump
- **E** enter/exit car · **Click** shoot / drive-by · **F** punch
- **P / Esc** pause · **M** mission details

## Files

- `game/index.html` — page + HUD shell
- `game/src/main.js` — boot, game loop, save/load
- `game/src/city.js` — procedural neon city, docks, rain
- `game/src/player.js` — Dana Cruz, third-person controls, camera
- `game/src/vehicles.js` — car types, driving physics, damage
- `game/src/traffic.js` — AI traffic + pedestrians
- `game/src/police.js` — wanted system, cops, pay-n-spray
- `game/src/missions.js` — 6-mission Harbor Crew story
- `game/src/combat.js` — pistol, drive-by, rivals
- `game/src/hud.js` — HUD, minimap, menus
- `game/src/audio.js` — synthesized WebAudio sounds + music
- `game/src/shots.js` — staged `?shot=` scenes for screenshots
- `game/src/config.js` — tuning constants
- `game/src/input.js` — keyboard + mouse
