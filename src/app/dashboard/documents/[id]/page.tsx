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
      story: { select: { userId: true } },
      series: { select: { userId: true } },
      universe: { select: { userId: true } },
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

  return (
    <DocumentWorkspace
      documentId={document.id}
      documentName={document.name}
      documentType={document.type}
      initialJson={tiptapJson}
      initialMeta={initialMeta}
    />
  );
}
