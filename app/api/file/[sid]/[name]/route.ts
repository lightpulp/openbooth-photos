import { NextRequest, NextResponse } from "next/server";
import { loadSession, openFile, SessionError } from "@/lib/drive";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sid: string; name: string }> }) {
  const { sid, name } = await params;
  const token = req.nextUrl.searchParams.get("t") ?? "";
  try {
    const s = await loadSession(sid, token);
    const file = s.files.find((f) => f.name === name);            // only allow-listed files can match
    if (!file) throw new SessionError(404, "Photo not found.");
    const drive = await openFile(file.id);
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new Response(drive.body, {                              // streamed straight from Drive
      headers: {
        "Content-Type": name.endsWith(".png") ? "image/png" : "image/jpeg",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="photobooth-${name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const err = e instanceof SessionError ? e : new SessionError(500, "Something went wrong.");
    if (!(e instanceof SessionError)) console.error(e);
    return NextResponse.json({ error: err.message }, { status: err.status, headers: { "Cache-Control": "no-store" } });
  }
}
