import { afterEach, describe, expect, it } from "vitest";
import { defaultGame, rosterPlayer } from "../helpers/fake-supabase.js";
import { loadControlApp } from "../helpers/load-control-app.js";

let app;

afterEach(() => app?.close());

async function setup(gameOverrides = {}) {
  app = await loadControlApp({
    seed: {
      game: defaultGame(gameOverrides),
      rosters: [rosterPlayer({ id: "away-batter", player_name: "Batter" })]
    }
  });
  return app;
}

function game() {
  return app.fake.database.tables.live_games[0];
}

function events() {
  return app.fake.database.tables.game_events;
}

function lastEvent() {
  return events().at(-1);
}

describe("current plate-appearance behavior", () => {
  it("records a ball", async () => {
    await setup();
    await app.window.ball();

    expect(game()).toMatchObject({ balls: 1, strikes: 0, home_pitch_count: 1 });
    expect(lastEvent().event_type).toBe("BALL");
  });

  it("records a strike", async () => {
    await setup();
    await app.window.strike();

    expect(game()).toMatchObject({ balls: 0, strikes: 1, home_pitch_count: 1 });
    expect(lastEvent().event_type).toBe("STRIKE");
  });

  it("does not add a third strike for a two-strike foul", async () => {
    await setup({ strikes: 2 });
    await app.window.foul();

    expect(game()).toMatchObject({ strikes: 2, home_pitch_count: 1 });
    expect(lastEvent().event_type).toBe("FOUL");
  });

  it("forces a run on a bases-loaded walk", async () => {
    await setup({
      balls: 3,
      strikes: 1,
      runner_first: true,
      runner_second: true,
      runner_third: true
    });

    await app.window.ball();

    expect(game()).toMatchObject({
      away_score: 1,
      balls: 0,
      strikes: 0,
      runner_first: true,
      runner_second: true,
      runner_third: true,
      home_pitch_count: 1
    });
    expect(lastEvent()).toMatchObject({ event_type: "WALK", runs_scored: 1, rbi: 1 });
    expect(lastEvent().event_description).toContain("Pitch sequence: B");
  });

  it("records a strikeout and an out", async () => {
    await setup({ balls: 2, strikes: 2, outs: 1 });
    await app.window.strike();

    expect(game()).toMatchObject({ balls: 0, strikes: 0, outs: 2, home_pitch_count: 1 });
    expect(lastEvent().event_type).toBe("STRIKEOUT");
  });

  it("forces a run on a bases-loaded HBP", async () => {
    await setup({ runner_first: true, runner_second: true, runner_third: true });
    await app.window.hitByPitch();

    expect(game()).toMatchObject({ away_score: 1, home_pitch_count: 1 });
    expect(lastEvent()).toMatchObject({ event_type: "HBP", runs_scored: 1, rbi: 1 });
  });

  it("puts the batter on first after a single", async () => {
    await setup();
    await app.window.singleHit();

    expect(game()).toMatchObject({
      runner_first: true,
      runner_second: false,
      runner_third: false,
      home_pitch_count: 1
    });
    expect(lastEvent().event_type).toBe("SINGLE");
  });

  it("advances runners using the current double behavior", async () => {
    await setup({ runner_first: true, runner_second: true, runner_third: true });
    await app.runWithAnswers(
      () => app.window.doubleHit(),
      [{ type: "decision", value: false }]
    );

    expect(game()).toMatchObject({
      away_score: 2,
      runner_first: false,
      runner_second: true,
      runner_third: true,
      home_pitch_count: 1
    });
    expect(lastEvent().event_type).toBe("DOUBLE");
  });

  it("scores all existing runners on a triple", async () => {
    await setup({ runner_first: true, runner_second: true, runner_third: true });
    await app.window.tripleHit();

    expect(game()).toMatchObject({
      away_score: 3,
      runner_first: false,
      runner_second: false,
      runner_third: true
    });
    expect(lastEvent().event_type).toBe("TRIPLE");
  });

  it("scores the batter and all runners on a home run", async () => {
    await setup({ runner_first: true, runner_second: true, runner_third: true });
    await app.window.homeRun();

    expect(game()).toMatchObject({
      away_score: 4,
      runner_first: false,
      runner_second: false,
      runner_third: false
    });
    expect(lastEvent()).toMatchObject({ event_type: "HOME_RUN", runs_scored: 4, rbi: 4 });
  });

  it("puts the batter on first after an error", async () => {
    await setup();
    await app.window.errorPlay();

    expect(game()).toMatchObject({ runner_first: true, home_pitch_count: 1 });
    expect(lastEvent()).toMatchObject({ event_type: "ERROR", rbi: 0 });
  });

  it("records a fielder's choice out at second", async () => {
    await setup({ runner_first: true });
    await app.runWithAnswers(
      () => app.window.fieldersChoice(),
      [{ type: "choice", index: 0 }]
    );

    expect(game()).toMatchObject({ outs: 1, runner_first: true, runner_second: false });
    expect(lastEvent().event_type).toBe("FIELDERS_CHOICE");
  });

  it("records a sacrifice fly with fewer than two outs", async () => {
    await setup({ outs: 1, runner_third: true });
    await app.runWithAnswers(
      () => app.window.sacFly(),
      [{ type: "decision", value: true }]
    );

    expect(game()).toMatchObject({ away_score: 1, outs: 2, runner_third: false });
    expect(lastEvent()).toMatchObject({ event_type: "SAC_FLY", runs_scored: 1, rbi: 1 });
  });

  it("records the current first-base double-play path", async () => {
    await setup({ runner_first: true });
    await app.window.doublePlay();

    expect(game()).toMatchObject({ outs: 2, runner_first: false });
    expect(lastEvent().event_type).toBe("DOUBLE_PLAY");
  });
});

