import { prisma } from "@/lib/prisma";

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
