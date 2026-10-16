import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("T12 - client/vite.config.js versiona las cachés de Workbox a -v2", () => {
  const configPath = path.resolve("client/vite.config.js");
  const configContent = fs.readFileSync(configPath, "utf-8");

  assert.match(configContent, /cacheId:\s*["']planifica-maestro-v2["']/);
  assert.match(configContent, /cacheName:\s*["']html-cache-v2["']/);
  assert.match(configContent, /cacheName:\s*["']static-resources-v2["']/);
  assert.match(configContent, /cacheName:\s*["']static-assets-v2["']/);

  // Asegurar que no quedan nombres sin versionar a v2
  assert.ok(!configContent.includes('cacheName: "html-cache"'));
  assert.ok(!configContent.includes('cacheName: "static-resources"'));
  assert.ok(!configContent.includes('cacheName: "static-assets"'));
});
