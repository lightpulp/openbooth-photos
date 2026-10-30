import { NextRequest, NextResponse } from "next/server";
import { loadSession, SessionError } from "@/lib/drive";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const token = req.nextUrl.searchParams.get("t") ?? "";
  try {
    const s = await loadSession(sid, token);
    const files = s.files.map((f) => ({
      name: f.name,
      label: f.label,
      url: `/api/file/${sid}/${f.name}?t=${encodeURIComponent(token)}`,
    }));
    return NextResponse.json({ expiresAt: s.expiresAt, files }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const err = e instanceof SessionError ? e : new SessionError(500, "Something went wrong.");
    if (!(e instanceof SessionError)) console.error(e);
    return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Cache-Control": "no-store" } });
  }
}
