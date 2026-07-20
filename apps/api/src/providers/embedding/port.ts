/**
 * Text embedding capability — turns text into a dense vector for semantic search
 * (docs/media-library-design.md §4). Vendor-neutral. The active model's `dim`
 * MUST match the pgvector column width in @bingoo/db (media_embedding.embedding
 * = vector(1536)); the media enrichment pipeline and search adapter both rely on
 * this equality, so switching to a model of a different width needs a migration.
 */
export interface EmbedInput {
  texts: string[];
  model?: string;
}

export interface EmbedResult {
  vectors: number[][];
  model: string;
  dim: number;
}

export interface EmbeddingPort {
  /** Native dimension of the active model (equals the DB vector width). */
  readonly dim: number;
  embed(input: EmbedInput): Promise<EmbedResult>;
}
