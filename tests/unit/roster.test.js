import { afterEach, describe, expect, it } from "vitest";
import { createFakeSupabase, rosterPlayer } from "../helpers/fake-supabase.js";
import { loadControlApp } from "../helpers/load-control-app.js";

let app;

afterEach(() => app?.close());

function roster() {
  return app.fake.database.tables.game_rosters;
}

describe("current roster behavior", () => {
  it("creates an active lineup player", async () => {
    app = await loadControlApp();
    await app.window.addLineupPlayer("away");

    expect(roster()).toHaveLength(1);
    expect(roster()[0]).toMatchObject({
      team_side: "away",
      batting_order: 1,
      roster_status: "active"
    });
  });

  it("deletes a roster player", async () => {
    app = await loadControlApp({
      seed: { rosters: [rosterPlayer({ id: "delete-me" })] }
    });

    await app.window.deleteRosterPlayer("away", app.window.getLineup("away")[0]);

    expect(roster()).toHaveLength(0);
  });

  it("enforces the current maximum of 12 active hitters", async () => {
    const players = Array.from({ length: 12 }, (_, index) =>
      rosterPlayer({
        id: `player-${index + 1}`,
        batting_order: index + 1,
        position: index < 11 ? "" : "EH"
      })
    );

    app = await loadControlApp({ seed: { rosters: players } });
    await app.window.addLineupPlayer("away");

    expect(roster()).toHaveLength(12);
    expect(app.alerts).toContain("Maximum lineup is 12.");
  });

  it("removes a position from the available list at its limit", async () => {
    app = await loadControlApp({
      seed: {
        rosters: [
          rosterPlayer({ id: "pitcher", position: "P" }),
          rosterPlayer({ id: "eh-1", batting_order: 2, position: "EH" }),
          rosterPlayer({ id: "eh-2", batting_order: 3, position: "EH" })
        ]
      }
    });

    const available = app.window.getAvailablePositions("away");

    expect(available).not.toContain("P");
    expect(available).not.toContain("EH");
    expect(available).toContain("C");
  });

  it("permanently substitutes a player into the same batting slot", async () => {
    const outgoing = rosterPlayer({
      id: "starter",
      batting_order: 4,
      player_name: "Starter",
      position: "SS"
    });
    const substitute = rosterPlayer({
      id: "substitute",
      batting_order: null,
      player_name: "Substitute",
      position: "2B",
      roster_status: "sub"
    });

    app = await loadControlApp({ seed: { rosters: [outgoing, substitute] } });
    await app.runWithAnswers(
      () => app.window.permanentSub("away", app.window.getSubs("away")[0]),
      [
        { type: "choice", index: 0 },
        { type: "decision", value: true }
      ]
    );

    expect(roster().find(player => player.id === "starter").roster_status).toBe("used");
    expect(roster().find(player => player.id === "substitute")).toMatchObject({
      roster_status: "active",
      batting_order: 4,
      position: "SS"
    });
  });

  it("activates a pinch hitter for the current plate appearance", async () => {
    const starter = rosterPlayer({ id: "starter", player_name: "Starter" });
    const substitute = rosterPlayer({
      id: "pinch-hitter",
      batting_order: null,
      player_name: "Pinch Hitter",
      roster_status: "sub"
    });

    app = await loadControlApp({ seed: { rosters: [starter, substitute] } });
    await app.runWithAnswers(
      () => app.window.startPinchHit("away", app.window.getSubs("away")[0]),
      [{ type: "choice", index: 0 }]
    );

    expect(app.window.getCurrentBatterForSide("away").id).toBe("pinch-hitter");
    expect(app.fake.database.tables.game_events.at(-1).event_type).toBe("PINCH_HITTER");
  });

  it("persists saved roster data after a page reload", async () => {
    const fake = createFakeSupabase({
      rosters: [rosterPlayer({ id: "persistent-player", player_name: "Before" })]
    });
    const firstLoad = await loadControlApp({ fake });
    const player = firstLoad.window.getLineup("away")[0];

    player.player_name = "After Reload";
    player.jersey_number = "27";
    await firstLoad.window.saveSinglePlayer("away", player);
    firstLoad.close();

    app = await loadControlApp({ fake });

    expect(app.window.getLineup("away")[0]).toMatchObject({
      player_name: "After Reload",
      jersey_number: "27"
    });
  });
});

