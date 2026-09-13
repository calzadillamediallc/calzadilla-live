import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const hasIntegrationEnvironment = Boolean(
  process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_ANON_KEY
);

describe.skipIf(!hasIntegrationEnvironment)("Supabase test-project contract", () => {
  it("exposes the Phase 2 live-game continuity fields", async () => {
    expect(process.env.SUPABASE_TEST_URL).toMatch(/^https?:\/\//);
    expect(process.env.SUPABASE_TEST_ANON_KEY).toBeTruthy();

    const client = createClient(
      process.env.SUPABASE_TEST_URL,
      process.env.SUPABASE_TEST_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { data, error } = await client
      .from("live_games")
      .select(
        [
          "away_current_batter_slot",
          "home_current_batter_slot",
          "away_pitch_sequence",
          "home_pitch_sequence",
          "away_pa_start_pitch_count",
          "home_pa_start_pitch_count"
        ].join(",")
      )
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });
});
