"use client";

import { useEffect, useMemo, useState } from "react";

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
  effort: string;
  monetization: string;
  status: "early" | "review" | "shortlisted" | "rejected";
  createdAt: string;
  evidence?: Array<{ source: string; title: string; originalText: string; author: string; publishedAt: string; engagement: number; rating?: number; url: string }>;
  feasibility?: { verdict: string; estimatedDays: number; screens: string[]; integrations: string[]; risks: string[] };
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
  const [lastRefresh, setLastRefresh] = useState("Today, 8:05 AM");

  useEffect(() => {
    fetch("/api/decisions")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { decisions: Array<{ candidateId: number; status: Candidate["status"] }> }) => {
        const decisions = Object.fromEntries(payload.decisions.map((item) => [item.candidateId, item.status]));
        setIdeas((current) => current.map((idea) => ({ ...idea, status: decisions[idea.id] ?? idea.status })));
      })
      .catch(() => {
        const saved = window.localStorage.getItem("signaldesk-decisions");
        if (saved) {
          const decisions = JSON.parse(saved) as Record<number, Candidate["status"]>;
          setIdeas((current) => current.map((idea) => ({ ...idea, status: decisions[idea.id] ?? idea.status })));
        }
      });
    fetch("/api/refresh", { method: "POST" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((payload: { candidates: Candidate[] }) => {
        setIdeas(payload.candidates);
        setSelected(payload.candidates[0] ?? null);
        if (payload.candidates.some((item) => item.status === "review")) setActiveStatus("review");
      })
      .catch(() => undefined);
  }, []);

  const updateStatus = (idea: Candidate, status: Candidate["status"]) => {
    const next = ideas.map((item) => item.id === idea.id ? { ...item, status } : item);
    setIdeas(next);
    setSelected({ ...idea, status });
    window.localStorage.setItem("signaldesk-decisions", JSON.stringify(Object.fromEntries(next.map((item) => [item.id, item.status]))));
    fetch("/api/decisions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidateId: idea.id, status }) }).catch(() => undefined);
  };

  const filtered = useMemo(() => ideas.filter((idea) =>
    idea.status === activeStatus &&
    (activeStatus !== "early" || idea.signalType === earlyKind) &&
    (audience === "All audiences" || idea.audience === audience) &&
    (source === "All sources" || idea.source === source) &&
    `${idea.title} ${idea.problem} ${idea.category}`.toLowerCase().includes(query.toLowerCase())
  ), [ideas, activeStatus, earlyKind, audience, source, query]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/refresh", { method: "POST" });
      if (!response.ok) throw new Error("Refresh failed");
      const payload = await response.json() as { candidates: Candidate[] };
      if (payload.candidates.length) {
        const liveIds = new Set(payload.candidates.map((item) => item.id));
        const combined = [...payload.candidates, ...ideas.filter((item) => !liveIds.has(item.id) && item.status !== "early")]
          .sort((a, b) => b.score - a.score)
          .slice(0, 60);
        setIdeas(combined);
        setSelected(combined[0]);
      }
      setLastRefresh("Just now");
    } finally {
      setRefreshing(false);
    }
  };

  const audiences = ["All audiences", ...Array.from(new Set(ideas.map((idea) => idea.audience)))];
  const sources = ["All sources", ...Array.from(new Set(ideas.map((idea) => idea.source)))];
  const count = (status: string) => ideas.filter((idea) => idea.status === status).length;

  return (
    <main>
      <header className="topbar">
        <div className="brand"><span className="brandmark">S</span><span>SignalDesk</span><em>Opportunity radar</em></div>
        <div className="top-actions"><span className="freshness"><i /> Updated {lastRefresh}</span><button className="refresh" onClick={refresh} disabled={refreshing}>{refreshing ? "Scanning…" : "Refresh signals"}</button><button className="icon-button" aria-label="Settings">⚙</button></div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">DAILY OPPORTUNITY BRIEF · AUGUST 12</p>
          <h1>Problems worth building for.</h1>
          <p className="lede">Evidence-backed product gaps, ranked for a solo builder with two weeks.</p>
        </div>
        <div className="hero-score"><span>Today’s signal quality</span><strong>82</strong><small>Strong evidence</small></div>
      </section>

      <section className="metric-row">
        <div><span>Signals scanned</span><strong>1,248</strong><small>7 sources</small></div>
        <div><span>Duplicates removed</span><strong>64%</strong><small>812 clustered</small></div>
        <div><span>Review queue</span><strong>{count("review")}</strong><small>Top opportunities</small></div>
        <div><span>Est. AI cost</span><strong>$0.08</strong><small>Shortlist only</small></div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <nav>
            <button className={activeStatus === "early" ? "active" : ""} onClick={() => setActiveStatus("early")}><span>◌ Early signals</span><b>{count("early")}</b></button>
            <button className={activeStatus === "review" ? "active" : ""} onClick={() => setActiveStatus("review")}><span>◈ Review queue</span><b>{count("review")}</b></button>
            <button className={activeStatus === "shortlisted" ? "active" : ""} onClick={() => setActiveStatus("shortlisted")}><span>★ Shortlisted</span><b>{count("shortlisted")}</b></button>
            <button className={activeStatus === "rejected" ? "active" : ""} onClick={() => setActiveStatus("rejected")}><span>× Rejected</span><b>{count("rejected")}</b></button>
          </nav>
          <div className="side-block"><h3>SOURCE COVERAGE</h3>{["Reddit", "Hacker News", "GitHub Issues", "App Store complaints", "X / public search", "小红书 / public search"].map((item, index) => <div className="source-status" key={item}><span><i className={index > 3 ? "limited" : ""} />{item}</span><small>{index > 3 ? "Limited" : "Live"}</small></div>)}</div>
          <div className="method-card"><span>LOW-COST MODE</span><strong>Rules first, AI last.</strong><p>Only finalists receive optional translation or synthesis.</p><button onClick={() => alert("Score = frequency 25 + pain 20 + gap 20 + ease 15 + willingness to pay 10 + distribution 5 + evidence 5.")}>View methodology →</button></div>
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
          <div className="list-head"><span>{filtered.length} CANDIDATES</span><span>Ranked by opportunity score ↓</span></div>
          <div className="ideas">
            {filtered.map((idea, index) => <article key={idea.id} className={`idea-card ${selected?.id === idea.id ? "selected" : ""}`} onClick={() => setSelected(idea)}>
              <div className="rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="idea-main">
                <div className="idea-title"><h2>{idea.title}</h2><span className={`source ${sourceColor[idea.source] ?? "ink"}`}>{idea.source}</span></div>
                <p>{idea.problem}</p>
                <div className="tags"><span>{idea.audience}</span><span>{idea.category}</span><span>{idea.effort}</span><span>{idea.evidenceCount} signals</span></div>
              </div>
              <div className="score"><strong>{idea.score}</strong><span>OPPORTUNITY</span><small className={idea.confidence.toLowerCase()}>{idea.confidence} confidence</small></div>
            </article>)}
            {filtered.length === 0 && <div className="empty"><strong>No ideas here yet.</strong><span>Try another filter or review status.</span></div>}
          </div>
        </section>

        <aside className={`detail ${selected ? "open" : ""}`}>
          {selected && <>
            <button className="close" onClick={() => setSelected(null)} aria-label="Close details">×</button>
            <span className="detail-kicker">OPPORTUNITY BRIEF</span>
            <h2>{selected.title}</h2>
            <p className="detail-problem">{selected.problem}</p>
            <div className="detail-score"><div><strong>{selected.score}</strong><span>/ 100</span></div><p>{selected.status === "review" ? `Repeated by ${selected.uniquePeople} distinct people across ${selected.sourceCount} source${selected.sourceCount === 1 ? "" : "s"}. Engineering feasibility still requires the checklist below.` : `${selected.uniquePeople ?? 1} distinct people found so far. It needs five matching voices before entering review.`}</p></div>
            {/* Original wording preserved for review; proposed evidence-first wording is displayed above. */}
            <p className="preserved-copy">Original: “High reach and clear pain. Feasible inside the two-week constraint.”</p>
            <h3>WHY IT RANKS</h3>
            <div className="score-bars">{[["Distinct people", Math.min(100, (selected.uniquePeople ?? 1) * 16)], ["Independent sources", Math.min(100, (selected.sourceCount ?? 1) * 35)], ["Evidence captured", Math.min(100, selected.evidenceCount * 12)], ["MVP feasibility", selected.feasibility?.verdict === "Feasible" ? 90 : selected.feasibility?.verdict === "Conditional" ? 45 : 10]].map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b><i><em style={{ width: `${value}%` }} /></i></div>)}</div>
            <h3>FEASIBILITY PROOF</h3>
            <div className="feasibility"><strong>{selected.feasibility?.verdict ?? "Unverified"}</strong><span>{selected.feasibility?.estimatedDays ? `${selected.feasibility.estimatedDays} estimated developer-days` : "No build claim until screens, integrations, and risks are decomposed."}</span></div>
            <ul>{selected.feasibility?.screens.map((screen) => <li key={screen}>Screen: {screen}</li>)}{selected.feasibility?.integrations.map((integration) => <li key={integration}>Integration: {integration}</li>)}{(selected.feasibility?.risks ?? ["Engineering scope has not been decomposed"]).map((risk) => <li key={risk}>Risk: {risk}</li>)}</ul>
            <div className="two-col"><div><span>BUILD</span><strong>{selected.effort}</strong></div><div><span>BUSINESS MODEL</span><strong>{selected.monetization}</strong></div></div>
            <h3>ORIGINAL EVIDENCE · {selected.evidence?.length ?? 0} CAPTURED</h3>
            <div className="evidence-list">{(selected.evidence ?? []).map((item, index) => <article className="evidence-post" key={`${item.url}-${index}`}><div><span className={`source ${sourceColor[item.source] ?? "ink"}`}>{item.source}</span>{item.rating && <b>{item.rating}/5 stars</b>}<time>{new Date(item.publishedAt).toLocaleDateString()}</time></div><strong>{item.title}</strong><p>{item.originalText.slice(0, 500)}{item.originalText.length > 500 ? "…" : ""}</p><small>By {item.author} · {item.engagement} engagement</small><a href={item.url} target="_blank" rel="noreferrer">Open original post ↗</a></article>)}</div>
            {/* Original link wording preserved; the proposal above shows each captured post and excerpt. */}
            <p className="preserved-copy">Original: “Open public source search ↗”</p>
            <p className="disclaimer">Candidate hypothesis, not proof of an empty market. Validate competitors and interview users before building.</p>
            <div className="decision"><button className="reject" onClick={() => updateStatus(selected, "rejected")}>Reject</button><button className="shortlist" onClick={() => updateStatus(selected, "shortlisted")}>Shortlist ★</button></div>
          </>}
        </aside>
      </section>
    </main>
  );
}
