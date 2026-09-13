import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const STAGING_SUPABASE_HOST = "awlwuzvcmdgevthoecav.supabase.co";
const testUrl = process.env.SUPABASE_TEST_URL || "";
const testAnonKey = process.env.SUPABASE_TEST_ANON_KEY || "";
const hasAnyIntegrationEnvironment = Boolean(testUrl || testAnonKey);
const hasIntegrationEnvironment = Boolean(
  testUrl && testAnonKey
);

if (hasAnyIntegrationEnvironment && !hasIntegrationEnvironment) {
  throw new Error(
    "Set both SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY for staging tests."
  );
}

if (
  hasIntegrationEnvironment &&
  new URL(testUrl).hostname !== STAGING_SUPABASE_HOST
) {
  throw new Error(
    `Refusing to run Supabase tests outside ${STAGING_SUPABASE_HOST}.`
  );
}

describe.skipIf(!hasIntegrationEnvironment)("Supabase test-project contract", () => {
  it("exposes the Phase 2 live-game continuity fields", async () => {
    expect(testUrl).toMatch(/^https:\/\//);
    expect(testAnonKey).toBeTruthy();

    const client = createClient(
      testUrl,
      testAnonKey,
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
