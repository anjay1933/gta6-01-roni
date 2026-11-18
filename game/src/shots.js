// The screenshot scenes behind ?shot=cover|foot|chase|mission. Each one
// plays the real game forward from a fresh world with the autopilot at the
// wheel, so the frame is what a short game really looks like — the same
// seed always gives the same island. If the autopilot dies mid-staging, the
// scene restarts once with a shorter run, so a screenshot never shows a
// fail screen.
import { startMission } from './missions.js';
import { createAutopilot } from './autopilot.js';

function runPilot(game, seconds) {
  const pilot = createAutopilot(game);
  const steps = Math.floor(seconds * 60);
  for (let i = 0; i < steps; i++) {
    pilot.update(game, 1 / 60);
    game.step(1 / 60);
    game.input.endFrame();
    if (game.mission && (game.mission.phase === 'done' || game.mission.phase === 'failed')) break;
    if (game.player.dead) break;
  }
}

function activate(game, index) {
  startMission(game, index);
  game.mission.phase = 'active';
  game.mission.briefTimer = 0;
  game.screen = 'play';
}

function sceneOk(game) {
  return !game.player.dead && game.mission && game.mission.phase === 'active';
}

// Run `stage` up to twice; the second attempt plays for fewer seconds.
function attempt(game, seconds, stage) {
  for (let n = 0; n < 2; n++) {
    if (n > 0) game.reset(20261118);
    stage(game, seconds);
    if (sceneOk(game)) return;
    seconds = Math.max(2, seconds / 2);
  }
}

export function stageShot(name, game) {
  game.reset(20261118);
  game.zoomOverride = 1;
  if (name === 'foot') {
    // Two seconds: Rico is just into the observatory fight — crates still
    // on the ground, guards still shooting. Any longer and he clears the
    // crates and walks to the exit before the shutter fires.
    attempt(game, 2, (g, s) => {
      activate(g, 2);
      runPilot(g, s);
    });
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // Three seconds of the ferry run: Rico is mid-drive on the open road
    // with the police chasing behind. Any longer and the fixed causeway
    // lets him reach the ferry before the shutter fires.
    attempt(game, 3, (g, s) => {
      activate(g, 3);
      runPilot(g, s);
    });
    return { screen: 'play' };
  }
  if (name === 'mission') {
    attempt(game, 0, (g) => {
      activate(g, 5);
      // Drive the eruption job forward until the gold is grabbed and the
      // lava is spreading, then hold the escape for a few seconds.
      const pilot = createAutopilot(g);
      let steps = 0;
      while (g.mission.stage < 2 && steps < 60 * 150 && sceneOk(g)) {
        pilot.update(g, 1 / 60);
        g.step(1 / 60);
        g.input.endFrame();
        steps++;
      }
      if (sceneOk(g)) runPilot(g, 10);
    });
    return { screen: 'play' };
  }
  // Cover: the buggy theft, two stars already on Rico, the volcano and the
  // black-sand coast in frame, police closing in behind.
  game.zoomOverride = 0.82;
  attempt(game, 4, (g, s) => {
    activate(g, 0);
    runPilot(g, s);
    if (sceneOk(g)) g.wanted.setStars(2);
  });
  return { screen: 'play' };
}
