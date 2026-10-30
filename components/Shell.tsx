import Dragon from "./Dragon";

export const EVENT = process.env.NEXT_PUBLIC_EVENT_NAME ?? "Photobooth";

export default function Shell({ children, happy = false }: { children: React.ReactNode; happy?: boolean }) {
  return (
    <main className="min-h-screen bg-[#B71C20] bg-[radial-gradient(rgba(0,0,0,.18)_2px,transparent_2.6px)] bg-[length:22px_22px] px-4 py-8 text-white">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <Dragon frame={happy ? 2 : 0} className="w-28 drop-shadow-[0_5px_0_rgba(0,0,0,.28)]" />
        <h1 className="rounded-2xl border-[6px] border-[#5C0F14] bg-[#B71C20] px-5 py-2 text-3xl font-black shadow-[0_8px_0_#5C0F14,0_0_0_6px_#F7E018]">
          {EVENT}
        </h1>
        {children}
      </div>
    </main>
  );
}
