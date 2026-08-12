# SignalDesk

**Find repeated problems worth building for.**

SignalDesk is a local-first opportunity radar that collects public demand signals, groups repeated concerns, preserves original evidence, and ranks only ideas that appear achievable for one developer in ten working days.

It separates two daily research queues:

- **Ideas** — unmet workflows and explicit product desires from public discussions.
- **Complaints** — recurring pain found in low-rating app reviews.

Every refresh targets 20 unique candidates in each queue. SignalDesk shows the original excerpts and links instead of asking you to trust an opaque AI summary.

## Why SignalDesk

Product-idea lists often reward novelty without proving demand. Social listening tools often optimize for brand monitoring rather than small, buildable product opportunities. SignalDesk uses a stricter funnel:

1. Capture public evidence.
2. Cluster the same concern across distinct people.
3. Separate ideas from incumbent-product complaints.
4. Measure frequency, source diversity, pain, and freshness.
5. Apply a ten-day feasibility gate.
6. Send candidates to a human review queue.

One loud post remains an early signal. Repetition strengthens demand confidence, but does not guarantee business success.

## Current features

- Live public-source refresh for Reddit, Hacker News, GitHub Issues, and Apple App Store reviews
- Independent 20-item Ideas and Complaints sections
- Original post/review excerpts, author, date, engagement, rating, and source link
- Deduplication and concern-level clustering
- Distinct-person and source-count evidence
- Deterministic scoring before any optional AI step
- Feasibility breakdown: screens, integrations, risks, and developer-day estimate
- Audience, source, category, and text filters
- Shortlist/reject workflow with local D1-compatible persistence
- Responsive interface designed for daily review

## Evidence and qualification rules

A concern becomes demand-qualified only when at least five distinct people describe the same problem and either:

- the evidence spans at least two independent sources, or
- at least five low-rating reviews describe the same complaint topic.

A candidate reaches the main review queue only when the MVP is also estimated at ten developer-days or fewer, with limited integrations and no unresolved regulatory or platform dependency.

These are research heuristics, not proof that a market is empty or that a product will succeed. Validate competitors and interview users before building.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create a production build:

```bash
npm run build
```

## Data-source boundaries

SignalDesk uses free public endpoints where available. Coverage can be incomplete or rate-limited. X and Xiaohongshu are shown as limited/manual sources until a reliable, compliant free connector is available. The UI should report shortages rather than fabricate evidence.

Only short excerpts needed for research context should be retained. Follow the source platform's terms and open the original link for full context.

## Architecture

- React 19 and TypeScript
- vinext/Vite application runtime
- Cloudflare D1-compatible local persistence
- Rule-based collection, clustering, scoring, and feasibility checks
- Optional AI reserved for shortlisted synthesis or translation

The low-cost design intentionally avoids sending every post through a language model.

## Roadmap

- Stronger cross-source semantic clustering with bounded AI cost
- Better competitor and product-gap validation
- Source-health and quota reporting
- Saved daily snapshots and trend history
- Reviewer notes and candidate comparison
- Compliant connectors for more review ecosystems
- Reproducible scoring tests and benchmark datasets

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Please include real evidence and label assumptions honestly when proposing a new ranking rule or source connector.

## Ethical growth goal

The project aims to earn 10,000+ genuine GitHub stars through usefulness, trustworthy evidence, strong documentation, and community contribution. It will not purchase stars, automate fake engagement, or spam communities.

## License

[MIT](LICENSE)

