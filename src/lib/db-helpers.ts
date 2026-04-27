import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";

export async function findOwnedDocument(id: string, userId: string) {
  const document = await prisma.document.findFirst({
    where: { id },
    include: {
      story: { select: { userId: true, mode: true, rating: true } },
      series: { select: { userId: true, mode: true, rating: true } },
      universe: { select: { userId: true, mode: true, rating: true } },
    },
  });
  if (!document) return null;
  const owner = document.story ?? document.series ?? document.universe;
  if (!owner || owner.userId !== userId) return null;
  return document;
}

export async function createVersionWithCap(
  documentId: string,
  tiptapJson: Prisma.InputJsonValue,
  label?: string,
) {
  const count = await prisma.documentVersion.count({ where: { documentId } });
  if (count >= AI_CONFIG.DOCUMENT_VERSION_CAP) {
    const oldest = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (oldest) {
      await prisma.documentVersion.delete({ where: { id: oldest.id } });
    }
  }
  return prisma.documentVersion.create({
    data: { documentId, tiptapJson, label },
  });
}
