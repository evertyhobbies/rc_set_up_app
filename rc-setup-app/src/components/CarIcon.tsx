export type BodyStyle = "sports" | "porsche" | "f1" | "nascar" | "buggy" | "truck";

export const BODY_STYLE_OPTIONS: { value: BodyStyle; label: string }[] = [
  { value: "sports", label: "Sports car" },
  { value: "porsche", label: "Porsche" },
  { value: "f1", label: "Formula 1" },
  { value: "nascar", label: "NASCAR" },
  { value: "buggy", label: "Offroad buggy" },
  { value: "truck", label: "Truck" },
];

// Shared wheel + drive-shaft chrome so every icon lines up with the corner
// boxes the same way. x positions mirror around the 70/140 centerline.
function Wheels({ inset = 6, width = 20 }: { inset?: number; width?: number }) {
  return (
    <>
      <rect x={inset} y="50" width={width} height="56" rx="7" className="fill-ink-muted" opacity="0.6" />
      <rect x={140 - inset - width} y="50" width={width} height="56" rx="7" className="fill-ink-muted" opacity="0.6" />
      <rect x={inset} y="294" width={width} height="56" rx="7" className="fill-ink-muted" opacity="0.6" />
      <rect x={140 - inset - width} y="294" width={width} height="56" rx="7" className="fill-ink-muted" opacity="0.6" />
    </>
  );
}

function SportsCar() {
  return (
    <svg viewBox="0 0 140 400" className="h-auto w-full" aria-hidden="true">
      <path
        d="M46,22 Q70,8 94,22 L106,50 Q112,64 110,84 L110,320 Q112,344 104,362 L92,388 Q70,398 48,388 L36,362 Q28,344 30,320 L30,84 Q28,64 34,50 Z"
        className="fill-accent/25 stroke-accent/50"
        strokeWidth="1.5"
      />
      <path d="M48,92 L92,92 L98,130 L42,130 Z" className="fill-surface-0/70" />
      <path d="M44,250 L96,250 L92,300 L48,300 Z" className="fill-surface-0/70" />
      <rect x="52" y="170" width="36" height="60" rx="6" className="fill-surface-1" opacity="0.8" />
      <Wheels inset={4} width={22} />
    </svg>
  );
}

function PorscheCar() {
  return (
    <svg viewBox="0 0 140 400" className="h-auto w-full" aria-hidden="true">
      <path
        d="M52,26 Q70,14 88,26 L98,48 Q108,58 110,80 Q116,140 112,200 Q116,260 110,320 Q108,342 98,360 L88,384 Q70,396 52,384 L42,360 Q32,342 30,320 Q24,260 28,200 Q24,140 30,80 Q32,58 42,48 Z"
        className="fill-accent/25 stroke-accent/50"
        strokeWidth="1.5"
      />
      <circle cx="46" cy="40" r="5" className="fill-accent/60" />
      <circle cx="94" cy="40" r="5" className="fill-accent/60" />
      <path d="M50,94 L90,94 L94,126 L46,126 Z" className="fill-surface-0/70" />
      <path d="M46,258 L94,258 L90,296 L50,296 Z" className="fill-surface-0/70" />
      <rect x="54" y="170" width="32" height="58" rx="14" className="fill-surface-1" opacity="0.8" />
      <Wheels inset={2} width={22} />
    </svg>
  );
}

function F1Car() {
  return (
    <svg viewBox="0 0 140 400" className="h-auto w-full" aria-hidden="true">
      {/* Front wing */}
      <rect x="16" y="30" width="108" height="10" rx="4" className="fill-accent/40 stroke-accent/60" strokeWidth="1" />
      {/* Narrow chassis */}
      <path
        d="M58,40 L82,40 L88,120 Q92,200 88,280 L82,360 L58,360 L52,280 Q48,200 52,120 Z"
        className="fill-accent/25 stroke-accent/50"
        strokeWidth="1.5"
      />
      {/* Cockpit + halo */}
      <ellipse cx="70" cy="190" rx="14" ry="22" className="fill-surface-0/70" />
      <path d="M58,168 Q70,158 82,168" fill="none" className="stroke-ink-muted" strokeWidth="3" />
      {/* Sidepods */}
      <rect x="40" y="150" width="18" height="60" rx="6" className="fill-surface-1" opacity="0.8" />
      <rect x="82" y="150" width="18" height="60" rx="6" className="fill-surface-1" opacity="0.8" />
      {/* Rear wing */}
      <rect x="24" y="352" width="92" height="10" rx="4" className="fill-accent/40 stroke-accent/60" strokeWidth="1" />
      {/* Exposed wheels sit further out than the chassis for an open-wheel look */}
      <Wheels inset={-2} width={26} />
    </svg>
  );
}
function NascarCar() {
  return (
    <svg viewBox="0 0 140 400" className="h-auto w-full" aria-hidden="true">
      <path
        d="M40,30 L100,30 L108,60 L110,320 L102,360 L38,360 L30,320 L32,60 Z"
        className="fill-accent/25 stroke-accent/50"
        strokeWidth="1.5"
      />
      <path d="M44,96 L96,96 L96,138 L44,138 Z" className="fill-surface-0/70" />
      <circle cx="70" cy="240" r="20" className="fill-surface-1" opacity="0.7" />
      {/* Rear wing */}
      <rect x="26" y="332" width="88" height="12" rx="3" className="fill-accent/40 stroke-accent/60" strokeWidth="1" />
      {/* Front splitter */}
      <rect x="30" y="22" width="80" height="8" rx="2" className="fill-accent/40 stroke-accent/60" strokeWidth="1" />
      <Wheels inset={5} width={22} />
    </svg>
  );
}

function BuggyCar() {
  return (
    <svg viewBox="0 0 140 400" className="h-auto w-full" aria-hidden="true">
      <path
        d="M44,90 Q70,76 96,90 L104,140 Q108,190 104,240 L96,290 Q70,304 44,290 L36,240 Q32,190 36,140 Z"
        className="fill-accent/25 stroke-accent/50"
        strokeWidth="1.5"
      />
      {/* Roll cage */}
      <path d="M50,110 L50,270 M90,110 L90,270 M50,120 L90,120 M50,260 L90,260" fill="none" className="stroke-ink-muted" strokeWidth="3" />
      <rect x="56" y="150" width="28" height="80" rx="6" className="fill-surface-1" opacity="0.8" />
      {/* Big knobby off-road tires, pushed further out and taller */}
      <rect x="-6" y="40" width="30" height="70" rx="10" className="fill-ink-muted" opacity="0.6" />
      <rect x="116" y="40" width="30" height="70" rx="10" className="fill-ink-muted" opacity="0.6" />
      <rect x="-6" y="290" width="30" height="70" rx="10" className="fill-ink-muted" opacity="0.6" />
      <rect x="116" y="290" width="30" height="70" rx="10" className="fill-ink-muted" opacity="0.6" />
    </svg>
  );
}

function TruckCar() {
  return (
    <svg viewBox="0 0 140 400" className="h-auto w-full" aria-hidden="true">
      {/* Cab */}
      <path
        d="M46,26 Q70,14 94,26 L102,54 Q106,66 104,80 L36,80 Q34,66 38,54 Z"
        className="fill-accent/25 stroke-accent/50"
        strokeWidth="1.5"
      />
      <path d="M48,36 L92,36 L96,64 L44,64 Z" className="fill-surface-0/70" />
      {/* Bed (open — outline only) */}
      <rect x="32" y="88" width="76" height="230" rx="6" className="fill-none stroke-accent/50" strokeWidth="1.5" />
      <line x1="32" y1="130" x2="108" y2="130" className="stroke-accent/30" strokeWidth="1" />
      <Wheels inset={4} width={22} />
    </svg>
  );
}

export function CarIcon({ style }: { style: string }) {
  switch (style as BodyStyle) {
    case "porsche":
      return <PorscheCar />;
    case "f1":
      return <F1Car />;
    case "nascar":
      return <NascarCar />;
    case "buggy":
      return <BuggyCar />;
    case "truck":
      return <TruckCar />;
    case "sports":
    default:
      return <SportsCar />;
  }
}
