export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  order: number | null;
  parentDocumentId: string | null;
}

export interface StoryItem {
  id: string;
  name: string;
  mode: string;
  rating: string;
  documents: DocumentItem[];
}

export interface SeriesItem {
  id: string;
  name: string;
  mode: string;
  rating: string;
  stories: StoryItem[];
}

export interface UniverseItem {
  id: string;
  name: string;
  mode: string;
  rating: string;
  series: SeriesItem[];
  stories: StoryItem[];
}

export interface ProjectTree {
  universes: UniverseItem[];
  standaloneSeries: SeriesItem[];
  standaloneStories: StoryItem[];
}

export type NodeType = "universe" | "series" | "story" | "document";
