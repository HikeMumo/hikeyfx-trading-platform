import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("trading page inline JavaScript parses successfully", async () => {
  const html = await readFile(new URL("../../trading/index.html", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/.test(match[1]) && match[2].trim());
  assert.ok(scripts.length > 0, "expected at least one inline trading script");
  for (const [index, match] of scripts.entries()) {
    assert.doesNotThrow(
      () => new vm.Script(match[2], { filename: `trading-inline-${index + 1}.js` }),
      `inline trading script ${index + 1} should parse`
    );
  }
});

test("trading API configuration JavaScript parses successfully", async () => {
  const source = await readFile(new URL("../../trading/api-config.js", import.meta.url), "utf8");
  assert.doesNotThrow(() => new vm.Script(source, { filename: "trading/api-config.js" }));
});
