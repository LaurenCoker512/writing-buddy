import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="font-heading text-5xl font-bold text-text-primary">
        Writing Buddy
      </h1>
      <p className="text-lg text-text-muted">
        AI-powered creative planning for fiction writers.
      </p>
      <div className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded bg-accent px-6 py-2 text-white hover:bg-accent-hover transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/settings"
          className="rounded border border-accent px-6 py-2 text-accent hover:bg-surface transition-colors"
        >
          Settings
        </Link>
      </div>
    </main>
  );
}
