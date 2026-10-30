// Pulls { sid, token } out of whatever the visitor scanned or pasted.
const BOOTH_LINK = /\/dl\/([A-Za-z0-9_-]{6,64})\/([A-Za-z0-9_-]{6,64})/;   // old local QR: http://192.168.137.1:8000/dl/<sid>/<token>
const SITE_LINK = /\/p\/([A-Za-z0-9_-]{6,64})#([A-Za-z0-9_-]{6,64})/;      // this site's own link

export function parseShareLink(text: string): { sid: string; token: string } | null {
  const m = text.trim().match(BOOTH_LINK) ?? text.trim().match(SITE_LINK);
  return m ? { sid: m[1], token: m[2] } : null;
}
