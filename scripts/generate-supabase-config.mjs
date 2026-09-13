import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const STAGING_SUPABASE_HOST = "awlwuzvcmdgevthoecav.supabase.co";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const environmentPath = resolve(repositoryRoot, ".env");
const outputPath = resolve(
  repositoryRoot,
  "config/supabase.staging.generated.js"
);

function loadEnvironmentFile(path) {
  if (!existsSync(path)) return;

  for (const sourceLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, name, sourceValue] = match;
    if (process.env[name] !== undefined) continue;

    let value = sourceValue.trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    process.env[name] = value;
  }
}

loadEnvironmentFile(environmentPath);

const url = String(process.env.SUPABASE_TEST_URL || "").trim();
const anonKey = String(process.env.SUPABASE_TEST_ANON_KEY || "").trim();

if (!url || !anonKey) {
  throw new Error(
    "Set SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY in .env before generating staging configuration."
  );
}

const parsedUrl = new URL(url);
if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== STAGING_SUPABASE_HOST) {
  throw new Error(
    `Refusing to generate configuration for anything other than https://${STAGING_SUPABASE_HOST}.`
  );
}

const generatedSource = `// Generated from local environment variables. Do not commit this file.\nwindow.CALZADILLA_STAGING_SUPABASE_CONFIG = Object.freeze(${JSON.stringify(
  { url, anonKey },
  null,
  2
)});\n`;

writeFileSync(outputPath, generatedSource, { mode: 0o600 });
console.log(`Generated gitignored staging configuration for ${parsedUrl.hostname}.`);
