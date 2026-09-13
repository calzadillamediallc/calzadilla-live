import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

function readEnvironmentFile(path) {
  if (!existsSync(path)) return {};

  const values = {};

  for (const sourceLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, name, sourceValue] = match;
    let value = sourceValue.trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    values[name] = value;
  }

  return values;
}

export default defineConfig(({ mode }) => {
  const fileEnvironment = {
    ...readEnvironmentFile(resolve(process.cwd(), ".env")),
    ...readEnvironmentFile(resolve(process.cwd(), `.env.${mode}`))
  };

  return {
    test: {
      environment: "node",
      include: ["tests/{unit,known-bugs,integration}/**/*.test.js"],
      testTimeout: 10_000,
      hookTimeout: 10_000,
      reporters: ["default"],
      env: {
        SUPABASE_TEST_URL:
          process.env.SUPABASE_TEST_URL ||
          fileEnvironment.SUPABASE_TEST_URL ||
          "",
        SUPABASE_TEST_ANON_KEY:
          process.env.SUPABASE_TEST_ANON_KEY ||
          fileEnvironment.SUPABASE_TEST_ANON_KEY ||
          ""
      }
    }
  };
});
