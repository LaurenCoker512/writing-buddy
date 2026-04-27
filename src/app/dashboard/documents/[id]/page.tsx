import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DocumentWorkspace from "./DocumentWorkspace";

type Props = { params: { id: string } };

export default async function DocumentPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const document = await prisma.document.findFirst({
    where: { id: params.id },
    include: {
      story: { select: { userId: true, universeId: true, seriesId: true } },
      series: { select: { userId: true, universeId: true } },
      universe: { select: { userId: true } },
      parent: { select: { id: true, name: true } },
    },
  });

  if (!document) notFound();

  const ownerId =
    document.story?.userId ?? document.series?.userId ?? document.universe?.userId;
  if (ownerId !== session.user.id) notFound();

  const tiptapJson =
    document.tiptapJson !== null && typeof document.tiptapJson === "object"
      ? (document.tiptapJson as object)
      : { type: "doc", content: [] };

  const initialMeta =
    document.meta !== null &&
    typeof document.meta === "object" &&
    !Array.isArray(document.meta)
      ? (document.meta as Record<string, unknown>)
      : null;

  // Resolve the universe that owns this document (for specialization candidates)
  const universeId =
    document.universeId ??
    document.story?.universeId ??
    document.series?.universeId ??
    null;

  // Fetch universe-level documents of the same type as parent candidates,
  // but only when the current document is story-scoped (specialization is story→universe)
  let parentCandidates: { id: string; name: string }[] = [];
  if (document.storyId !== null && universeId !== null) {
    parentCandidates = await prisma.document.findMany({
      where: { universeId, type: document.type },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <DocumentWorkspace
      documentId={document.id}
      documentName={document.name}
      documentType={document.type}
      initialJson={tiptapJson}
      initialMeta={initialMeta}
      storyId={document.storyId}
      parentDocumentId={document.parentDocumentId}
      parentDocumentName={document.parent?.name ?? null}
      parentCandidates={parentCandidates}
    />
  );
}
