import { spawnSync } from "node:child_process";

const commands = [
  ["node_modules/vitest/vitest.mjs", "run"],
  ["node_modules/@playwright/test/cli.js", "test"]
];

let failed = false;

for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;

