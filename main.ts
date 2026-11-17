// NEON HARBOR — the entry program (Node 22, standard library only).
// It stages the game for the scorer: game/ and screenshots/ are copied from
// beside this file into the output directory, and /output/dossier.json is
// written with the vendored make.fun library so the judge can read the entry.
//
// Local check (also what the gate runs, with /output instead of out/):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   # then confirm out/dossier.json exists and out/game stays under the caps.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// Caps mirror the gate (see the kit's RULES.txt): the dossier text cap shapes
// the bytes, the rest refuse an entry the scorer would refuse — too many or
// too large screenshots, too many files or bytes under game/, or a game path
// over 1000 bytes. game/ shares /output's own 1000-entry cap with
// screenshots/ and dossier.json, so the caps below leave room.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
