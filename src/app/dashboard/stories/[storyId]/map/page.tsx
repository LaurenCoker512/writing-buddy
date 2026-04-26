import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import dynamic from "next/dynamic";

const RelationshipMap = dynamic(() => import("@/components/RelationshipMap"), {
  ssr: false,
});

type Props = { params: { storyId: string } };

function isMobileUserAgent(ua: string): boolean {
  return /Mobi|Android|iPhone|iPad/i.test(ua);
}

export default async function StoryMapPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const story = await prisma.story.findFirst({
    where: { id: params.storyId, userId: session.user.id },
    include: {
      universe: { select: { id: true, name: true } },
    },
  });

  if (!story) notFound();

  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";
  const isMobile = isMobileUserAgent(userAgent);

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <RelationshipMap
        storyId={story.id}
        universeId={story.universe?.id ?? null}
        storyName={story.name}
        universeName={story.universe?.name ?? null}
        isMobile={isMobile}
      />
    </div>
  );
}
