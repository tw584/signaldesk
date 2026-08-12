type Evidence = {
  source: string;
  title: string;
  originalText: string;
  author: string;
  publishedAt: string;
  engagement: number;
  rating?: number;
  url: string;
};

type Signal = Evidence & { timestamp: number; clusterHint?: string };

const stopwords = new Set(["that", "this", "with", "from", "have", "there", "would", "could", "should", "about", "your", "when", "what", "which", "their", "they", "them", "just", "into", "some", "more", "very", "been", "were", "will", "app", "feature", "request"]);

function clean(value = "") {
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return Math.abs(hash) + 1000;
}

function tokens(value: string) {
  return Array.from(new Set(clean(value).toLowerCase().match(/[a-z][a-z0-9]{3,}/g)?.filter((word) => !stopwords.has(word)) ?? [])).slice(0, 18);
}

function complaintTopic(value: string) {
  const text = value.toLowerCase();
  const topics: Array<[string, RegExp]> = [
    ["sync", /sync|across device|icloud/], ["offline", /offline|without (an )?internet|no connection/],
    ["pricing", /subscription|price|paywall|too expensive|credits|tokens/], ["reliability", /crash|glitch|freeze|deleted|disappear|lost/],
    ["usability", /confus|difficult to use|not intuitive|usability|too complicated/], ["notifications", /notification|reminder|alert/],
    ["calendar", /calendar|schedule|time block/], ["ai", /\bai\b|agent/], ["export", /export|backup|download my/],
  ];
  return topics.find(([, pattern]) => pattern.test(text))?.[0] ?? tokens(value).slice(0, 3).sort().join("-");
}

function similarity(a: Signal, b: Signal) {
  if (a.clusterHint && a.clusterHint === b.clusterHint) return 0.72;
  const left = new Set(tokens(`${a.title} ${a.originalText.slice(0, 260)}`));
  const right = new Set(tokens(`${b.title} ${b.originalText.slice(0, 260)}`));
  const overlap = [...left].filter((word) => right.has(word)).length;
  return overlap / Math.max(1, Math.min(left.size, right.size));
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

function demandStrength(signal: Signal) {
  const value = `${signal.title} ${signal.originalText}`.toLowerCase();
  let result = 0;
  if (/(wish there|looking for|is there (an|a)|need (an|a)|someone should)/.test(value)) result += 20;
  if (/(frustrat|annoy|hate|difficult|waste|struggl|manual|can't|cannot|missing)/.test(value)) result += 16;
  if (/(workaround|spreadsheet|copy and paste|every day|constantly|again and again)/.test(value)) result += 9;
  if (signal.rating && signal.rating <= 2) result += 12;
  return result;
}

function feasibilityFor(signal: Signal) {
  const topic = complaintTopic(`${signal.title} ${signal.originalText}`);
  if (topic === "offline") return { verdict: "Feasible", estimatedDays: 8, screens: ["Capture", "Local library", "Search", "Export"], integrations: ["Browser IndexedDB", "PWA cache"], risks: ["Import compatibility", "Device-only data recovery"] };
  if (topic === "notifications") return { verdict: "Feasible", estimatedDays: 7, screens: ["Reminder setup", "Today", "History"], integrations: ["Web Notifications"], risks: ["iOS notification permission"] };
  if (topic === "export") return { verdict: "Feasible", estimatedDays: 6, screens: ["Import", "Record list", "Export builder"], integrations: ["CSV and JSON export"], risks: ["Source-specific import formats"] };
  if (topic === "calendar") return { verdict: "Conditional", estimatedDays: 11, screens: ["Inbox", "Calendar", "Rules", "Conflict review"], integrations: ["Google Calendar OAuth"], risks: ["OAuth review", "Recurring-event edge cases"] };
  if (topic === "sync") return { verdict: "Too large", estimatedDays: 14, screens: ["Account connection", "Field mapping", "Conflict resolution", "Sync health"], integrations: ["Third-party sync API"], risks: ["Two-way conflict resolution", "API limitations"] };
  if (topic === "pricing") return { verdict: "Unverified", estimatedDays: 0, screens: [], integrations: [], risks: ["A cheaper clone is not a differentiated product"] };
  return { verdict: "Unverified", estimatedDays: 0, screens: [], integrations: [], risks: ["Concern is too broad to define a ten-day MVP"] };
}

async function hackerNews(): Promise<Signal[]> {
  const queries = ["wish there was", "looking for an app", "manual workflow", "frustrating workflow"];
  const results = await Promise.all(queries.map(async (query) => {
    const response = await fetch(`https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=12&query=${encodeURIComponent(query)}`);
    if (!response.ok) return [];
    const data = await response.json() as { hits: Array<{ title?: string; story_text?: string; url?: string; objectID: string; author?: string; points?: number; num_comments?: number; created_at: string; created_at_i: number }> };
    return data.hits.map((hit) => ({ source: "HN", title: clean(hit.title), originalText: clean(hit.story_text), author: hit.author ?? "Unknown", publishedAt: hit.created_at, engagement: (hit.points ?? 0) + (hit.num_comments ?? 0), url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, timestamp: hit.created_at_i * 1000 }));
  }));
  return results.flat();
}

async function reddit(): Promise<Signal[]> {
  const queries = ["wish there was an app", "looking for an app", "frustrating app", "manual workflow"];
  const results = await Promise.all(queries.map(async (query) => {
    const response = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&t=month&limit=20&raw_json=1`, { headers: { "user-agent": "SignalDesk local opportunity research/0.2" } });
    if (!response.ok) return [];
    const data = await response.json() as { data: { children: Array<{ data: { title: string; selftext?: string; author?: string; permalink: string; score?: number; num_comments?: number; created_utc: number } }> } };
    return data.data.children.map(({ data: item }) => ({ source: "Reddit", title: clean(item.title), originalText: clean(item.selftext), author: item.author ?? "Unknown", publishedAt: new Date(item.created_utc * 1000).toISOString(), engagement: (item.score ?? 0) + (item.num_comments ?? 0), url: `https://www.reddit.com${item.permalink}`, timestamp: item.created_utc * 1000 }));
  }));
  return results.flat();
}

async function github(): Promise<Signal[]> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const response = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(`is:issue is:open created:>=${since} in:title "feature request"`)}&sort=comments&order=desc&per_page=25`, { headers: { accept: "application/vnd.github+json", "user-agent": "SignalDesk-local" } });
  if (!response.ok) return [];
  const data = await response.json() as { items: Array<{ title: string; body?: string; user?: { login?: string }; html_url: string; comments: number; created_at: string }> };
  return data.items.map((item) => ({ source: "GitHub", title: clean(item.title), originalText: clean(item.body), author: item.user?.login ?? "Unknown", publishedAt: item.created_at, engagement: item.comments, url: item.html_url, timestamp: Date.parse(item.created_at) }));
}

async function appStoreComplaints(): Promise<Signal[]> {
  const search = await fetch("https://itunes.apple.com/search?term=productivity%20organizer&country=us&entity=software&limit=12");
  if (!search.ok) return [];
  const apps = await search.json() as { results: Array<{ trackId: number; trackName: string; trackViewUrl: string }> };
  const reviews = await Promise.allSettled(apps.results.map(async (app) => {
    const response = await fetch(`https://itunes.apple.com/us/rss/customerreviews/id=${app.trackId}/sortBy=mostRecent/json`);
    if (!response.ok) return [];
    const data = await response.json() as { feed?: { entry?: Array<Record<string, unknown>> } };
    return (data.feed?.entry ?? []).slice(1).flatMap((raw) => {
      const entry = raw as { title?: { label?: string }; content?: { label?: string }; author?: { name?: { label?: string } }; updated?: { label?: string }; "im:rating"?: { label?: string } };
      const rating = Number(entry["im:rating"]?.label ?? 5);
      if (rating > 3) return [];
      const reviewTitle = clean(entry.title?.label);
      const reviewText = clean(entry.content?.label);
      return [{ source: "App Store", title: `${app.trackName}: ${reviewTitle}`, originalText: reviewText, author: entry.author?.name?.label ?? "App Store user", publishedAt: entry.updated?.label ?? "", engagement: Math.max(1, 6 - rating), rating, url: app.trackViewUrl, timestamp: Date.parse(entry.updated?.label ?? "") || Date.now(), clusterHint: `app:${app.trackId}:${complaintTopic(`${reviewTitle} ${reviewText}`)}` }];
    });
  }));
  return reviews.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

export async function POST() {
  const settled = await Promise.allSettled([hackerNews(), reddit(), github(), appStoreComplaints()]);
  const signals = settled.flatMap((item) => item.status === "fulfilled" ? item.value : [])
    .filter((item) => item.title && item.url && item.originalText)
    .filter((item) => demandStrength(item) >= 16);

  const clusters: Signal[][] = [];
  for (const signal of signals.sort((a, b) => demandStrength(b) - demandStrength(a))) {
    const match = clusters.find((cluster) => similarity(cluster[0], signal) >= 0.34);
    if (match) match.push(signal); else clusters.push([signal]);
  }

  const allCandidates = clusters.map((evidence) => {
    const sources = new Set(evidence.map((item) => item.source));
    const uniquePeople = new Set(evidence.map((item) => `${item.source}:${item.author.toLowerCase()}`)).size;
    const complaintCluster = evidence.filter((item) => item.source === "App Store" && (item.rating ?? 5) <= 3).length;
    const lead = evidence.sort((a, b) => demandStrength(b) - demandStrength(a))[0];
    const corroborated = uniquePeople >= 5 && (sources.size >= 2 || complaintCluster >= 5);
    const feasibility = feasibilityFor(lead);
    const qualified = corroborated && feasibility.verdict === "Feasible" && feasibility.estimatedDays <= 10;
    const inferred = infer(evidence.map((item) => `${item.title} ${item.originalText}`).join(" "));
    const engagement = evidence.reduce((sum, item) => sum + item.engagement, 0);
    const frequencyScore = Math.min(32, uniquePeople * 5 + sources.size * 4);
    const opportunity = Math.min(94, 28 + Math.min(25, demandStrength(lead)) + frequencyScore + Math.min(9, Math.round(Math.log2(engagement + 1) * 2)));
    return {
      // Original identifier preserved for review: id: stableId(lead.url)
      id: stableId(`${lead.url}:${lead.clusterHint ?? lead.title}`), title: lead.title.slice(0, 96),
      problem: lead.originalText.slice(0, 240), ...inferred, source: lead.source, sourceUrl: lead.url,
      score: qualified ? opportunity : Math.min(opportunity, 79), confidence: qualified ? "High" : corroborated ? "Medium" : "Early",
      evidenceCount: evidence.length, uniquePeople, sourceCount: sources.size, signalType: lead.source === "App Store" ? "complaint" : "idea", evidence: evidence.slice(0, 8).map(({ timestamp: _timestamp, clusterHint: _hint, ...item }) => item),
      effort: feasibility.estimatedDays ? `${feasibility.estimatedDays} developer-days` : "Needs feasibility review", monetization: "Needs user validation", status: qualified ? "review" : "early",
      feasibility,
      createdAt: "Just now",
    };
  }).sort((a, b) => b.score - a.score);

  const earlyIdeas = allCandidates.filter((item) => item.status === "early" && item.signalType === "idea").slice(0, 20);
  const earlyComplaints = allCandidates.filter((item) => item.status === "early" && item.signalType === "complaint").slice(0, 20);
  const reviewCandidates = allCandidates.filter((item) => item.status === "review").slice(0, 20);
  const candidates = [...earlyIdeas, ...earlyComplaints, ...reviewCandidates];

  return Response.json({ candidates, quotas: { ideas: earlyIdeas.length, complaints: earlyComplaints.length }, sourceStatus: ["HN", "Reddit", "GitHub", "App Store"].map((source, index) => ({ source, status: settled[index].status })) });
}
