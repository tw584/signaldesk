export type GateStatus = "pass" | "fail" | "unknown";
export type RevenueModel = "subscription" | "paid_workflow" | "one_time" | "lead_generation" | "advertising";
export type CommercialStage = "signal" | "researching" | "commercial_lead" | "needs_review" | "qualified" | "shortlisted" | "rejected";

export const REQUIRED_COMMERCIAL_GATES = [
  "repeated_pain", "buyer_clarity", "spending_or_wtp", "competitor_pricing", "underserved_wedge",
  "reachable_distribution", "ten_day_build", "revenue_plausibility", "evidence_integrity",
] as const;

export type CommercialGateName = typeof REQUIRED_COMMERCIAL_GATES[number];

export type EvidenceClaim = {
  value: string;
  status: "observed" | "inferred" | "estimate" | "unknown";
  evidenceIds: string[];
  checkedAt: string | null;
};

export type CommercialGate = {
  name: CommercialGateName;
  status: GateStatus;
  reasons: string[];
  evidenceIds: string[];
};

export type CommercialEvidenceRecord = { id: string; status: "observed" | "inferred" | "estimate"; checkedAt: string | null };

export type RevenueScenario = {
  customers: 10 | 50 | 100;
  monthlyRevenueMinor: number;
  mrrMinor: number | null;
  label: "arithmetic_projection";
};

export type RevenuePlan = {
  model: RevenueModel;
  currency: string;
  unitPriceMinor: number;
  billingPeriod: "month" | "year" | "one_time" | "usage";
  scenarios: RevenueScenario[];
  customersForOneThousandMrr: number | null;
  customersForTenThousandMrr: number | null;
  pricingBasisEvidenceIds: string[];
};

export type CommercialDossier = {
  buyer: EvidenceClaim;
  costlyJob: EvidenceClaim;
  currentWorkaroundAndSpend: EvidenceClaim;
  competitorsAndPrices: EvidenceClaim[];
  underservedWedge: EvidenceClaim;
  proposedPaidProduct: EvidenceClaim;
  acquisitionChannel: EvidenceClaim;
  revenue: RevenuePlan | null;
  majorRisks: string[];
  gates: CommercialGate[];
};

const isRecurring = (model: RevenueModel) => model === "subscription" || model === "paid_workflow";

export function buildRevenuePlan(input: { model: RevenueModel; currency?: string; unitPriceMinor: number; billingPeriod: RevenuePlan["billingPeriod"]; pricingBasisEvidenceIds?: string[] }): RevenuePlan {
  if (!Number.isSafeInteger(input.unitPriceMinor) || input.unitPriceMinor <= 0) throw new Error("Price must be a positive integer in minor currency units");
  if (isRecurring(input.model) && input.billingPeriod !== "month" && input.billingPeriod !== "year") throw new Error("Recurring models require monthly or annual billing");
  if (!isRecurring(input.model) && (input.billingPeriod === "month" || input.billingPeriod === "year")) throw new Error("Non-recurring models cannot be labeled with recurring billing");
  const monthlyUnit = input.billingPeriod === "year" ? input.unitPriceMinor / 12 : input.unitPriceMinor;
  const recurring = isRecurring(input.model);
  const scenarios = ([10, 50, 100] as const).map((customers) => ({
    customers,
    monthlyRevenueMinor: Math.round(monthlyUnit * customers),
    mrrMinor: recurring ? Math.round(monthlyUnit * customers) : null,
    label: "arithmetic_projection" as const,
  }));
  return {
    model: input.model,
    currency: input.currency ?? "USD",
    unitPriceMinor: input.unitPriceMinor,
    billingPeriod: input.billingPeriod,
    scenarios,
    customersForOneThousandMrr: recurring ? Math.ceil(100_000 / monthlyUnit) : null,
    customersForTenThousandMrr: recurring ? Math.ceil(1_000_000 / monthlyUnit) : null,
    pricingBasisEvidenceIds: input.pricingBasisEvidenceIds ?? [],
  };
}

export function commercialStage(gates: CommercialGate[], revenue: RevenuePlan | null, evidence: CommercialEvidenceRecord[] = []): CommercialStage {
  const byName = new Map(gates.map((gate) => [gate.name, gate]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const resolvesObserved = (ids: string[]) => ids.length > 0 && ids.every((id) => evidenceById.get(id)?.status === "observed");
  const allPresent = REQUIRED_COMMERCIAL_GATES.every((name) => byName.has(name));
  const allPass = allPresent && REQUIRED_COMMERCIAL_GATES.every((name) => {
    const gate = byName.get(name);
    return gate?.status === "pass" && resolvesObserved(gate.evidenceIds);
  });
  const pricingProven = revenue ? resolvesObserved(revenue.pricingBasisEvidenceIds) : false;
  if (allPass && revenue && pricingProven && isRecurring(revenue.model)) return "needs_review";
  const researched = gates.some((gate) => gate.status !== "unknown");
  if (!researched) return "signal";
  const hasMoneyEvidence = byName.get("buyer_clarity")?.status === "pass" && byName.get("spending_or_wtp")?.status === "pass";
  return hasMoneyEvidence ? "commercial_lead" : "researching";
}

export function missingCommercialGates(gates: CommercialGate[]) {
  const byName = new Map(gates.map((gate) => [gate.name, gate]));
  return REQUIRED_COMMERCIAL_GATES.filter((name) => byName.get(name)?.status !== "pass" || !byName.get(name)?.evidenceIds.length);
}
