import { afterEach, describe, expect, it } from "vitest";
import {
  createFakeSupabase,
  defaultGame,
  rosterPlayer
} from "../helpers/fake-supabase.js";
import { loadControlApp } from "../helpers/load-control-app.js";

let app;

afterEach(() => app?.close());

function game() {
  return app.fake.database.tables.live_games[0];
}

describe("audited production bug regressions", () => {
  it("BUG: autosave preserves edits to two different players on the same team", async () => {
    app = await loadControlApp({
      seed: {
        rosters: [
          rosterPlayer({ id: "player-a", player_name: "Player A" }),
          rosterPlayer({ id: "player-b", batting_order: 2, player_name: "Player B" })
        ]
      }
    });

    const [playerA, playerB] = app.window.getLineup("away");
    playerA.player_name = "Edited A";
    app.window.schedulePlayerAutosave("away", playerA);
    playerB.player_name = "Edited B";
    app.window.schedulePlayerAutosave("away", playerB);

    await new Promise(resolve => app.window.setTimeout(resolve, 700));

    expect(app.fake.database.tables.game_rosters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "player-a", player_name: "Edited A" }),
        expect.objectContaining({ id: "player-b", player_name: "Edited B" })
      ])
    );
  });

  it("BUG: a SINGLE cannot collapse two existing runners onto third base", async () => {
    app = await loadControlApp({
      seed: {
        game: defaultGame({ runner_second: true, runner_third: true }),
        rosters: [rosterPlayer({ id: "batter" })]
      }
    });

    await app.runWithAnswers(
      () => app.window.singleHit(),
      [
        { type: "decision", value: false }
      ]
    );

    expect(game()).toMatchObject({
      runner_first: true,
      runner_second: true,
      runner_third: true
    });
  });

  it("BUG: an ERROR cannot collapse two existing runners onto third base", async () => {
    app = await loadControlApp({
      seed: {
        game: defaultGame({ runner_second: true, runner_third: true }),
        rosters: [rosterPlayer({ id: "batter" })]
      }
    });

    await app.runWithAnswers(
      () => app.window.errorPlay(),
      [
        { type: "decision", value: false }
      ]
    );

    expect(game()).toMatchObject({
      runner_first: true,
      runner_second: true,
      runner_third: true
    });
  });

  it("BUG: a sacrifice fly with two outs cannot score a run", async () => {
    app = await loadControlApp({
      seed: {
        game: defaultGame({ outs: 2, runner_third: true }),
        rosters: [rosterPlayer({ id: "batter" })]
      }
    });

    await app.window.sacFly();

    expect(game().away_score).toBe(0);
    expect(game()).toMatchObject({
      outs: 2,
      runner_third: true,
      home_pitch_count: 0
    });
    expect(app.fake.database.tables.game_events).toHaveLength(0);
  });

  it("BUG: double play is rejected when no runner can be retired", async () => {
    app = await loadControlApp({
      seed: { rosters: [rosterPlayer({ id: "batter" })] }
    });

    await app.window.doublePlay();

    expect(game().outs).toBe(0);
    expect(app.fake.database.tables.game_events).toHaveLength(0);
  });

  it("BUG: double play is not recorded when there are already two outs", async () => {
    app = await loadControlApp({
      seed: {
        game: defaultGame({ outs: 2, runner_first: true }),
        rosters: [rosterPlayer({ id: "batter" })]
      }
    });

    await app.window.doublePlay();

    expect(
      app.fake.database.tables.game_events.some(event => event.event_type === "DOUBLE_PLAY")
    ).toBe(false);
  });

  it("BUG: a completed pinch hitter replaces the original batting-order player", async () => {
    const starter = rosterPlayer({ id: "starter", player_name: "Starter" });
    const pinchHitter = rosterPlayer({
      id: "pinch-hitter",
      batting_order: null,
      player_name: "Pinch Hitter",
      roster_status: "sub"
    });

    app = await loadControlApp({ seed: { rosters: [starter, pinchHitter] } });
    await app.runWithAnswers(
      () => app.window.startPinchHit("away", app.window.getSubs("away")[0]),
      [{ type: "choice", index: 0 }]
    );
    await app.window.singleHit();

    const rows = app.fake.database.tables.game_rosters;
    expect(rows.find(player => player.id === "starter").roster_status).toBe("used");
    expect(rows.find(player => player.id === "pinch-hitter")).toMatchObject({
      roster_status: "active",
      batting_order: 1
    });
  });

  it("BUG: page reload preserves the current batter", async () => {
    const fake = createFakeSupabase({
      rosters: [
        rosterPlayer({ id: "batter-1", batting_order: 1 }),
        rosterPlayer({ id: "batter-2", batting_order: 2 }),
        rosterPlayer({ id: "batter-3", batting_order: 3 })
      ]
    });
    const firstLoad = await loadControlApp({ fake });
    await firstLoad.window.nextBatter();
    await firstLoad.window.nextBatter();
    const expectedId = firstLoad.window.getCurrentBatterForSide("away").id;
    firstLoad.close();

    app = await loadControlApp({ fake });

    expect(app.window.getCurrentBatterForSide("away").id).toBe(expectedId);
  });

  it("BUG: page reload preserves the active plate-appearance pitch sequence", async () => {
    const fake = createFakeSupabase({
      rosters: [
        rosterPlayer({ id: "batter-1", batting_order: 1 }),
        rosterPlayer({ id: "batter-2", batting_order: 2 })
      ]
    });
    const firstLoad = await loadControlApp({ fake });
    await firstLoad.window.nextBatter();
    const expectedBatterId = firstLoad.window.getCurrentBatterForSide("away").id;
    await firstLoad.window.ball();
    await firstLoad.window.strike();
    await firstLoad.window.ball();
    await firstLoad.window.strike();
    expect(firstLoad.window.getPitchSequenceText("away")).toBe("B-S-B-S");
    expect(firstLoad.fake.database.tables.live_games[0]).toMatchObject({
      balls: 2,
      strikes: 2,
      away_pitch_sequence: ["B", "S", "B", "S"],
      away_pa_start_pitch_count: 0
    });
    firstLoad.close();

    app = await loadControlApp({ fake });

    expect(app.window.getCurrentBatterForSide("away").id).toBe(expectedBatterId);
    expect(app.window.getPitchSequenceText("away")).toBe("B-S-B-S");
    expect(game()).toMatchObject({ balls: 2, strikes: 2 });
  });

  it("BUG: rapid duplicate actions cannot create duplicate pitch events", async () => {
    app = await loadControlApp({
      seed: { rosters: [rosterPlayer({ id: "batter" })] }
    });

    await Promise.all([app.window.ball(), app.window.ball()]);

    const ballEvents = app.fake.database.tables.game_events.filter(
      event => event.event_type === "BALL"
    );
    expect(ballEvents).toHaveLength(1);
  });

  it("BUG: Start New Game clears persisted current-batter fields", async () => {
    app = await loadControlApp({
      confirmations: [true],
      seed: {
        game: defaultGame({
          current_batter_number: "44",
          current_batter_name: "Previous Batter",
          away_current_batter_slot: 7,
          home_current_batter_slot: 4,
          away_pitch_sequence: ["B", "S"],
          home_pitch_sequence: ["F"],
          away_pa_start_pitch_count: 21,
          home_pa_start_pitch_count: 37
        })
      }
    });

    await app.window.startNewGame();

    expect(game()).toMatchObject({
      current_batter_number: "",
      current_batter_name: "",
      away_current_batter_slot: 1,
      home_current_batter_slot: 1,
      away_pitch_sequence: [],
      home_pitch_sequence: [],
      away_pa_start_pitch_count: null,
      home_pa_start_pitch_count: null
    });
  });
});
