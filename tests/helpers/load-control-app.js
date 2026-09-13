import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createFakeSupabase } from "./fake-supabase.js";

const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const inlineScripts = [...indexHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(script => script.trim());
const productionScript = inlineScripts.at(-1);

if (!productionScript) {
  throw new Error("The production inline script could not be located.");
}

async function flush(window, cycles = 8) {
  for (let index = 0; index < cycles; index += 1) {
    await new Promise(resolve => window.setTimeout(resolve, 0));
  }
}

async function waitFor(window, predicate, message) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await new Promise(resolve => window.setTimeout(resolve, 0));
  }

  throw new Error(message);
}

export async function loadControlApp(options = {}) {
  const fake = options.fake || createFakeSupabase(options.seed);
  const alerts = [];
  const prompts = [...(options.prompts || [])];
  const confirmations = [...(options.confirmations || [])];

  const dom = new JSDOM(indexHtml, {
    url: "http://calzadilla.test/index.html",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });

  const { window } = dom;

  window.CALZADILLA_SUPABASE_CONFIG = Object.freeze({
    url: "https://unit-test.invalid",
    anonKey: "unit-test-anon-key"
  });

  window.supabase = {
    createClient() {
      return fake.client;
    }
  };

  window.alert = message => alerts.push(String(message));
  window.confirm = () => confirmations.shift() ?? true;
  window.prompt = () => prompts.shift() ?? null;

  window.eval(productionScript);

  await waitFor(
    window,
    () => {
      const status = window.document.getElementById("connectionStatus");
      return String(status?.innerText || status?.textContent).includes("LIVE");
    },
    "The control application did not finish its initial load."
  );
  await flush(window);

  return {
    window,
    fake,
    alerts,
    async settle(cycles) {
      await flush(window, cycles);
    },
    async runWithAnswers(action, answers) {
      const result = action();

      for (const answer of answers) {
        if (answer.type === "decision") {
          await waitFor(
            window,
            () => window.document.getElementById("decisionModal").style.display === "flex",
            "Expected a yes/no decision modal."
          );
          window.resolveDecision(answer.value);
        } else if (answer.type === "choice") {
          await waitFor(
            window,
            () => window.document.getElementById("choiceModal").style.display === "flex",
            "Expected a choice modal."
          );

          const buttons = [
            ...window.document.querySelectorAll("#choiceButtons button")
          ];
          const button = buttons[answer.index ?? 0];

          if (!button) throw new Error("Requested choice button does not exist.");
          button.click();
        } else {
          throw new Error(`Unsupported answer type: ${answer.type}`);
        }

        await flush(window, 2);
      }

      await result;
      await flush(window);
    },
    close() {
      window.close();
    }
  };
}
