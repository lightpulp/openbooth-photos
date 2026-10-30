"use client";
import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import { parseShareLink } from "@/lib/parse";

const btn =
  "rounded-full border-[5px] border-[#5C0F14] bg-[#F7E018] px-8 py-3 text-xl font-black text-[#5C0F14] shadow-[0_6px_0_#5C0F14] active:translate-y-1 active:shadow-[0_2px_0_#5C0F14]";

export default function Home() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  function open(raw: string): boolean {
    const found = parseShareLink(raw);
    if (!found) {
      setError("That doesn't look like a photobooth QR code or link.");
      return false;
    }
    router.push(`/p/${found.sid}#${found.token}`);
    return true;
  }

  // Live camera scan (jsQR works on every phone, unlike the BarcodeDetector API)
  useEffect(() => {
    if (!scanning) return;
    let stop = false, raf = 0;
    let stream: MediaStream | undefined;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stop) return;
          if (v.videoWidth) {
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = v.videoWidth * scale;
            canvas.height = v.videoHeight * scale;
            const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height);
            if (code && open(code.data)) {
              setScanning(false);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setError("Couldn't open the camera. Allow camera access, or upload a screenshot of your QR code instead.");
        setScanning(false);
      }
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  // QR code saved as a picture / screenshot
  async function onFile(file?: File) {
    if (!file) return;
    setError("");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height);
      if (!code) setError("No QR code found in that picture. Try a clearer screenshot.");
      else open(code.data);
    } catch {
      setError("Couldn't read that image.");
    }
  }

  return (
    <Shell>
      <p className="text-lg font-bold">Lost the booth Wi-Fi? Scan your old QR code here to get your photos back.</p>

      {scanning ? (
        <div className="w-full space-y-3">
          <video ref={video} playsInline muted className="w-full rounded-2xl border-[6px] border-[#F7E018]" />
          <button className={btn} onClick={() => setScanning(false)}>Cancel</button>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-4">
          <button className={btn} onClick={() => { setError(""); setScanning(true); }}>Scan my QR code</button>
          <label className={`${btn} cursor-pointer bg-[#FFF6D9]`}>
            Upload a QR screenshot
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <div className="w-full">
            <p className="mb-2 text-sm text-[#ffd9d9]">…or paste the link under your old QR code</p>
            <div className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="http://…/dl/20261029_ab12cd34/…"
                className="min-w-0 flex-1 rounded-full border-4 border-[#5C0F14] px-4 py-2 text-[#5C0F14]"
              />
              <button className="rounded-full border-4 border-[#5C0F14] bg-[#F7E018] px-5 font-black text-[#5C0F14]" onClick={() => open(text)}>Go</button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-xl bg-[#5C0F14] px-4 py-2 font-bold">{error}</p>}
    </Shell>
  );
}
