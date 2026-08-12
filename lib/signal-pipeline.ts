export type Evidence = {
  source: string; title: string; originalText: string; author: string; publishedAt: string;
  engagement: number; rating?: number; url: string;
};

export type Signal = Evidence & { timestamp: number; clusterHint?: string };

const stopwords = new Set(["that", "this", "with", "from", "have", "there", "would", "could", "should", "about", "your", "when", "what", "which", "their", "they", "them", "just", "into", "some", "more", "very", "been", "were", "will", "app", "feature", "request"]);

export function clean(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return Math.abs(hash) + 1000;
}

function clusterIdentity(evidence: Signal[]) {
  const hints = Array.from(new Set(evidence.map((item) => item.clusterHint).filter((hint): hint is string => Boolean(hint))));
  if (hints.length === 1) return `hint:${hints[0]}`;
  const anchor = [...evidence].sort((left, right) => left.timestamp - right.timestamp || left.url.localeCompare(right.url))[0];
  return `anchor:${anchor.timestamp}:${anchor.url}`;
}

function publicEvidence(signal: Signal): Evidence {
  return { source: signal.source, title: signal.title, originalText: signal.originalText, author: signal.author, publishedAt: signal.publishedAt, engagement: signal.engagement, rating: signal.rating, url: signal.url };
}

function tokens(value: string) {
  return Array.from(new Set(clean(value).toLowerCase().match(/[a-z][a-z0-9]{3,}/g)?.filter((word) => !stopwords.has(word)) ?? [])).slice(0, 18);
}

export function complaintTopic(value: string) {
  const text = value.toLowerCase();
  const topics: Array<[string, RegExp]> = [
    ["sync", /sync|across device|icloud/], ["offline", /offline|without (an )?internet|no connection/],
    ["pricing", /subscription|price|paywall|too expensive|credits|tokens/], ["reliability", /crash|glitch|freeze|deleted|disappear|lost/],
    ["usability", /confus|difficult to use|not intuitive|usability|too complicated/], ["notifications", /notification|reminder|alert/],
    ["calendar", /calendar|schedule|time block/], ["ai", /\bai\b|agent/], ["export", /export|backup|download my/],
  ];
  return topics.find(([, pattern]) => pattern.test(text))?.[0] ?? tokens(value).slice(0, 3).sort().join("-");
}

export function signalSimilarity(a: Signal, b: Signal) {
  if (a.clusterHint && a.clusterHint === b.clusterHint) return 0.72;
  const left = new Set(tokens(`${a.title} ${a.originalText.slice(0, 260)}`));
  const right = new Set(tokens(`${b.title} ${b.originalText.slice(0, 260)}`));
  const overlap = [...left].filter((word) => right.has(word)).length;
  return overlap / Math.max(1, left.size + right.size - overlap);
}

function infer(text: string) {
  const value = text.toLowerCase();
  if (/developer|github|code|api|documentation/.test(value)) return { audience: "Developers", category: "Developer tools" };
  if (/parent|child|school|family/.test(value)) return { audience: "Parents", category: "Family" };
  if (/freelance|client|invoice|business/.test(value)) return { audience: "Small business", category: "Business ops" };
  if (/health|medical|doctor|patient/.test(value)) return { audience: "Patients", category: "Health admin" };
  if (/team|work|meeting|employee/.test(value)) return { audience: "Small teams", category: "Work" };
  return { audience: "Consumers", category: "Productivity" };
}

export function demandStrength(signal: Signal) {
  const value = `${signal.title} ${signal.originalText}`.toLowerCase();
  let result = 0;
  if (/(wish there|looking for|is there (an|a)|need (an|a)|someone should)/.test(value)) result += 20;
  if (/(frustrat|annoy|hate|difficult|waste|struggl|manual|can't|cannot|missing)/.test(value)) result += 16;
  if (/(workaround|spreadsheet|copy and paste|every day|constantly|again and again)/.test(value)) result += 9;
  if (signal.rating && signal.rating <= 2) result += 12;
  return result;
}

export function feasibilityFor(signal: Signal) {
  const topic = complaintTopic(`${signal.title} ${signal.originalText}`);
  if (topic === "offline") return { verdict: "Feasible", estimatedDays: 8, screens: ["Capture", "Local library", "Search", "Export"], integrations: ["Browser IndexedDB", "PWA cache"], risks: ["Import compatibility", "Device-only data recovery"] };
  if (topic === "notifications") return { verdict: "Feasible", estimatedDays: 7, screens: ["Reminder setup", "Today", "History"], integrations: ["Web Notifications"], risks: ["iOS notification permission"] };
  if (topic === "export") return { verdict: "Feasible", estimatedDays: 6, screens: ["Import", "Record list", "Export builder"], integrations: ["CSV and JSON export"], risks: ["Source-specific import formats"] };
  if (topic === "calendar") return { verdict: "Conditional", estimatedDays: 11, screens: ["Inbox", "Calendar", "Rules", "Conflict review"], integrations: ["Google Calendar OAuth"], risks: ["OAuth review", "Recurring-event edge cases"] };
  if (topic === "sync") return { verdict: "Too large", estimatedDays: 14, screens: ["Account connection", "Field mapping", "Conflict resolution", "Sync health"], integrations: ["Third-party sync API"], risks: ["Two-way conflict resolution", "API limitations"] };
  if (topic === "pricing") return { verdict: "Unverified", estimatedDays: 0, screens: [], integrations: [], risks: ["A cheaper clone is not a differentiated product"] };
  return { verdict: "Unverified", estimatedDays: 0, screens: [], integrations: [], risks: ["Concern is too broad to define a ten-day MVP"] };
}

export function deduplicateSignals(signals: Signal[]) {
  return Array.from(new Map(signals.map((item) => [`${item.source}:${item.url}:${item.author}:${item.originalText}`, item])).values());
}

export function clusterSignals(signals: Signal[]) {
  const clusters: Signal[][] = [];
  for (const signal of [...signals].sort((a, b) => demandStrength(b) - demandStrength(a))) {
    const match = clusters.find((cluster) => cluster.some((member) => signalSimilarity(member, signal) >= 0.34));
    if (match) match.push(signal); else clusters.push([signal]);
  }
  return clusters;
}

export function processSignals(collected: Signal[]) {
  const uniqueSignals = deduplicateSignals(collected);
  const eligibleSignals = uniqueSignals.filter((item) => item.title && item.url && item.originalText).filter((item) => demandStrength(item) >= 16);
  const clusters = clusterSignals(eligibleSignals);
  const allCandidates = clusters.map((evidence) => {
    const sources = new Set(evidence.map((item) => item.source));
    const verifiedPeople = evidence.filter((item) => !/^(unknown|app store user)$/i.test(item.author.trim()));
    const uniquePeople = new Set(verifiedPeople.map((item) => `${item.source}:${item.author.trim().toLowerCase()}`)).size;
    const complaintCluster = verifiedPeople.filter((item) => item.source === "App Store" && (item.rating ?? 5) <= 3).length;
    const lead = [...evidence].sort((a, b) => demandStrength(b) - demandStrength(a))[0];
    const corroborated = uniquePeople >= 5 && (sources.size >= 2 || complaintCluster >= 5);
    const feasibility = feasibilityFor(lead);
    const qualified = corroborated && feasibility.verdict === "Feasible" && feasibility.estimatedDays <= 10;
    const inferred = infer(evidence.map((item) => `${item.title} ${item.originalText}`).join(" "));
    const engagement = evidence.reduce((sum, item) => sum + Math.max(0, item.engagement), 0);
    const frequencyScore = Math.min(32, uniquePeople * 5 + sources.size * 4);
    const opportunity = Math.min(94, 28 + Math.min(25, demandStrength(lead)) + frequencyScore + Math.min(9, Math.round(Math.log2(engagement + 1) * 2)));
    return {
      id: stableId(clusterIdentity(evidence)), title: lead.title.slice(0, 96), problem: lead.originalText.slice(0, 240), ...inferred,
      source: lead.source, sourceUrl: lead.url, score: qualified ? opportunity : Math.min(opportunity, 79), confidence: qualified ? "High" : corroborated ? "Medium" : "Early",
      evidenceCount: evidence.length, uniquePeople, sourceCount: sources.size, signalType: lead.source === "App Store" ? "complaint" : "idea", evidence: evidence.slice(0, 8).map(publicEvidence),
      effort: feasibility.estimatedDays ? `${feasibility.estimatedDays} developer-days` : "Needs feasibility review", monetization: "Needs user validation", status: qualified ? "review" : "early", feasibility, createdAt: "Just now",
    };
  }).sort((a, b) => b.score - a.score);
  const earlyIdeas = allCandidates.filter((item) => item.status === "early" && item.signalType === "idea").slice(0, 20);
  const earlyComplaints = allCandidates.filter((item) => item.status === "early" && item.signalType === "complaint").slice(0, 20);
  const reviewCandidates = allCandidates.filter((item) => item.status === "review").slice(0, 20);
  return { candidates: [...earlyIdeas, ...earlyComplaints, ...reviewCandidates], uniqueSignals, eligibleSignals, clusters, earlyIdeas, earlyComplaints };
}
