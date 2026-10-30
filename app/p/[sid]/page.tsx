"use client";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Shell from "@/components/Shell";

type Item = { name: string; label: string; url: string };
type Data = { expiresAt: number; files: Item[] };

const btn =
  "inline-block rounded-full border-4 border-[#5C0F14] bg-[#F7E018] px-5 py-2 font-black text-[#5C0F14] shadow-[0_5px_0_#5C0F14] active:translate-y-1";

const loading = (
  <Shell>
    <p className="text-lg font-bold">Finding your photos…</p>
  </Shell>
);

// The session id is only known at request time, so useParams needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={loading}>
      <Photos />
    </Suspense>
  );
}

function Photos() {
  const { sid } = useParams<{ sid: string }>();
  const [data, setData] = useState<Data>();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = decodeURIComponent(window.location.hash.slice(1));   // the secret stays in the #fragment
    if (!token) {
      setError("This link is missing its code. Scan your QR code again.");
      return;
    }
    fetch(`/api/session/${sid}?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, [sid]);

  if (error)
    return (
      <Shell>
        <p className="rounded-xl bg-[#5C0F14] px-4 py-3 text-lg font-bold">{error}</p>
        <a href="/" className={btn}>Try another code</a>
      </Shell>
    );
  if (!data) return loading;

  const strip = data.files.find((f) => f.name === "final.png");
  const shots = data.files.filter((f) => f.name !== "final.png");
  const until = new Date(data.expiresAt).toLocaleDateString(undefined, { month: "long", day: "numeric" });

  return (
    <Shell happy>
      <p className="font-bold">Press and hold a photo to save it, or use the Download buttons. Available until {until}.</p>
      {strip && (
        <section className="w-full space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={strip.url} alt="Your photo strip" className="mx-auto max-h-[70vh] rounded-xl border-[6px] border-[#F7E018] bg-white" />
          <a href={`${strip.url}&download=1`} download className={btn}>Download strip</a>
        </section>
      )}
      {shots.length > 0 && (
        <section className="grid w-full grid-cols-2 gap-3">
          {shots.map((f) => (
            <div key={f.name} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt={f.label} loading="lazy" className="w-full rounded-lg border-4 border-[#F7E018]" />
              <a href={`${f.url}&download=1`} download className="text-sm font-black text-[#F7E018] underline">Download {f.label}</a>
            </div>
          ))}
        </section>
      )}
    </Shell>
  );
}
