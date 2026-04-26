import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import dynamic from "next/dynamic";

const RelationshipMap = dynamic(() => import("@/components/RelationshipMap"), {
  ssr: false,
});

type Props = { params: { universeId: string } };

function isMobileUserAgent(ua: string): boolean {
  return /Mobi|Android|iPhone|iPad/i.test(ua);
}

export default async function UniverseMapPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const universe = await prisma.universe.findFirst({
    where: { id: params.universeId, userId: session.user.id },
  });

  if (!universe) notFound();

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";
  const isMobile = isMobileUserAgent(userAgent);

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <RelationshipMap
        storyId={null}
        universeId={universe.id}
        storyName={universe.name}
        universeName={universe.name}
        isMobile={isMobile}
      />
    </div>
  );
}
