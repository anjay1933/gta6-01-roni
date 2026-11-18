// DUSTLINE hand-in: copies game/ and screenshots/ next to this file into the
// output directory and writes the dossier the judge reads, using the kit's
// buildDossier library (vendor/makefun-game.ts, untouched).
//
// Run it outside the grader with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The grader sets /output itself; MAKEFUN_OUTPUT_DIR only stands in for it here.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
}

copyTree(join(repoRoot, 'game'), join(outDir, 'game'));
if (existsSync(join(repoRoot, 'screenshots'))) {
  copyTree(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
}

// The caps mirror the gate: 4 screenshots at most, each under 256 KiB; game/ under
// 993 entries and 48 MiB; the dossier text itself capped at 160 KiB.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

// Small build report so a human can see at a glance that the hand-in is complete.
import { statSync, readdirSync } from 'node:fs';
const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true });
const shotFiles = existsSync(join(outDir, 'screenshots'))
  ? readdirSync(join(outDir, 'screenshots'))
  : [];
console.log(`DUSTLINE hand-in written to ${outDir}`);
console.log(`  game/: ${gameFiles.length} entries`);
console.log(`  screenshots/: ${shotFiles.join(', ') || '(none)'}`);
console.log(`  dossier.json: ${statSync(join(outDir, 'dossier.json')).size} bytes`);
