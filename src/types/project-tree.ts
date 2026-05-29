export interface SubcategoryItem {
  id: string;
  name: string;
  documentType: string;
  order: number | null;
}

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  order: number | null;
  parentDocumentId: string | null;
  meta: Record<string, unknown> | null;
  subcategoryId: string | null;
}

export interface StoryItem {
  id: string;
  name: string;
  mode: string;
  rating: string;
  order: number | null;
  seriesId: string | null;
  universeId: string | null;
  documents: DocumentItem[];
  subcategories: SubcategoryItem[];
}

export interface SeriesItem {
  id: string;
  name: string;
  mode: string;
  rating: string;
  stories: StoryItem[];
  documents: DocumentItem[];
  subcategories: SubcategoryItem[];
}

export interface UniverseItem {
  id: string;
  name: string;
  mode: string;
  rating: string;
  series: SeriesItem[];
  stories: StoryItem[];
  documents: DocumentItem[];
  subcategories: SubcategoryItem[];
}

export interface ProjectTree {
  universes: UniverseItem[];
  standaloneSeries: SeriesItem[];
  standaloneStories: StoryItem[];
}

export type NodeType = "universe" | "series" | "story" | "document" | "subcategory";
