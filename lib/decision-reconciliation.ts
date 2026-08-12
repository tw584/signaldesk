export type CandidateStatus = "early" | "review" | "shortlisted" | "rejected";

type CandidateLike = { id: number; status: CandidateStatus; score: number };

export function applyDecisions<T extends CandidateLike>(candidates: T[], decisions: Record<number, CandidateStatus>): T[] {
  return candidates.map((candidate) => ({ ...candidate, status: decisions[candidate.id] ?? candidate.status }));
}

export function reconcileCandidates<T extends CandidateLike>(fresh: T[], existing: T[], decisions: Record<number, CandidateStatus>, limit = 60): T[] {
  const resolvedFresh = applyDecisions(fresh, decisions);
  const freshIds = new Set(resolvedFresh.map((candidate) => candidate.id));
  const durableExisting = applyDecisions(existing, decisions).filter((candidate) =>
    !freshIds.has(candidate.id) && (candidate.status === "shortlisted" || candidate.status === "rejected")
  );
  return [...resolvedFresh, ...durableExisting].sort((left, right) => right.score - left.score).slice(0, limit);
}
