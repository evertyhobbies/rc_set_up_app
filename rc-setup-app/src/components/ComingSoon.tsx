import Link from "next/link";

export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-surface-0 px-5 text-center">
      <h1 className="text-lg font-medium text-ink-primary">{title}</h1>
      <p className="text-sm text-ink-secondary">Coming soon. Model Select is being built first.</p>
      <Link href="/" className="mt-2 text-sm text-accent">‹ Home</Link>
    </main>
  );
}
