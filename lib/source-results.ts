export type SourceStatus = { source: string; status: "ok" | "failed"; count: number; error?: string };

export function summarizeSourceResults<T>(sourceNames: readonly string[], results: PromiseSettledResult<T[]>[]) {
  const collected = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const sourceStatus: SourceStatus[] = sourceNames.map((source, index) => {
    const result = results[index];
    if (!result || result.status === "rejected") {
      const reason = result?.status === "rejected" ? result.reason : undefined;
      return { source, status: "failed", count: 0, error: reason instanceof Error ? reason.message : "Collection failed" };
    }
    return { source, status: "ok", count: result.value.length };
  });
  return {
    collected,
    sourceStatus,
    sourcesOk: sourceStatus.filter((item) => item.status === "ok").length,
    sourcesTotal: sourceStatus.length,
  };
}
