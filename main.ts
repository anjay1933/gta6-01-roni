// FROSTLINE — submission program (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ beside this file into the
// output directory and writes /output/dossier.json with the kit's vendored
// dossier builder. Run outside the grader with MAKEFUN_OUTPUT_DIR set:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });

// The whole playable game, plain static files.
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

// The maker's screenshots (the first by name is the cover).
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  for (const name of readdirSync(shotsDir)) {
    if (name.startsWith('.')) continue;
    cpSync(join(shotsDir, name), join(outDir, 'screenshots', name));
  }
}

// The dossier the judge reads: sources, vendored files, assets and totals.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
