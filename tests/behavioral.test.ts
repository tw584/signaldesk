import assert from "node:assert/strict";
import test from "node:test";
import { applyDecisions, reconcileCandidates, type CandidateStatus } from "../lib/decision-reconciliation.ts";
import { summarizeSourceResults } from "../lib/source-results.ts";
import { clusterSignals, deduplicateSignals, feasibilityFor, processSignals, type Signal } from "../lib/signal-pipeline.ts";
import { buildRevenuePlan, commercialStage, missingCommercialGates, REQUIRED_COMMERCIAL_GATES, type CommercialEvidenceRecord, type CommercialGate } from "../lib/commercial-opportunity.ts";

type Candidate = { id: number; status: CandidateStatus; score: number; title: string };
const candidate = (id: number, status: CandidateStatus, score = id): Candidate => ({ id, status, score, title: `Candidate ${id}` });
const signal = (overrides: Partial<Signal> = {}): Signal => ({
  source: "Reddit", title: "I need an offline notes app", originalText: "I am frustrated that my notes cannot work offline every day", author: "user-1",
  publishedAt: "2026-08-12T00:00:00Z", engagement: 4, url: "https://example.com/1", timestamp: 1, ...overrides,
});

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

test("deduplication removes repeated captures without mutating the input", () => {
  const first = signal();
  const input = [first, { ...first }, signal({ author: "user-2", url: "https://example.com/2" })];
  const result = deduplicateSignals(input);
  assert.equal(result.length, 2);
  assert.equal(input.length, 3);
});

test("cluster hints group the same app complaint while unrelated concerns remain separate", () => {
  const offlineA = signal({ clusterHint: "app:1:offline" });
  const offlineB = signal({ author: "user-2", url: "https://example.com/2", clusterHint: "app:1:offline" });
  const calendar = signal({ title: "Calendar scheduling request", originalText: "I need a calendar schedule conflict checker", author: "user-3", url: "https://example.com/3" });
  const clusters = clusterSignals([calendar, offlineB, offlineA]);
  assert.equal(clusters.length, 2);
  assert.equal(clusters.find((items) => items.includes(offlineA))?.length, 2);
});

test("unknown authors do not satisfy the independent-person gate", () => {
  const collected = Array.from({ length: 5 }, (_, index) => signal({ source: index ? "App Store" : "Reddit", author: index ? "App Store user" : "Unknown", url: `https://example.com/${index}`, clusterHint: "shared:offline", rating: 1 }));
  const result = processSignals(collected);
  assert.equal(result.candidates[0].uniquePeople, 0);
  assert.equal(result.candidates[0].status, "early");
});

test("five verified voices across sources qualify only a feasible ten-day concern", () => {
  const feasible = Array.from({ length: 5 }, (_, index) => signal({ source: index === 0 ? "Reddit" : "App Store", author: `person-${index}`, url: `https://example.com/${index}`, clusterHint: "shared:offline", rating: index ? 1 : undefined }));
  const feasibleResult = processSignals(feasible).candidates[0];
  assert.equal(feasibleResult.status, "early");
  assert.equal(feasibleResult.demandQualified, true);
  assert.equal(feasibleResult.commercialStage, "signal");
  assert.equal(feasibleResult.feasibility.verdict, "Feasible");

  const tooLarge = feasible.map((item, index) => signal({ ...item, title: "I need sync across devices", originalText: "I am frustrated that sync across devices is missing", clusterHint: "shared:sync", url: `https://sync.example/${index}` }));
  const tooLargeResult = processSignals(tooLarge).candidates[0];
  assert.equal(tooLargeResult.status, "early");
  assert.equal(tooLargeResult.score <= 79, true);
  assert.equal(feasibilityFor(tooLarge[0]).estimatedDays > 10, true);
});

test("candidate identity survives evidence reorder and a stronger lead", () => {
  const evidence = Array.from({ length: 5 }, (_, index) => signal({ source: index ? "App Store" : "Reddit", author: `person-${index}`, url: `https://example.com/${index}`, clusterHint: "shared:offline", rating: index ? 1 : undefined, engagement: index }));
  const first = processSignals(evidence).candidates[0];
  const reordered = processSignals([{ ...evidence[4], engagement: 500 }, ...evidence.slice(0, 4).reverse()]).candidates[0];
  assert.equal(first.id, reordered.id);
});

test("unhinted candidate identity survives reorder and newer corroboration", () => {
  const anchor = signal({ timestamp: 1, url: "https://example.com/anchor" });
  const peer = signal({ timestamp: 2, url: "https://example.com/peer", author: "peer", engagement: 50 });
  const first = processSignals([anchor, peer]).candidates[0];
  const withNewEvidence = processSignals([signal({ timestamp: 3, url: "https://example.com/new", author: "new", engagement: 500 }), peer, anchor]).candidates[0];
  assert.equal(first.id, withNewEvidence.id);
});

test("separate same-topic clusters receive distinct candidate identities", () => {
  const first = signal({ timestamp: 1, url: "https://example.com/first", title: "Wish there was offline piano storage", originalText: "Sheet music disappears without an internet connection" });
  const second = signal({ timestamp: 2, url: "https://example.com/second", title: "Manual subway route cache", originalText: "Transit navigation is frustrating when maps cannot work offline" });
  const result = processSignals([first, second]);
  assert.equal(result.candidates.length, 2);
  assert.notEqual(result.candidates[0].id, result.candidates[1].id);
});

test("negative engagement cannot produce a non-finite score", () => {
  const result = processSignals([signal({ engagement: -100 })]).candidates[0];
  assert.equal(Number.isFinite(result.score), true);
});

const commercialGates = (status: CommercialGate["status"]): CommercialGate[] => REQUIRED_COMMERCIAL_GATES.map((name) => ({ name, status, reasons: [], evidenceIds: status === "pass" ? [`evidence:${name}`] : [] }));
const observedCommercialEvidence: CommercialEvidenceRecord[] = [...REQUIRED_COMMERCIAL_GATES.map((name) => ({ id: `evidence:${name}`, status: "observed" as const, checkedAt: "2026-08-12" })), { id: "pricing:1", status: "observed", checkedAt: "2026-08-12" }];

test("commercial qualification fails closed when evidence is missing", () => {
  const gates = commercialGates("pass").filter((gate) => gate.name !== "competitor_pricing");
  const revenue = buildRevenuePlan({ model: "subscription", unitPriceMinor: 2_000, billingPeriod: "month", pricingBasisEvidenceIds: ["pricing:1"] });
  assert.equal(commercialStage(gates, revenue, observedCommercialEvidence), "commercial_lead");
  assert.deepEqual(missingCommercialGates(gates), ["competitor_pricing"]);
});

test("all commercial gates lead to human review, never automatic qualification", () => {
  const revenue = buildRevenuePlan({ model: "subscription", unitPriceMinor: 2_000, billingPeriod: "month", pricingBasisEvidenceIds: ["pricing:1"] });
  assert.equal(commercialStage(commercialGates("pass"), revenue, observedCommercialEvidence), "needs_review");
});

test("pass labels without evidence cannot enter commercial review", () => {
  const gates = commercialGates("pass").map((gate) => ({ ...gate, evidenceIds: [] }));
  const revenue = buildRevenuePlan({ model: "subscription", unitPriceMinor: 2_000, billingPeriod: "month", pricingBasisEvidenceIds: ["pricing:1"] });
  assert.notEqual(commercialStage(gates, revenue), "needs_review");
});

test("unresolved or inferred evidence cannot enter commercial review", () => {
  const revenue = buildRevenuePlan({ model: "subscription", unitPriceMinor: 2_000, billingPeriod: "month", pricingBasisEvidenceIds: ["pricing:1"] });
  assert.notEqual(commercialStage(commercialGates("pass"), revenue, []), "needs_review");
  const inferred = observedCommercialEvidence.map((item) => ({ ...item, status: "inferred" as const }));
  assert.notEqual(commercialStage(commercialGates("pass"), revenue, inferred), "needs_review");
});

test("invalid prices and billing combinations fail closed", () => {
  assert.throws(() => buildRevenuePlan({ model: "subscription", unitPriceMinor: 0, billingPeriod: "month" }));
  assert.throws(() => buildRevenuePlan({ model: "subscription", unitPriceMinor: 2_000, billingPeriod: "one_time" }));
  assert.throws(() => buildRevenuePlan({ model: "one_time", unitPriceMinor: 2_000, billingPeriod: "month" }));
});

test("one-time revenue is not mislabeled as MRR", () => {
  const revenue = buildRevenuePlan({ model: "one_time", unitPriceMinor: 5_000, billingPeriod: "one_time" });
  assert.deepEqual(revenue.scenarios.map((item) => item.monthlyRevenueMinor), [50_000, 250_000, 500_000]);
  assert.equal(revenue.scenarios.every((item) => item.mrrMinor === null), true);
  assert.equal(revenue.customersForOneThousandMrr, null);
  assert.equal(commercialStage(commercialGates("pass"), revenue, observedCommercialEvidence), "commercial_lead");
});

test("subscription scenarios transparently calculate 10, 50, and 100 customers", () => {
  const revenue = buildRevenuePlan({ model: "subscription", unitPriceMinor: 2_500, billingPeriod: "month" });
  assert.deepEqual(revenue.scenarios.map((item) => item.mrrMinor), [25_000, 125_000, 250_000]);
  assert.equal(revenue.customersForOneThousandMrr, 40);
  assert.equal(revenue.customersForTenThousandMrr, 400);
});
