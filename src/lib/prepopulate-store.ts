import type { DiffProposal } from "@/types/diff";

const store = new Map<string, DiffProposal[]>();

export function storePrepopulateProposals(documentId: string, proposals: DiffProposal[]): void {
  store.set(documentId, proposals);
}

export function consumePrepopulateProposals(documentId: string): DiffProposal[] {
  const proposals = store.get(documentId) ?? [];
  store.delete(documentId);
  return proposals;
}
