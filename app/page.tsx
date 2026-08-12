"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { reconcileCandidates, type CandidateStatus } from "../lib/decision-reconciliation";

type Candidate = {
  id: number;
  title: string;
  problem: string;
  audience: string;
  source: string;
  sourceUrl: string;
  category: string;
  score: number;
  confidence: "High" | "Medium" | "Early";
  evidenceCount: number;
  uniquePeople?: number;
  sourceCount?: number;
  signalType?: "idea" | "complaint";
  commercialStage?: "signal" | "researching" | "commercial_lead" | "needs_review";
  missingCommercialGates?: string[];
  demandQualified?: boolean;
  effort: string;
  monetization: string;
  status: CandidateStatus;
  createdAt: string;
  evidence?: Array<{ source: string; title: string; originalText: string; author: string; publishedAt: string; engagement: number; rating?: number; url: string }>;
  feasibility?: { verdict: string; estimatedDays: number; screens: string[]; integrations: string[]; risks: string[] };
};

type RefreshPayload = {
  candidates: Candidate[];
  quotas: { ideas: number; complaints: number; targetPerSection: number };
  sourceStatus: Array<{ source: string; status: "ok" | "failed"; count: number; error?: string }>;
  metrics: { collected: number; uniqueSignals: number; eligibleSignals: number; duplicatesRemoved: number; clusters: number; sourcesOk: number; sourcesTotal: number };
  refreshedAt: string;
};

// Original demo hypotheses are retained unchanged for review, but are no longer shown as verified evidence.
const fallbackIdeas: Candidate[] = [
  { id: 1, title: "Return-window autopilot", problem: "People lose refunds because return deadlines are scattered across email receipts.", audience: "Consumers", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=missed%20return%20window", category: "Personal admin", score: 91, confidence: "High", evidenceCount: 14, effort: "7–10 days", monetization: "$3/mo or retailer affiliate", status: "review", createdAt: "Today" },
  { id: 2, title: "Screenshot-to-action inbox", problem: "Saved screenshots become an unsearchable pile of products, events, and reminders.", audience: "Consumers", source: "App reviews", sourceUrl: "https://www.google.com/search?q=screenshot+organizer+app+reviews", category: "Productivity", score: 88, confidence: "High", evidenceCount: 11, effort: "8–12 days", monetization: "$19 one-time", status: "review", createdAt: "Today" },
  { id: 3, title: "Apartment noise diary", problem: "Renters need credible, timestamped evidence when reporting recurring noise.", audience: "Renters", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=apartment%20noise%20complaint%20evidence", category: "Housing", score: 86, confidence: "Medium", evidenceCount: 9, effort: "5‑8 days", monetization: "$9 case export", status: "review", createdAt: "Today" },
  { id: 4, title: "Freelance scope-change ledger", problem: "Small scope changes happen in chat and never reach the invoice.", audience: "Freelancers", source: "X", sourceUrl: "https://x.com/search?q=freelance%20scope%20creep&src=typed_query", category: "Work", score: 84, confidence: "Medium", evidenceCount: 8, effort: "6‑10 days", monetization: "$6/mo", status: "review", createdAt: "Today" },
  { id: 5, title: "School-form field vault", problem: "Parents repeatedly type the same household data into incompatible school forms.", audience: "Parents", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=school%20forms%20parents%20repetitive", category: "Family", score: 83, confidence: "Medium", evidenceCount: 7, effort: "8‑12 days", monetization: "$15/year", status: "review", createdAt: "Today" },
  { id: 6, title: "HOA promise tracker", problem: "Residents cannot easily track requests, promises, and follow-ups across emails.", audience: "Homeowners", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=HOA%20email%20request%20ignored", category: "Housing", score: 81, confidence: "Medium", evidenceCount: 7, effort: "7‑10 days", monetization: "$4/mo", status: "review", createdAt: "Today" },
  { id: 7, title: "Medical-call prep card", problem: "Patients forget symptoms, dates, and questions during short appointments.", audience: "Patients", source: "App reviews", sourceUrl: "https://www.google.com/search?q=symptom+journal+app+reviews+missing", category: "Health admin", score: 79, confidence: "Medium", evidenceCount: 9, effort: "5‑7 days", monetization: "$12 one-time", status: "review", createdAt: "Today" },
  { id: 8, title: "Neighborhood lending receipt", problem: "Neighbors lend tools informally and forget who has what.", audience: "Communities", source: "Nextdoor", sourceUrl: "https://www.google.com/search?q=site%3Anextdoor.com+borrowed+tool+return", category: "Community", score: 77, confidence: "Early", evidenceCount: 5, effort: "4‑6 days", monetization: "Local sponsor", status: "review", createdAt: "Today" },
  { id: 9, title: "Shift-swap rule checker", problem: "Hourly workers propose swaps that accidentally violate scheduling rules.", audience: "Hourly teams", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=shift%20swap%20manager%20problem", category: "Work", score: 76, confidence: "Medium", evidenceCount: 8, effort: "8‑12 days", monetization: "$1/user/mo", status: "review", createdAt: "Today" },
  { id: 10, title: "Gift-card expiry wallet", problem: "People forget balances, restrictions, and promotional expiration dates.", audience: "Consumers", source: "X", sourceUrl: "https://x.com/search?q=forgot%20gift%20card%20balance&src=typed_query", category: "Money", score: 75, confidence: "Medium", evidenceCount: 10, effort: "5‑8 days", monetization: "Affiliate + premium", status: "review", createdAt: "Today" },
  { id: 11, title: "Pet-sitter handoff page", problem: "Pet routines and emergency details are rewritten for every sitter.", audience: "Pet owners", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=pet%20sitter%20instructions", category: "Pets", score: 74, confidence: "Medium", evidenceCount: 6, effort: "4‑6 days", monetization: "$8/year", status: "review", createdAt: "Today" },
  { id: 12, title: "Contract renewal radar", problem: "Tiny businesses miss renewal and cancellation notice windows in vendor contracts.", audience: "Small business", source: "HN", sourceUrl: "https://hn.algolia.com/?q=contract%20renewal", category: "Business ops", score: 73, confidence: "Medium", evidenceCount: 6, effort: "8‑12 days", monetization: "$12/mo", status: "review", createdAt: "Today" },
  { id: 13, title: "Recipe substitution memory", problem: "Home cooks forget which substitutions worked for their exact dietary needs.", audience: "Home cooks", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=recipe%20substitution%20tracking", category: "Food", score: 72, confidence: "Early", evidenceCount: 5, effort: "5‑7 days", monetization: "$10 one-time", status: "review", createdAt: "Today" },
  { id: 14, title: "Club dues reconciler", problem: "Volunteer treasurers reconcile Venmo payments and member lists by hand.", audience: "Volunteer groups", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=club%20dues%20venmo%20spreadsheet", category: "Community", score: 71, confidence: "Medium", evidenceCount: 7, effort: "7‑10 days", monetization: "$5/mo per club", status: "review", createdAt: "Today" },
  { id: 15, title: "Caregiver visit log", problem: "Families coordinate elder-care visits through fragmented group chats.", audience: "Caregivers", source: "App reviews", sourceUrl: "https://www.google.com/search?q=caregiver+coordination+app+reviews", category: "Family", score: 70, confidence: "Medium", evidenceCount: 8, effort: "10‑14 days", monetization: "$8/family/mo", status: "review", createdAt: "Today" },
  { id: 16, title: "Marketplace pickup planner", problem: "Buyers waste messages coordinating pickup windows and directions.", audience: "Local sellers", source: "Reddit", sourceUrl: "https://www.reddit.com/search/?q=facebook%20marketplace%20pickup%20scheduling", category: "Commerce", score: 68, confidence: "Early", evidenceCount: 5, effort: "5‑8 days", monetization: "$3/mo", status: "review", createdAt: "Today" },
  { id: 17, title: "Tiny-team decision log", problem: "Decisions made in chat become impossible to find weeks later.", audience: "Small teams", source: "GitHub", sourceUrl: "https://github.com/issues?q=is%3Aissue+decision+log", category: "Work", score: 67, confidence: "Medium", evidenceCount: 9, effort: "8‑12 days", monetization: "$10/team/mo", status: "review", createdAt: "Today" },
  { id: 18, title: "Kids clothing size forecast", problem: "Parents buy seasonal clothes without knowing likely size at wear time.", audience: "Parents", source: "小红书", sourceUrl: "https://www.xiaohongshu.com/search_result?keyword=%E5%84%BF%E7%AB%A5%E8%A1%A3%E6%9C%8D%E5%B0%BA%E7%A0%81", category: "Family", score: 66, confidence: "Early", evidenceCount: 4, effort: "6‑9 days", monetization: "Retail affiliate", status: "review", createdAt: "Today" },
  { id: 19, title: "Warranty claim packager", problem: "Consumers cannot quickly assemble receipts, photos, and serial numbers for claims.", audience: "Consumers", source: "App reviews", sourceUrl: "https://www.google.com/search?q=warranty+tracker+app+reviews", category: "Personal admin", score: 65, confidence: "Medium", evidenceCount: 7, effort: "7‑10 days", monetization: "$15 one-time", status: "review", createdAt: "Today" },
  { id: 20, title: "Open-source setup gap finder", problem: "Maintainers repeatedly answer installation questions missing from documentation.", audience: "Developers", source: "GitHub", sourceUrl: "https://github.com/issues?q=is%3Aissue+label%3Adocumentation+installation", category: "Developer tools", score: 64, confidence: "High", evidenceCount: 15, effort: "7‑10 days", monetization: "$9/repo/mo", status: "review", createdAt: "Today" },
];
void fallbackIdeas;

const sourceColor: Record<string, string> = { Reddit: "coral", X: "ink", HN: "amber", GitHub: "violet", "App reviews": "blue", "App Store": "blue", "小红书": "red", Nextdoor: "green" };

export default function Home() {
  const [ideas, setIdeas] = useState<Candidate[]>([]);
  const [activeStatus, setActiveStatus] = useState("early");
  const [earlyKind, setEarlyKind] = useState<"idea" | "complaint">("idea");
  const [audience, setAudience] = useState("All audiences");
  const [source, setSource] = useState("All sources");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshData, setRefreshData] = useState<RefreshPayload | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Candidate["status"]>>({});

  const runRefresh = useCallback(async (savedDecisions: Record<number, Candidate["status"]>, existingIdeas: Candidate[] = []) => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      if (!response.ok) throw new Error("Refresh failed");
      const payload = await response.json() as RefreshPayload;
      const combined = reconcileCandidates(payload.candidates, existingIdeas, savedDecisions);
      setRefreshData(payload);
      if (combined.length) {
        setIdeas(combined);
        setSelected(combined[0]);
      } else {
        setIdeas([]);
        setSelected(null);
      }
      setLastRefresh(payload.refreshedAt);
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "Unable to refresh signals");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      let savedDecisions: Record<number, Candidate["status"]> = {};
      try {
        const response = await fetch("/api/decisions");
        if (!response.ok) throw new Error("Decision store unavailable");
        const payload = await response.json() as { decisions: Array<{ candidateId: number; status: Candidate["status"] }> };
        savedDecisions = Object.fromEntries(payload.decisions.map((item) => [item.candidateId, item.status]));
      } catch {
        try { savedDecisions = JSON.parse(window.localStorage.getItem("signaldesk-decisions") ?? "{}"); } catch { savedDecisions = {}; }
      }
      setDecisions(savedDecisions);
      await runRefresh(savedDecisions, []);
    };
    void load();
  }, [runRefresh]);

  const updateStatus = (idea: Candidate, status: Candidate["status"]) => {
    const next = ideas.map((item) => item.id === idea.id ? { ...item, status } : item);
    const nextDecisions = { ...decisions, [idea.id]: status };
    setIdeas(next);
    setDecisions(nextDecisions);
    setSelected({ ...idea, status });
    window.localStorage.setItem("signaldesk-decisions", JSON.stringify(nextDecisions));
    fetch("/api/decisions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidateId: idea.id, status }) }).catch(() => undefined);
  };

  const filtered = useMemo(() => ideas.filter((idea) =>
    (activeStatus === "review" ? idea.commercialStage === "needs_review" : idea.status === activeStatus) &&
    (activeStatus !== "early" || idea.signalType === earlyKind) &&
    (audience === "All audiences" || idea.audience === audience) &&
    (source === "All sources" || idea.source === source) &&
    `${idea.title} ${idea.problem} ${idea.category}`.toLowerCase().includes(query.toLowerCase())
  ), [ideas, activeStatus, earlyKind, audience, source, query]);

  const refresh = () => runRefresh(decisions, ideas);

  const audiences = ["All audiences", ...Array.from(new Set(ideas.map((idea) => idea.audience)))];
  const sources = ["All sources", ...Array.from(new Set(ideas.map((idea) => idea.source)))];
  const count = (status: string) => ideas.filter((idea) => idea.status === status).length;
  const commercialCount = ideas.filter((idea) => idea.commercialStage === "needs_review").length;
  const switchStatus = (status: string) => { setActiveStatus(status); setSelected(null); };
  const listLabels = activeStatus === "early" ? ["SIGNALS", "Ranked by research priority ↓"] : activeStatus === "review" ? ["MONEY OPPORTUNITIES", "All evidence gates passed · awaiting review"] : activeStatus === "shortlisted" ? ["SAVED RESEARCH", "Signals saved for commercial research"] : ["ARCHIVED SIGNALS", "Preserved for learning"];

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandmark">S</span><span>SignalDesk</span><em>Opportunity radar</em></div>
        <div className="top-actions"><span className={`freshness ${refreshError ? "failed" : ""}`}><i /> {refreshing ? "Scanning sources…" : refreshError ? "Refresh failed" : lastRefresh ? `Updated ${new Date(lastRefresh).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Not refreshed"}</span><button className="refresh" onClick={refresh} disabled={refreshing}>{refreshing ? "Scanning…" : "Refresh signals"}</button></div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">COMMERCIAL OPPORTUNITY RADAR · {new Date().toLocaleDateString(undefined, { month: "long", day: "numeric" }).toUpperCase()}</p>
          <h1>Research problems people may pay to solve.</h1>
          <p className="lede">Small-business opportunities require evidence of demand, spending, a reachable buyer, and a credible wedge.</p>
        </div>
        <div className="hero-score"><span>Money opportunities</span><strong>{commercialCount}</strong><small>All commercial gates required</small></div>
      </section>

      <section className="metric-row">
        <div><span>Signals collected</span><strong>{refreshData?.metrics.collected ?? "—"}</strong><small>{refreshData ? `${refreshData.metrics.sourcesOk}/${refreshData.metrics.sourcesTotal} sources responded` : "No measured run"}</small></div>
        <div><span>Duplicates removed</span><strong>{refreshData?.metrics.duplicatesRemoved ?? "—"}</strong><small>{refreshData ? `${refreshData.metrics.clusters} concern clusters` : "No measured run"}</small></div>
        <div><span>Commercial research</span><strong>{commercialCount}</strong><small>Nothing promoted without evidence</small></div>
        <div><span>Ideas / complaints</span><strong>{refreshData ? `${refreshData.quotas.ideas}/${refreshData.quotas.complaints}` : "—"}</strong><small>Target 20 each</small></div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <nav>
            <button className={activeStatus === "early" ? "active" : ""} onClick={() => switchStatus("early")}><span>◌ Signals</span><b>{count("early")}</b></button>
            <button className={activeStatus === "review" ? "active" : ""} onClick={() => switchStatus("review")}><span>◈ Money opportunities</span><b>{commercialCount}</b></button>
            <button className={activeStatus === "shortlisted" ? "active" : ""} onClick={() => switchStatus("shortlisted")}><span>★ Saved research</span><b>{count("shortlisted")}</b></button>
            <button className={activeStatus === "rejected" ? "active" : ""} onClick={() => switchStatus("rejected")}><span>× Archived</span><b>{count("rejected")}</b></button>
          </nav>
          <div className="side-block"><h3>SOURCE COVERAGE</h3>{(refreshData?.sourceStatus ?? []).map((item) => <div className="source-status" key={item.source} title={item.error}><span><i className={item.status === "failed" ? "failed" : ""} />{item.source}</span><small>{item.status === "ok" ? `${item.count} found` : "Failed"}</small></div>)}{!refreshData && <p className="source-placeholder">Source health appears after a measured refresh.</p>}</div>
          <div className="method-card"><span>FAIL-CLOSED RESEARCH</span><strong>Signals are not opportunities.</strong><p>Promotion requires buyer, spending, pricing, wedge, channel, build, and revenue evidence.</p></div>
        </aside>

        <section className="content">
          {activeStatus === "early" && <div className="early-sections">
            <button className={earlyKind === "idea" ? "active" : ""} onClick={() => setEarlyKind("idea")}><span>IDEAS</span><strong>{ideas.filter((item) => item.status === "early" && item.signalType === "idea").length}</strong><small>Desires and unmet workflows</small></button>
            <button className={earlyKind === "complaint" ? "active" : ""} onClick={() => setEarlyKind("complaint")}><span>COMPLAINTS</span><strong>{ideas.filter((item) => item.status === "early" && item.signalType === "complaint").length}</strong><small>Repeated app-review pain</small></button>
          </div>}
          <div className="filters">
            <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search problems, categories…" /></label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Filter audience">{audiences.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter source">{sources.map((item) => <option key={item}>{item}</option>)}</select>
            <button className="filter-button">Sliders · 2 weeks</button>
          </div>
          <div className="list-head"><span>{filtered.length} {listLabels[0]}</span><span>{listLabels[1]}</span></div>
          {refreshError && <div className="refresh-notice error"><strong>Collection failed.</strong><span>{refreshError}. Existing saved and archived signals were preserved.</span><button onClick={refresh}>Try again</button></div>}
          {!refreshError && refreshData && (refreshData.quotas.ideas < refreshData.quotas.targetPerSection || refreshData.quotas.complaints < refreshData.quotas.targetPerSection) && <div className="refresh-notice"><strong>Evidence shortage reported.</strong><span>This run found {refreshData.quotas.ideas}/20 ideas and {refreshData.quotas.complaints}/20 complaints after signal filtering. SignalDesk will not fill gaps with fabricated candidates.</span></div>}
          <div className="ideas">
            {filtered.map((idea, index) => <button type="button" key={idea.id} className={`idea-card ${selected?.id === idea.id ? "selected" : ""}`} onClick={() => setSelected(idea)}>
              <div className="rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="idea-main">
                <div className="idea-title"><h2>{idea.title}</h2><span className={`source ${sourceColor[idea.source] ?? "ink"}`}>{idea.source}</span></div>
                <p>{idea.problem}</p>
                <div className="tags"><span>{idea.audience}</span><span>{idea.category}</span><span>{idea.evidenceCount} evidence items</span><span>{idea.missingCommercialGates?.length ?? 0} money gates missing</span></div>
              </div>
              <div className="score"><strong>{idea.score}</strong><span>RESEARCH PRIORITY</span><small className={idea.confidence.toLowerCase()}>Not commercially qualified</small></div>
            </button>)}
            {filtered.length === 0 && <div className="empty"><strong>{refreshing ? "Collecting evidence…" : activeStatus === "review" ? "Nothing has passed commercial validation yet." : "No signals in this view."}</strong><span>{refreshing ? "Source results will appear as they finish." : activeStatus === "review" ? "A money opportunity must pass buyer, spending, competition, wedge, channel, build, revenue, and evidence-integrity gates." : "Try another filter or inspect the reported source status."}</span></div>}
          </div>
        </section>

        <aside className={`detail ${selected ? "open" : ""}`}>
          {selected && <>
            <button className="close" onClick={() => setSelected(null)} aria-label="Close details">×</button>
            <span className="detail-kicker">SIGNAL RESEARCH BRIEF</span>
            <h2>{selected.title}</h2>
            <p className="detail-problem">{selected.problem}</p>
            <div className="detail-score"><div><strong>{selected.score}</strong><span>/ 100</span></div><p>{selected.demandQualified ? `Repeated pain was found across ${selected.uniquePeople} identifiable people and ${selected.sourceCount} source${selected.sourceCount === 1 ? "" : "s"}; commercial evidence is still required.` : `${selected.uniquePeople ?? 0} identifiable people found so far. Repeated-pain evidence is still incomplete.`}</p></div>
            {/* Original unsupported high-reach wording is preserved in repository history and intentionally not rendered. */}
            <h3>RESEARCH PRIORITY INPUTS</h3>
            <div className="score-bars">{[["Distinct people", Math.min(100, (selected.uniquePeople ?? 1) * 16)], ["Independent sources", Math.min(100, (selected.sourceCount ?? 1) * 35)], ["Evidence captured", Math.min(100, selected.evidenceCount * 12)], ["MVP feasibility", selected.feasibility?.verdict === "Feasible" ? 90 : selected.feasibility?.verdict === "Conditional" ? 45 : 10]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b><i><em style={{ width: `${value}%` }} /></i></div>)}</div>
            <h3>BUILD FEASIBILITY HYPOTHESIS</h3>
            <div className="feasibility"><strong>{selected.feasibility?.verdict ?? "Unverified"}</strong><span>{selected.feasibility?.estimatedDays ? `${selected.feasibility.estimatedDays} estimated developer-days` : "No build claim until screens, integrations, and risks are decomposed."}</span></div>
            <ul>{selected.feasibility?.screens.map((screen) => <li key={screen}>Screen: {screen}</li>)}{selected.feasibility?.integrations.map((integration) => <li key={integration}>Integration: {integration}</li>)}{(selected.feasibility?.risks ?? ["Engineering scope has not been decomposed"]).map((risk) => <li key={risk}>Risk: {risk}</li>)}</ul>
            <h3>COMMERCIAL GATES STILL MISSING</h3>
            <div className="tags">{(selected.missingCommercialGates ?? []).map((gate) => <span key={gate}>{gate}</span>)}</div>
            <div className="two-col"><div><span>BUILD HYPOTHESIS</span><strong>{selected.effort}</strong></div><div><span>COMMERCIAL STATUS</span><strong>Research required</strong></div></div>
            <h3>ORIGINAL EVIDENCE · {selected.evidence?.length ?? 0} CAPTURED</h3>
            <div className="evidence-list">{(selected.evidence ?? []).map((item, index) => <article className="evidence-post" key={`${item.url}-${index}`}><div><span className={`source ${sourceColor[item.source] ?? "ink"}`}>{item.source}</span>{item.rating && <b>{item.rating}/5 stars</b>}<time>{new Date(item.publishedAt).toLocaleDateString()}</time></div><strong>{item.title}</strong><p>{item.originalText.slice(0, 500)}{item.originalText.length > 500 ? "…" : ""}</p><small>By {item.author} · {item.engagement} engagement</small><a href={item.url} target="_blank" rel="noreferrer">Open original post ↗</a></article>)}</div>
            {/* Original generic link wording is preserved in repository history; evidence-specific links are rendered above. */}
            <p className="disclaimer">This is a problem signal, not a money opportunity. It cannot be promoted until buyer, spend, competitor pricing, wedge, channel, revenue, and build evidence pass review.</p>
            <div className="decision"><button className="reject" onClick={() => updateStatus(selected, "rejected")}>Archive signal</button><button className="shortlist" onClick={() => updateStatus(selected, "shortlisted")}>Save for research ★</button></div>
          </>}
        </aside>
      </section>
    </main>
  );
}
