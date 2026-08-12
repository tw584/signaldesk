import { summarizeSourceResults } from "../../../lib/source-results";
import { clean, complaintTopic, processSignals, type Signal } from "../../../lib/signal-pipeline";

const SOURCE_NAMES = ["HN", "Reddit", "GitHub", "App Store"] as const;
const REQUEST_TIMEOUT_MS = 8_000;

async function fetchChecked(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  return response;
}


async function hackerNews(): Promise<Signal[]> {
  const queries = ["wish there was", "looking for an app", "manual workflow", "frustrating workflow"];
  const results = await Promise.all(queries.map(async (query) => {
    const response = await fetchChecked(`https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=12&query=${encodeURIComponent(query)}`);
    const data = await response.json() as { hits: Array<{ title?: string; story_text?: string; url?: string; objectID: string; author?: string; points?: number; num_comments?: number; created_at: string; created_at_i: number }> };
    return data.hits.map((hit) => ({ source: "HN", title: clean(hit.title), originalText: clean(hit.story_text), author: hit.author ?? "Unknown", publishedAt: hit.created_at, engagement: (hit.points ?? 0) + (hit.num_comments ?? 0), url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, timestamp: hit.created_at_i * 1000 }));
  }));
  return results.flat();
}

async function reddit(): Promise<Signal[]> {
  const queries = ["wish there was an app", "looking for an app", "frustrating app", "manual workflow"];
  const results = await Promise.all(queries.map(async (query) => {
    const response = await fetchChecked(`https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&t=month&limit=20&raw_json=1`, { headers: { "user-agent": "SignalDesk local opportunity research/0.2" } });
    const data = await response.json() as { data: { children: Array<{ data: { title: string; selftext?: string; author?: string; permalink: string; score?: number; num_comments?: number; created_utc: number } }> } };
    return data.data.children.map(({ data: item }) => ({ source: "Reddit", title: clean(item.title), originalText: clean(item.selftext), author: item.author ?? "Unknown", publishedAt: new Date(item.created_utc * 1000).toISOString(), engagement: (item.score ?? 0) + (item.num_comments ?? 0), url: `https://www.reddit.com${item.permalink}`, timestamp: item.created_utc * 1000 }));
  }));
  return results.flat();
}

async function github(): Promise<Signal[]> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
  const response = await fetchChecked(`https://api.github.com/search/issues?q=${encodeURIComponent(`is:issue is:open created:>=${since} in:title "feature request"`)}&sort=comments&order=desc&per_page=25`, { headers: { accept: "application/vnd.github+json", "user-agent": "SignalDesk-local" } });
  const data = await response.json() as { items: Array<{ title: string; body?: string; user?: { login?: string }; html_url: string; comments: number; created_at: string }> };
  return data.items.map((item) => ({ source: "GitHub", title: clean(item.title), originalText: clean(item.body), author: item.user?.login ?? "Unknown", publishedAt: item.created_at, engagement: item.comments, url: item.html_url, timestamp: Date.parse(item.created_at) }));
}

async function appStoreComplaints(): Promise<Signal[]> {
  const search = await fetchChecked("https://itunes.apple.com/search?term=productivity%20organizer&country=us&entity=software&limit=12");
  const apps = await search.json() as { results: Array<{ trackId: number; trackName: string; trackViewUrl: string }> };
  const reviews = await Promise.allSettled(apps.results.map(async (app) => {
    const response = await fetchChecked(`https://itunes.apple.com/us/rss/customerreviews/id=${app.trackId}/sortBy=mostRecent/json`);
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
  if (reviews.length > 0 && reviews.every((result) => result.status === "rejected")) throw new Error("All App Store review requests failed");
  return reviews.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

export async function POST() {
  const settled = await Promise.allSettled([hackerNews(), reddit(), github(), appStoreComplaints()]);
  const sourceSummary = summarizeSourceResults(SOURCE_NAMES, settled);
  const collected = sourceSummary.collected;
  const pipeline = processSignals(collected);

  const sourceStatus = sourceSummary.sourceStatus;
  return Response.json({
    candidates: pipeline.candidates,
    quotas: { ideas: pipeline.earlyIdeas.length, complaints: pipeline.earlyComplaints.length, targetPerSection: 20 },
    sourceStatus,
    metrics: {
      collected: collected.length,
      uniqueSignals: pipeline.uniqueSignals.length,
      eligibleSignals: pipeline.eligibleSignals.length,
      duplicatesRemoved: collected.length - pipeline.uniqueSignals.length,
      clusters: pipeline.clusters.length,
      sourcesOk: sourceSummary.sourcesOk,
      sourcesTotal: sourceSummary.sourcesTotal,
    },
    refreshedAt: new Date().toISOString(),
  });
}
