import assert from "node:assert/strict";
import test from "node:test";
import { applyDecisions, reconcileCandidates, type CandidateStatus } from "../lib/decision-reconciliation.ts";
import { summarizeSourceResults } from "../lib/source-results.ts";

type Candidate = { id: number; status: CandidateStatus; score: number; title: string };
const candidate = (id: number, status: CandidateStatus, score = id): Candidate => ({ id, status, score, title: `Candidate ${id}` });

test("saved decisions override fresh qualification without mutating inputs", () => {
  const fresh = [candidate(1, "review", 90), candidate(2, "early", 70)];
  const result = applyDecisions(fresh, { 1: "shortlisted", 2: "rejected" });
  assert.deepEqual(result.map((item) => item.status), ["shortlisted", "rejected"]);
  assert.deepEqual(fresh.map((item) => item.status), ["review", "early"]);
});

test("refresh keeps stale reviewed decisions but not stale unreviewed candidates", () => {
  const fresh = [candidate(1, "review", 80), candidate(3, "early", 60)];
  const existing = [candidate(1, "shortlisted", 75), candidate(2, "rejected", 95), candidate(4, "early", 99)];
  const result = reconcileCandidates(fresh, existing, { 1: "shortlisted", 2: "rejected" });
  assert.deepEqual(result.map((item) => item.id), [2, 1, 3]);
  assert.equal(new Set(result.map((item) => item.id)).size, result.length);
});

test("source summary preserves partial successes and reports failures honestly", () => {
  const results: PromiseSettledResult<number[]>[] = [
    { status: "fulfilled", value: [1, 2] },
    { status: "rejected", reason: new Error("rate limited") },
    { status: "fulfilled", value: [] },
  ];
  const summary = summarizeSourceResults(["A", "B", "C"], results);
  assert.deepEqual(summary.collected, [1, 2]);
  assert.deepEqual(summary.sourceStatus, [
    { source: "A", status: "ok", count: 2 },
    { source: "B", status: "failed", count: 0, error: "rate limited" },
    { source: "C", status: "ok", count: 0 },
  ]);
  assert.equal(summary.sourcesOk, 2);
  assert.equal(summary.sourcesTotal, 3);
});

test("non-Error source rejection receives a stable public error", () => {
  const summary = summarizeSourceResults(["A"], [{ status: "rejected", reason: "private upstream detail" }]);
  assert.equal(summary.sourceStatus[0].error, "Collection failed");
});
