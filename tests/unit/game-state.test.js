import { afterEach, describe, expect, it } from "vitest";
import { defaultGame } from "../helpers/fake-supabase.js";
import { loadControlApp } from "../helpers/load-control-app.js";

let app;

afterEach(() => app?.close());

function game() {
  return app.fake.database.tables.live_games[0];
}

describe("current game-state behavior", () => {
  it("updates scores and prevents a negative score", async () => {
    app = await loadControlApp();

    await app.window.changeScore("away", 1);
    await app.window.changeScore("home", 2);
    await app.window.changeScore("away", -5);

    expect(game().away_score).toBe(0);
    expect(game().home_score).toBe(2);
  });

  it("moves to the next half-inning on the third out", async () => {
    app = await loadControlApp({
      seed: {
        game: defaultGame({
          inning: 4,
          inning_half: "top",
          balls: 2,
          strikes: 1,
          outs: 2,
          runner_first: true,
          runner_second: true
        })
      }
    });

    await app.window.manualOut(1);

    expect(game()).toMatchObject({
      inning: 4,
      inning_half: "bottom",
      balls: 0,
      strikes: 0,
      outs: 0,
      runner_first: false,
      runner_second: false,
      runner_third: false
    });
  });

  it("increments the inning after the bottom half ends", async () => {
    app = await loadControlApp({
      seed: {
        game: defaultGame({ inning: 6, inning_half: "bottom", outs: 2 })
      }
    });

    await app.window.manualOut(1);

    expect(game().inning).toBe(7);
    expect(game().inning_half).toBe("top");
  });

  it("supports manual count, base and half-inning controls", async () => {
    app = await loadControlApp();

    await app.window.manualCount("balls", 1);
    await app.window.manualCount("strikes", 1);

    expect(game()).toMatchObject({ balls: 1, strikes: 1 });

    await app.window.manualOut(1);
    await app.window.toggleBase("runner_first");
    await app.window.toggleBase("runner_third");

    expect(game()).toMatchObject({
      balls: 0,
      strikes: 0,
      outs: 1,
      runner_first: true,
      runner_third: true
    });

    await app.window.toggleHalf();

    expect(game()).toMatchObject({
      inning_half: "bottom",
      balls: 0,
      strikes: 0,
      outs: 0,
      runner_first: false,
      runner_second: false,
      runner_third: false
    });
  });

  it("increments the active pitcher's count for pitch controls", async () => {
    app = await loadControlApp();

    await app.window.ball();
    await app.window.strike();
    await app.window.foul();

    expect(game().balls).toBe(1);
    expect(game().strikes).toBe(2);
    expect(game().home_pitch_count).toBe(3);
    expect(game().away_pitch_count).toBe(0);
  });
});
