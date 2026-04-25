import { auth } from "@/auth";
import { signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (session === null) {
    redirect("/signin");
  }

  const displayName = session.user?.name ?? session.user?.email ?? "Writer";

  return (
    <main className="flex min-h-screen flex-col p-8">
      <header className="mb-12 flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-text-primary">
          Writing Buddy
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-muted">{displayName}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded border border-border px-3 py-1 text-sm text-text-muted transition-colors hover:bg-surface"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-xl font-medium text-text-primary">
          No projects yet.
        </p>
        <p className="text-text-muted">
          Create your first universe, series, or story to get started.
        </p>
      </div>
    </main>
  );
}
