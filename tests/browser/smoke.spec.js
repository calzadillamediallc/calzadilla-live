import { expect, test } from "@playwright/test";

async function installIsolatedSupabase(page) {
  await page.route("https://cdn.jsdelivr.net/**", route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: ""
    })
  );

  await page.addInitScript(() => {
    window.CALZADILLA_STAGING_SUPABASE_CONFIG = Object.freeze({
      url: "https://browser-test.invalid",
      anonKey: "browser-test-anon-key"
    });

    const tables = {
      live_games: [
        {
          id: "browser-game",
          game_code: "TEST001",
          away_team: "VISITORS",
          home_team: "HOSTS",
          away_score: 3,
          home_score: 5,
          inning: 6,
          inning_half: "bottom",
          balls: 2,
          strikes: 1,
          outs: 2,
          runner_first: true,
          runner_second: false,
          runner_third: true,
          away_pitcher_number: "18",
          away_pitcher_name: "Away Pitcher",
          away_pitch_count: 42,
          home_pitcher_number: "31",
          home_pitcher_name: "Home Pitcher",
          home_pitch_count: 67,
          away_current_batter_slot: 1,
          home_current_batter_slot: 1,
          away_pitch_sequence: [],
          home_pitch_sequence: [],
          away_pa_start_pitch_count: null,
          home_pa_start_pitch_count: null
        }
      ],
      game_rosters: [],
      game_events: []
    };

    window.__testTables = tables;
    let idCounter = 0;

    function query(tableName) {
      const filters = [];
      let limit = null;
      let operation = "select";
      let payload = null;

      const builder = {
        select() {
          return this;
        },
        insert(value) {
          operation = "insert";
          payload = value;
          return this;
        },
        update(value) {
          operation = "update";
          payload = value;
          return this;
        },
        delete() {
          operation = "delete";
          return this;
        },
        eq(field, value) {
          filters.push({ field, value });
          return this;
        },
        order() {
          return this;
        },
        limit(value) {
          limit = value;
          return this;
        },
        single() {
          const rows = execute();
          return Promise.resolve({ data: rows[0] || null, error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: execute(), error: null }).then(resolve, reject);
        }
      };

      function matchingRows() {
        return tables[tableName].filter(row =>
          filters.every(filter => String(row[filter.field]) === String(filter.value))
        );
      }

      function execute() {
        let rows = matchingRows();

        if (operation === "insert") {
          const incoming = Array.isArray(payload) ? payload : [payload];
          rows = incoming.map(value => {
            idCounter += 1;
            const row = {
              id: value.id || `browser-row-${idCounter}`,
              created_at: value.created_at || new Date().toISOString(),
              ...structuredClone(value)
            };
            tables[tableName].push(row);
            return row;
          });
        }

        if (operation === "update") {
          rows.forEach(row => Object.assign(row, structuredClone(payload)));
        }

        if (operation === "delete") {
          tables[tableName] = tables[tableName].filter(row => !rows.includes(row));
        }

        if (limit != null) rows = rows.slice(0, limit);
        return structuredClone(rows);
      }

      return builder;
    }

    window.supabase = {
      createClient() {
        return {
          from: query,
          channel() {
            return {
              on() {
                return this;
              },
              subscribe() {
                return this;
              }
            };
          }
        };
      }
    };
  });
}

test.beforeEach(async ({ page }) => {
  await installIsolatedSupabase(page);
});

test("control center renders isolated game state without production Supabase", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/index.html");

  await expect.poll(() =>
    page.evaluate(() => window.CALZADILLA_SUPABASE_ENVIRONMENT)
  ).toBe("staging");
  await expect(page.locator("#connectionStatus")).toContainText("Supabase Connected");
  await expect(page.locator("#awayName")).toHaveText("VISITORS");
  await expect(page.locator("#homeName")).toHaveText("HOSTS");
  await expect(page.locator("#awayScore")).toHaveText("3");
  await expect(page.locator("#homeScore")).toHaveText("5");
  await expect(page.locator("#inningDisplay")).toHaveText("BOTTOM 6");
  await expect(page.locator("#balls")).toHaveText("2");
  await expect(page.locator("#strikes")).toHaveText("1");
  await expect(page.locator("#outs")).toHaveText("2");
  await expect(page.locator("#baseFirst")).toHaveClass(/active/);
  await expect(page.locator("#baseThird")).toHaveClass(/active/);
  await expect(page.locator("#awayPitchCount")).toHaveText("42");
  await expect(page.locator("#homePitchCount")).toHaveText("67");
  expect(errors).toEqual([]);
});

test("broadcast overlay renders isolated game state and assets", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/overlay.html");

  await expect.poll(() =>
    page.evaluate(() => window.CALZADILLA_SUPABASE_ENVIRONMENT)
  ).toBe("staging");
  await expect(page.locator("#awayName")).toHaveText("VISITORS");
  await expect(page.locator("#homeName")).toHaveText("HOSTS");
  await expect(page.locator("#awayOnes")).toHaveText("3");
  await expect(page.locator("#homeOnes")).toHaveText("5");
  await expect(page.locator("#half")).toHaveText("BOT");
  await expect(page.locator("#inning")).toHaveText("6");
  await expect(page.locator("#count")).toHaveText("2-1");
  await expect(page.locator("#out1")).toBeVisible();
  await expect(page.locator("#out2")).toBeVisible();
  await expect(page.locator("#runnerFirst")).toBeVisible();
  await expect(page.locator("#runnerSecond")).toBeHidden();
  await expect(page.locator("#runnerThird")).toBeVisible();
  await expect(page.locator("#scoreboardArt")).toHaveJSProperty("complete", true);
  expect(errors).toEqual([]);
});

test("control center rejects a rapid duplicate pitch action", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/index.html");
  await expect(page.locator("#connectionStatus")).toContainText("Supabase Connected");

  await page.evaluate(() => Promise.all([window.ball(), window.ball()]));

  await expect(page.locator("#balls")).toHaveText("3");
  await expect(page.locator("#awayPitchCount")).toHaveText("43");

  const ballEvents = await page.evaluate(() =>
    window.__testTables.game_events.filter(event => event.event_type === "BALL")
  );
  expect(ballEvents).toHaveLength(1);
  expect(errors).toEqual([]);
});
