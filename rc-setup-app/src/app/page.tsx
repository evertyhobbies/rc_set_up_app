import Link from "next/link";

const tiles = [
  { href: "/models", title: "Model Select", desc: "Your cars, setups and setup sheets", ready: true },
  { href: "/files", title: "Files", desc: "Manuals, exploded views, PDFs", ready: false },
  { href: "/links", title: "Live RC Links", desc: "Live timing, results, streams", ready: false },
  { href: "/parts", title: "Find Parts", desc: "Part numbers and where to buy", ready: false },
];

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-10">
      <div className="mb-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Everty Hobbies</div>
        <h1 className="mt-1 text-2xl font-medium tracking-tight text-ink-primary">RC Setup Sheets</h1>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="flex min-h-32 flex-col justify-end rounded-md border border-line bg-surface-1 p-5 transition-colors hover:border-accent/40"
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-ink-primary">{t.title}</span>
              {!t.ready && (
                <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink-muted">soon</span>
              )}
            </div>
            <span className="mt-1 text-sm text-ink-secondary">{t.desc}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
