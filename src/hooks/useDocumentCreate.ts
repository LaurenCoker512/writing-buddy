import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DocumentTypeValue } from "@/lib/documents";
import { storePrepopulateProposals } from "@/lib/prepopulate-store";
import type { DiffProposal } from "@/types/diff";
import type { NewDocumentState } from "@/components/sidebar/SidebarModals";

interface UseDocumentCreateOptions {
  onComplete: () => void;
  onTreeRefresh: () => void;
}

export function useDocumentCreate({ onComplete, onTreeRefresh }: UseDocumentCreateOptions) {
  const router = useRouter();

  const createDocument = useCallback(
    async (
      parent: NewDocumentState,
      type: DocumentTypeValue,
      name: string,
      sourceText?: string,
    ) => {
      const scopeBody =
        parent.parentType === "universe"
          ? { universeId: parent.parentId }
          : { storyId: parent.parentId };
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, ...scopeBody }),
      });
      onComplete();
      onTreeRefresh();

      if (sourceText && res.ok) {
        const created = (await res.json()) as { id: string };
        const prepopRes = await fetch("/api/ai/prepopulate-character", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: created.id, sourceText }),
        });
        if (prepopRes.ok) {
          const data = (await prepopRes.json()) as { proposals: DiffProposal[] };
          if (Array.isArray(data.proposals) && data.proposals.length > 0) {
            storePrepopulateProposals(created.id, data.proposals);
          }
        }
        router.push(`/dashboard/documents/${created.id}`);
      }
    },
    [router, onComplete, onTreeRefresh],
  );

  return { createDocument };
}
