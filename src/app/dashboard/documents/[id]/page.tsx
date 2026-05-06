import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DocumentWorkspace from "./DocumentWorkspace";

type Props = { params: { id: string } };

function parseTiptapJson(raw: unknown): object {
  return raw !== null && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as object)
    : { type: "doc", content: [] };
}

export default async function DocumentPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const document = await prisma.document.findFirst({
    where: { id: params.id },
    include: {
      story: { select: { userId: true, universeId: true, seriesId: true } },
      series: { select: { userId: true, universeId: true } },
      universe: { select: { userId: true } },
      parent: {
        select: {
          id: true,
          name: true,
          tiptapJson: true,
          storyId: true,
          seriesId: true,
          universeId: true,
          parent: {
            select: {
              id: true,
              name: true,
              tiptapJson: true,
              storyId: true,
              seriesId: true,
              universeId: true,
            },
          },
        },
      },
    },
  });

  if (!document) notFound();

  const ownerId =
    document.story?.userId ?? document.series?.userId ?? document.universe?.userId;
  if (ownerId !== session.user.id) notFound();

  const tiptapJson = parseTiptapJson(document.tiptapJson);

  const initialMeta =
    document.meta !== null &&
    typeof document.meta === "object" &&
    !Array.isArray(document.meta)
      ? (document.meta as Record<string, unknown>)
      : null;

  const universeId =
    document.universeId ??
    document.story?.universeId ??
    document.series?.universeId ??
    null;

  // Build parent view chain for the scope-switcher tabs.
  // Each entry is a higher-level document the user can read (but not edit).
  type ParentView = { id: string; name: string; tiptapJson: object; label: string };
  const parentViews: ParentView[] = [];

  if (document.parent) {
    const p = document.parent;
    const pLabel =
      p.storyId === null && p.seriesId !== null ? "Series"
      : p.storyId === null && p.seriesId === null ? "Full Universe"
      : "Parent";
    parentViews.push({ id: p.id, name: p.name, tiptapJson: parseTiptapJson(p.tiptapJson), label: pLabel });

    if (p.parent) {
      const gp = p.parent;
      parentViews.push({
        id: gp.id,
        name: gp.name,
        tiptapJson: parseTiptapJson(gp.tiptapJson),
        label: "Full Universe",
      });
    }
  }

  const currentLabel =
    document.storyId !== null ? "This Story"
    : document.seriesId !== null ? "This Series"
    : "This Universe";

  // Parent candidates for the specialization selector.
  // Story-scoped: series-level docs in the same series + universe-level docs.
  // Series-scoped: universe-level docs.
  type ParentCandidate = { id: string; name: string; scopeLabel: string };
  let parentCandidates: ParentCandidate[] = [];

  if (document.storyId !== null) {
    const storySeriesId = document.story?.seriesId ?? null;
    if (storySeriesId !== null) {
      const seriesDocs = await prisma.document.findMany({
        where: { seriesId: storySeriesId, storyId: null, type: document.type },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      parentCandidates = seriesDocs.map((d) => ({ ...d, scopeLabel: "Series" }));
    }
    if (universeId !== null) {
      const universeDocs = await prisma.document.findMany({
        where: { universeId, storyId: null, seriesId: null, type: document.type },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      parentCandidates = [...parentCandidates, ...universeDocs.map((d) => ({ ...d, scopeLabel: "Universe" }))];
    }
  } else if (document.seriesId !== null && universeId !== null) {
    const universeDocs = await prisma.document.findMany({
      where: { universeId, storyId: null, seriesId: null, type: document.type },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    parentCandidates = universeDocs.map((d) => ({ ...d, scopeLabel: "Universe" }));
  }

  return (
    <DocumentWorkspace
      documentId={document.id}
      documentName={document.name}
      documentType={document.type}
      initialJson={tiptapJson}
      initialMeta={initialMeta}
      storyId={document.storyId}
      seriesId={document.seriesId}
      universeId={universeId}
      parentDocumentId={document.parentDocumentId}
      parentDocumentName={document.parent?.name ?? null}
      parentCandidates={parentCandidates}
      parentViews={parentViews}
      currentLabel={currentLabel}
    />
  );
}
