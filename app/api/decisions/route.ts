import { env } from "cloudflare:workers";

async function ensureTable() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS review_decisions (
      candidate_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('review', 'shortlisted', 'rejected')),
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

export async function GET() {
  try {
    await ensureTable();
    const result = await env.DB.prepare(
      "SELECT candidate_id AS candidateId, status, notes, updated_at AS updatedAt FROM review_decisions ORDER BY updated_at DESC"
    ).all();
    return Response.json({ decisions: result.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { candidateId?: number; status?: string; notes?: string };
    if (!Number.isInteger(payload.candidateId) || !["review", "shortlisted", "rejected"].includes(payload.status ?? "")) {
      return Response.json({ error: "Valid candidateId and status are required" }, { status: 400 });
    }
    await ensureTable();
    await env.DB.prepare(`
      INSERT INTO review_decisions (candidate_id, status, notes, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(candidate_id) DO UPDATE SET
        status = excluded.status,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `).bind(payload.candidateId, payload.status, payload.notes?.trim() ?? "").run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 });
  }
}
