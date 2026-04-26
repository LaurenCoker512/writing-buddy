export interface DiffProposal {
  id: string;
  heading: string | null;
  headingLevel: number;
  beforeMarkdown: string;
  newMarkdown: string;
  isNew: boolean;
}

export interface CanonProposal {
  id: string;
  documentName: string;
  documentType: "CHARACTER" | "WORLDBUILDING";
  markdown: string;
}
