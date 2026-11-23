import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  sub,
  back,
  right,
}: {
  title: string;
  eyebrow?: string;
  sub?: ReactNode;
  back?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {back && (
        <Link href={back} aria-label="Back" className="-ml-1 mt-0.5 rounded px-1.5 text-xl leading-none text-ink-secondary hover:text-ink-primary">
          ‹
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && <div className="text-xs text-ink-muted">{eyebrow}</div>}
        <h1 className="truncate text-lg font-medium tracking-tight text-ink-primary">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-ink-secondary">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export const btn =
  "rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
export const btnPrimary = `${btn} bg-accent text-surface-0 hover:brightness-110`;
export const btnGhost = `${btn} border border-line bg-surface-1 text-ink-primary hover:border-accent/40`;
export const btnDanger = `${btn} border border-red-900/60 text-red-300 hover:bg-red-950/40`;
export const input =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-accent";
