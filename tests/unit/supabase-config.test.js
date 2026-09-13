import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const productionSource = readFileSync(
  new URL("../../config/supabase.production.js", import.meta.url),
  "utf8"
);
const environmentSource = readFileSync(
  new URL("../../config/supabase.environment.js", import.meta.url),
  "utf8"
);
const resolverSource = readFileSync(
  new URL("../../config/supabase.resolve.js", import.meta.url),
  "utf8"
);

function createContext({ protocol, hostname, search = "", stagingConfig }) {
  const documentWrites = [];
  const window = {
    location: { protocol, hostname, search }
  };

  if (stagingConfig) {
    window.CALZADILLA_STAGING_SUPABASE_CONFIG = Object.freeze(stagingConfig);
  }

  return {
    context: {
      document: {
        write(value) {
          documentWrites.push(String(value));
        }
      },
      URLSearchParams,
      window
    },
    documentWrites,
    window
  };
}

function runConfiguration(context) {
  runInNewContext(productionSource, context);
  runInNewContext(environmentSource, context);
  runInNewContext(resolverSource, context);
}

describe("Supabase runtime configuration", () => {
  it("uses the committed production configuration on a deployed host", () => {
    const setup = createContext({
      protocol: "https:",
      hostname: "calzadillamediallc.github.io"
    });

    runConfiguration(setup.context);

    expect(setup.window.CALZADILLA_SUPABASE_ENVIRONMENT).toBe("production");
    expect(setup.window.CALZADILLA_SUPABASE_CONFIG.url).toBe(
      setup.window.CALZADILLA_PRODUCTION_SUPABASE_CONFIG.url
    );
    expect(setup.window.CALZADILLA_SUPABASE_CONFIG.anonKey).toBe(
      setup.window.CALZADILLA_PRODUCTION_SUPABASE_CONFIG.anonKey
    );
    expect(setup.documentWrites).toEqual([]);
  });

  it("uses the generated staging configuration on localhost", () => {
    const setup = createContext({
      protocol: "http:",
      hostname: "127.0.0.1",
      stagingConfig: {
        url: "https://staging-test.invalid",
        anonKey: "staging-test-anon-key"
      }
    });

    runConfiguration(setup.context);

    expect(setup.window.CALZADILLA_SUPABASE_ENVIRONMENT).toBe("staging");
    expect(setup.window.CALZADILLA_SUPABASE_CONFIG.url).toBe(
      "https://staging-test.invalid"
    );
    expect(setup.documentWrites).toEqual([]);
  });

  it("does not fall back to production when local staging config is missing", () => {
    const setup = createContext({
      protocol: "http:",
      hostname: "localhost"
    });

    runInNewContext(productionSource, setup.context);
    runInNewContext(environmentSource, setup.context);

    expect(setup.documentWrites).toEqual([
      '<script src="config/supabase.staging.generated.js"></script>'
    ]);
    expect(() => runInNewContext(resolverSource, setup.context)).toThrow(
      "Missing generated staging Supabase configuration"
    );
  });
});
