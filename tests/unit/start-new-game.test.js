import { afterEach, describe, expect, it } from "vitest";
import { defaultGame, rosterPlayer } from "../helpers/fake-supabase.js";
import { loadControlApp } from "../helpers/load-control-app.js";

let app;

afterEach(() => app?.close());

describe("current Start New Game behavior", () => {
  it("clears scoreboard, pitchers, events and both complete rosters", async () => {
    const rosters = [
      rosterPlayer({ id: "away-active", roster_status: "active" }),
      rosterPlayer({ id: "away-sub", batting_order: null, roster_status: "sub" }),
      rosterPlayer({ id: "away-used", batting_order: null, roster_status: "used" }),
      rosterPlayer({ id: "home-active", team_side: "home", roster_status: "active" }),
      rosterPlayer({ id: "home-sub", team_side: "home", batting_order: null, roster_status: "sub" }),
      rosterPlayer({ id: "home-used", team_side: "home", batting_order: null, roster_status: "used" })
    ];

    app = await loadControlApp({
      confirmations: [true],
      seed: {
        game: defaultGame({
          away_team: "Visitors",
          home_team: "Hosts",
          away_score: 8,
          home_score: 7,
          inning: 9,
          inning_half: "bottom",
          balls: 3,
          strikes: 2,
          outs: 2,
          runner_first: true,
          runner_second: true,
          runner_third: true,
          away_pitcher_number: "12",
          away_pitcher_name: "Away Pitcher",
          away_pitch_count: 88,
          home_pitcher_number: "21",
          home_pitcher_name: "Home Pitcher",
          home_pitch_count: 95,
          current_batter_number: "9",
          current_batter_name: "Old Batter",
          away_current_batter_slot: 9,
          home_current_batter_slot: 8,
          away_pitch_sequence: ["B", "S", "F"],
          home_pitch_sequence: ["S"],
          away_pa_start_pitch_count: 88,
          home_pa_start_pitch_count: 95
        }),
        rosters,
        events: [
          {
            id: "event-1",
            game_code: "TEST001",
            event_type: "BALL",
            created_at: "2026-09-13T12:00:00.000Z"
          }
        ]
      }
    });

    await app.window.startNewGame();

    expect(app.fake.database.tables.live_games[0]).toMatchObject({
      away_team: "VISITORS",
      home_team: "HOSTS",
      away_score: 0,
      home_score: 0,
      inning: 1,
      inning_half: "top",
      balls: 0,
      strikes: 0,
      outs: 0,
      runner_first: false,
      runner_second: false,
      runner_third: false,
      away_pitcher_number: "",
      away_pitcher_name: "",
      away_pitch_count: 0,
      home_pitcher_number: "",
      home_pitcher_name: "",
      home_pitch_count: 0,
      current_batter_number: "",
      current_batter_name: "",
      away_current_batter_slot: 1,
      home_current_batter_slot: 1,
      away_pitch_sequence: [],
      home_pitch_sequence: [],
      away_pa_start_pitch_count: null,
      home_pa_start_pitch_count: null
    });
    expect(app.fake.database.tables.game_events).toEqual([]);
    expect(app.fake.database.tables.game_rosters).toEqual([]);
    expect(app.window.getLineup("away")).toEqual([]);
    expect(app.window.getSubs("away")).toEqual([]);
    expect(app.window.getUsed("away")).toEqual([]);
    expect(app.window.getLineup("home")).toEqual([]);
    expect(app.window.getSubs("home")).toEqual([]);
    expect(app.window.getUsed("home")).toEqual([]);
  });
});
