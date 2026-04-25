import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const displayName =
    session.user?.name ?? session.user?.email ?? "Writer";

  return (
    <DashboardShell displayName={displayName}>{children}</DashboardShell>
  );
}
