// Nusa Air — the entrypoint (Node 22, standard library only).
//
// The game lives in this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library, no network request). This program
// hands it in. It copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there, the summary the judge reads, using the vendored
// make.fun library (vendor/makefun-game.ts). A starting point it is not: every line of the
// game, and of this file, was written for this entry.
//
// Run it outside the grader with an output directory of your own:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader, MAKEFUN_OUTPUT_DIR is unset and the output goes to /output.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file sits, and where the hand-in goes.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// The scorer's own caps: the dossier text is capped at 160 KiB, and the rest refuse an entry
// the scorer would refuse anyway (more than 4 screenshots, one over 256 KiB, more than 993
// files in game/ or 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function handIn() {
  // Start clean so a stale file from an earlier run can never ride along.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  // The game itself, and the screenshots the judge sees first.
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
  }

  // The dossier is built from exactly what was just copied, so it always matches.
  const dossier = buildDossier(outputDir, DOSSIER_CAPS);
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  return outputDir;
}

const handedTo = handIn();
console.log(`Nusa Air handed in to ${handedTo}`);
