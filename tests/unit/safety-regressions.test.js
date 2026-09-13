import { afterEach, describe, expect, it } from "vitest";
import { defaultGame, rosterPlayer } from "../helpers/fake-supabase.js";
import { loadControlApp } from "../helpers/load-control-app.js";

let app;

afterEach(() => app?.close());

function game() {
  return app.fake.database.tables.live_games[0];
}

function events() {
  return app.fake.database.tables.game_events;
}

async function setup(gameOverrides = {}) {
  app = await loadControlApp({
    seed: {
      game: defaultGame(gameOverrides),
      rosters: [rosterPlayer({ id: "batter", player_name: "Batter" })]
    }
  });
}

describe("Phase 2 safety edge cases", () => {
  it("rejects a sacrifice fly when no runner is on third", async () => {
    await setup({ outs: 1 });

    await app.window.sacFly();

    expect(game()).toMatchObject({
      away_score: 0,
      outs: 1,
      home_pitch_count: 0
    });
    expect(events()).toHaveLength(0);
  });

  it("ends the half-inning correctly on a legal double play with one out", async () => {
    await setup({
      inning: 5,
      inning_half: "top",
      outs: 1,
      runner_second: true
    });

    await app.window.doublePlay();

    expect(game()).toMatchObject({
      inning: 5,
      inning_half: "bottom",
      outs: 0,
      runner_first: false,
      runner_second: false,
      runner_third: false,
      home_pitch_count: 1
    });
    expect(events().at(-1)).toMatchObject({
      event_type: "DOUBLE_PLAY",
      outs_before: 1,
      outs_after: 0
    });
  });

  it("resolves a bases-loaded SINGLE without collapsing runner origins", async () => {
    await setup({
      runner_first: true,
      runner_second: true,
      runner_third: true
    });

    await app.runWithAnswers(
      () => app.window.singleHit(),
      [
        { type: "decision", value: false },
        { type: "choice", index: 1 }
      ]
    );

    expect(game()).toMatchObject({
      away_score: 0,
      outs: 1,
      runner_first: true,
      runner_second: true,
      runner_third: true
    });
    expect(events().at(-1).event_description).toContain("Runner from 2B was out");
  });

  it("resolves a bases-loaded ERROR without collapsing runner origins", async () => {
    await setup({
      runner_first: true,
      runner_second: true,
      runner_third: true
    });

    await app.runWithAnswers(
      () => app.window.errorPlay(),
      [
        { type: "decision", value: false },
        { type: "choice", index: 2 }
      ]
    );

    expect(game()).toMatchObject({
      away_score: 0,
      outs: 1,
      runner_first: true,
      runner_second: true,
      runner_third: true
    });
    expect(events().at(-1).event_description).toContain("Runner from 1B was out");
  });

  it("clears persisted plate-appearance tracking when the count is reset", async () => {
    await setup();
    await app.window.ball();
    await app.window.strike();

    await app.window.resetCount();

    expect(game()).toMatchObject({
      balls: 0,
      strikes: 0,
      away_pitch_sequence: [],
      away_pa_start_pitch_count: null
    });
    expect(app.window.getPitchSequenceText("away")).toBe("");
  });

  it("locks rapid duplicate SINGLE actions to one state transition", async () => {
    await setup();

    await Promise.all([
      app.window.singleHit(),
      app.window.singleHit()
    ]);

    expect(game()).toMatchObject({
      runner_first: true,
      home_pitch_count: 1
    });
    expect(
      events().filter(event => event.event_type === "SINGLE")
    ).toHaveLength(1);
  });
});
