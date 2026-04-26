export interface DiffProposal {
  id: string;
  heading: string | null;
  headingLevel: number;
  beforeMarkdown: string;
  newMarkdown: string;
  isNew: boolean;
}
