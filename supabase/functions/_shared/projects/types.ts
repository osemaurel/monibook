/** Everything a generation knows about the project: the forms never ask for it again. */
export interface ProjectContext {
  id: string;
  userId: string;
  name: string;
  niche: string | null;
  angle: string | null;
  audience: string | null;
  promise: string | null;
  priceFcfa: number | null;
  language: "fr" | "en";
  benefits: string[];
  callToAction: string | null;
  guarantee: string | null;
  coverPath: string | null;
  /** The ebook of the project, when it has one. */
  product: ProductContext | null;
}

export interface ProductContext {
  title: string;
  subtitle: string | null;
  author: string | null;
  summary: string | null;
  chapterTitles: string[];
  coverPath: string | null;
}

export interface ProjectStore {
  /** Null when the project does not exist or was deleted. */
  getContext(projectId: string): Promise<ProjectContext | null>;
}
