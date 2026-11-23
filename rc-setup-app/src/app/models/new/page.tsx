"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, btnPrimary, btnGhost, input } from "@/components/PageHeader";

type StepKey = "types" | "manufacturers" | "scales" | "models" | "years";
type Option = { id: string; name: string; count?: number; has_sheet?: boolean };
type Picks = Partial<Record<StepKey, Option>>;

const STEPS: { key: StepKey; label: string; title: string; add: string; placeholder: string }[] = [
  { key: "types", label: "Type", title: "Select car type", add: "Add car type", placeholder: "e.g. Touring" },
  { key: "manufacturers", label: "Manufacturer", title: "Select manufacturer", add: "Add manufacturer", placeholder: "e.g. Xray" },
  { key: "scales", label: "Scale", title: "Select scale", add: "Add scale", placeholder: "e.g. 1/10" },
  { key: "models", label: "Model", title: "Select model", add: "Add model", placeholder: "e.g. X4" },
  { key: "years", label: "Year", title: "Select year", add: "Add year", placeholder: "e.g. 2026" },
];

function context(picks: Picks) {
  return {
    type: picks.types?.id ?? "",
    manufacturer: picks.manufacturers?.id ?? "",
    scale: picks.scales?.id ?? "",
    model: picks.models?.id ?? "",
  };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export default function NewModelPage() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [picks, setPicks] = useState<Picks>({});

  function pick(opt: Option) {
    const next: Picks = {};
    for (const s of STEPS.slice(0, stepIdx)) next[s.key] = picks[s.key];
    next[STEPS[stepIdx].key] = opt;
    setPicks(next);
    setStepIdx(stepIdx + 1);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-surface-0 px-5 py-8">
      <PageHeader title="Create new model" back="/models" />

      {!started ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setStarted(true)}
            className="rounded-md border border-accent/50 bg-surface-1 p-5 text-left transition-colors hover:bg-surface-2"
          >
            <div className="text-base font-medium text-ink-primary">Create new from scratch</div>
            <div className="mt-1 text-sm text-ink-secondary">Type → manufacturer → scale → model → year</div>
          </button>
          <div className="rounded-md border border-line bg-surface-1 p-5 opacity-50">
            <div className="text-base font-medium text-ink-primary">Copy an existing car</div>
            <div className="mt-1 text-sm text-ink-secondary">Coming soon</div>
          </div>
        </div>
      ) : (
        <>
          <ol className="mb-4 flex flex-wrap gap-1.5">
            {STEPS.map((s, i) => (
              <li key={s.key}>
                <button
                  disabled={i > stepIdx}
                  onClick={() => setStepIdx(i)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    i === stepIdx ? "border-accent text-accent" : picks[s.key] ? "border-line bg-surface-2 text-ink-primary" : "border-line text-ink-muted"
                  } disabled:opacity-40`}
                >
                  {picks[s.key]?.name ?? s.label}
                </button>
              </li>
            ))}
          </ol>
          {stepIdx < STEPS.length ? (
            <StepList key={`${stepIdx}:${JSON.stringify(context(picks))}`} stepIdx={stepIdx} picks={picks} onPick={pick} />
          ) : (
            <Finish picks={picks} onCreated={(id) => router.push(`/cars/${id}`)} />
          )}
        </>
      )}
    </main>
  );
}

function StepList({ stepIdx, picks, onPick }: { stepIdx: number; picks: Picks; onPick: (o: Option) => void }) {
  const step = STEPS[stepIdx];
  const [options, setOptions] = useState<Option[] | null>(null);
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ step: step.key, ...context(picks) });
    api<Option[]>(`/api/catalog?${q}`).then(setOptions).catch((e) => setError(e.message));
  }, [step.key, picks]);

  const shown = useMemo(
    () => (options ?? []).filter((o) => o.name.toLowerCase().includes(filter.toLowerCase())),
    [options, filter]
  );

  async function add() {
    setError(null);
    try {
      onPick(
        await api<Option>("/api/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: step.key, name, ...context(picks) }),
        })
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="rounded-md border border-line bg-surface-1 p-4">
      <h2 className="mb-3 text-sm font-medium text-ink-primary">{step.title}</h2>
      {(options?.length ?? 0) > 8 && (
        <input className={`${input} mb-3`} placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      )}
      {!options && !error && <p className="py-6 text-center text-sm text-ink-muted">Loading…</p>}
      {options?.length === 0 && <p className="mb-3 text-sm text-ink-muted">Nothing here yet. Add the first one below.</p>}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o)}
            className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3.5 py-2.5 text-left text-sm text-ink-primary transition-colors hover:border-accent/50"
          >
            <span>{o.name}</span>
            {!!o.count && <span className="font-mono text-[11px] text-ink-muted">{o.count}</span>}
            {step.key === "years" && (
              <span className={`font-mono text-[11px] ${o.has_sheet ? "text-accent" : "text-ink-muted"}`}>
                {o.has_sheet ? "sheet ✓" : "no sheet"}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {adding ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              autoFocus
              className={input}
              placeholder={step.placeholder}
              inputMode={step.key === "years" ? "numeric" : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" disabled={!name.trim()} className={btnPrimary}>Add</button>
            <button type="button" onClick={() => setAdding(false)} className={btnGhost}>Cancel</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="text-sm font-medium text-accent">+ {step.add}</button>
        )}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    </section>
  );
}

function Finish({ picks, onCreated }: { picks: Picks; onCreated: (id: string) => void }) {
  const [nickname, setNickname] = useState(`${picks.manufacturers?.name} ${picks.models?.name} ${picks.years?.name}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const car = await api<{ id: string }>("/api/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, carModelId: picks.years?.id }),
      });
      onCreated(car.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <section className="rounded-md border border-line bg-surface-1 p-4">
      <h2 className="text-sm font-medium text-ink-primary">Name your car</h2>
      <p className="mb-4 mt-1 text-sm text-ink-secondary">
        {picks.manufacturers?.name} {picks.models?.name} {picks.years?.name} · {picks.types?.name} · {picks.scales?.name}
      </p>
      <input className={`${input} mb-4`} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Blue X4" />
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      <button onClick={create} disabled={busy || !nickname.trim()} className={btnPrimary}>
        {busy ? "Creating…" : "Create model"}
      </button>
    </section>
  );
}
