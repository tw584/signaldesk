import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps separate twenty-item idea and complaint queues", async () => {
  const [page, refresh] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/api/refresh/route.ts", root), "utf8"),
  ]);

  assert.match(page, />IDEAS</);
  assert.match(page, />COMPLAINTS</);
  assert.match(page, /signalType === "idea"/);
  assert.match(page, /signalType === "complaint"/);
  assert.match(refresh, /earlyIdeas[\s\S]*slice\(0, 20\)/);
  assert.match(refresh, /earlyComplaints[\s\S]*slice\(0, 20\)/);
});

test("preserves original evidence and repeated-person qualification", async () => {
  const refresh = await readFile(new URL("app/api/refresh/route.ts", root), "utf8");

  for (const field of ["originalText", "author", "publishedAt", "engagement", "url"]) {
    assert.match(refresh, new RegExp(field));
  }
  assert.match(refresh, /uniquePeople >= 5/);
  assert.match(refresh, /sources\.size >= 2 \|\| complaintCluster >= 5/);
});

test("requires an achievable ten-day MVP before review", async () => {
  const refresh = await readFile(new URL("app/api/refresh/route.ts", root), "utf8");

  assert.match(refresh, /feasibility\.verdict === "Feasible"/);
  assert.match(refresh, /feasibility\.estimatedDays <= 10/);
  assert.match(refresh, /status: qualified \? "review" : "early"/);
});
