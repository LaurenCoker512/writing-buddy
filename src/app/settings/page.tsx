import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ApiKeyForm from "./ApiKeyForm";
import DeleteAccountButton from "./DeleteAccountButton";

export default async function SettingsPage() {
  const session = await auth();

  if (session === null) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user?.id },
    select: { openRouterKey: true, anthropicKey: true, aiProvider: true },
  });

  const hasOpenRouterKey = user?.openRouterKey !== null && user?.openRouterKey !== undefined;
  const hasAnthropicKey = user?.anthropicKey !== null && user?.anthropicKey !== undefined;
  const activeProvider = user?.aiProvider ?? "OPENROUTER";

  return (
    <main className="flex min-h-screen flex-col p-8">
      <header className="mb-12">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Settings</h1>
      </header>

      <div className="mx-auto w-full max-w-lg space-y-12">
        <ApiKeyForm
          hasOpenRouterKey={hasOpenRouterKey}
          hasAnthropicKey={hasAnthropicKey}
          activeProvider={activeProvider}
        />
        <hr className="border-border" />
        <DeleteAccountButton />
      </div>
    </main>
  );
}
