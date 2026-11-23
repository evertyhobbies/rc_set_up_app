import Link from "next/link";
import { TouringChassis, TOURING_VIEWBOX } from "./outlines/TouringChassis";
import { displayValue, type SheetValues } from "@/lib/sheetValues";
import type { Zone } from "@/lib/summarySlots";

export type SummaryItem = {
  zone: Zone;
  label: string;
  unit: string | null;
  // Every widget of the box (radio groups have several); used to resolve the shown value
  widgets: { fieldId: string | null; corner: "FL" | "FR" | "RL" | "RR" | null; axle: string | null; kind: string; exportValue: string | null; choiceLabel: string | null }[];
};

function valueOf(item: SummaryItem, values: SheetValues) {
  const w0 = item.widgets[0];
  if (!w0) return "";
  const raw = displayValue(values, w0);
  if (!raw) return "";
  if (w0.kind === "checkbox" || w0.kind === "radio") {
    const hit = item.widgets.find((w) => w.exportValue === raw);
    return hit?.choiceLabel || (item.widgets.length === 1 ? "✓" : raw);
  }
  return raw;
}

function Value({ item, values, align = "center" }: { item: SummaryItem; values: SheetValues; align?: "center" | "start" | "end" }) {
  const v = valueOf(item, values);
  return (
    <div className={`flex flex-col ${align === "center" ? "items-center text-center" : align === "start" ? "items-start" : "items-end text-right"}`}>
      <span className="text-[10px] font-medium leading-tight text-accent">{item.label}</span>
      <span className="flex items-baseline gap-0.5 font-mono text-[15px] leading-tight text-ink-primary">
        {v || <span className="text-ink-muted">—</span>}
        {v && item.unit && <span className="text-[10px] text-ink-muted">{item.unit}</span>}
      </span>
    </div>
  );
}

/** Read-only summary: values from the PDF sheet placed around the chassis drawing. */
export function SummaryView({ items, values, adminHref }: { items: SummaryItem[]; values: SheetValues; adminHref: string }) {
  const by = (z: Zone) => items.filter((i) => i.zone === z);
  const front = by("front"), rear = by("rear"), center = by("center");
  const fa = (TOURING_VIEWBOX.frontAxleY / TOURING_VIEWBOX.height) * 100;
  const ra = (TOURING_VIEWBOX.rearAxleY / TOURING_VIEWBOX.height) * 100;

  if (!items.length) {
    return (
      <div className="rounded-md border border-line bg-surface-1 p-6 text-center text-sm text-ink-secondary">
        No summary layout yet.{" "}
        <Link href={adminHref} className="text-accent">Choose which sheet values show here</Link>.
      </div>
    );
  }

  const Side = ({ top, bottom, align }: { top: SummaryItem[]; bottom: SummaryItem[]; align: "start" | "end" }) => (
    <div className="relative">
      <div className="absolute inset-x-0 flex -translate-y-1/2 flex-col gap-2" style={{ top: `${fa}%` }}>
        {top.map((i) => <Value key={i.label + i.zone} item={i} values={values} align={align} />)}
      </div>
      <div className="absolute inset-x-0 flex -translate-y-1/2 flex-col gap-2" style={{ top: `${ra}%` }}>
        {bottom.map((i) => <Value key={i.label + i.zone} item={i} values={values} align={align} />)}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-md rounded-md border border-line bg-surface-1 px-3 py-3">
      <div className="text-center font-mono text-[10px] font-semibold tracking-[0.2em] text-ink-muted">FRONT</div>
      {front.length > 0 && (
        <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-2">
          {front.map((i) => <Value key={i.label} item={i} values={values} />)}
        </div>
      )}
      <div className="my-2 grid grid-cols-[64px_1fr_64px]">
        <Side top={by("FL")} bottom={by("RL")} align="start" />
        <div style={{ aspectRatio: `${TOURING_VIEWBOX.width} / ${TOURING_VIEWBOX.height}` }}>
          <TouringChassis className="h-full w-full" />
        </div>
        <Side top={by("FR")} bottom={by("RR")} align="end" />
      </div>
      {rear.length > 0 && (
        <div className="grid grid-cols-3 gap-x-2 gap-y-2">
          {rear.map((i) => <Value key={i.label} item={i} values={values} />)}
        </div>
      )}
      <div className="mt-1 text-center font-mono text-[10px] font-semibold tracking-[0.2em] text-ink-muted">REAR</div>
      {center.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-line pt-3">
          {center.map((i) => <Value key={i.label} item={i} values={values} />)}
        </div>
      )}
    </div>
  );
}
