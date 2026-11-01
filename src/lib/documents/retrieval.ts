import { db } from "@/lib/db/client";
import { estimateTokenCount } from "@/lib/utils/format";
import { DatabaseConnectionError, isDatabaseConnectionError } from "@/lib/utils/errors";
import type { Citation } from "@/types/chat";

export interface SearchChunksOptions {
  query: string;
  workspaceId: string;
  userId?: string;
  documentIds?: string[];
  maxTokens?: number;
  topK?: number;
  minScoreThreshold?: number;
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  tokenCount: number;
  score: number;
  citation: Citation;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  totalRetrieved: number;
  hasRelevantEvidence: boolean;
  queryTerms: string[];
  mode?: "lexical" | "attached_fallback" | "empty";
}

const STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
  "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
  "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
  "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had",
  "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
  "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd",
  "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself",
  "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off",
  "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over",
  "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so",
  "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
  "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
  "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
  "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
  "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
  "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
  "yours", "yourself", "yourselves", "tell", "show", "give", "find", "explain", "summarize",
  "list", "describe"
]);

/**
 * Tokenizes a query string into unique normalized search terms, filtering stopwords.
 */
export function extractQueryTerms(query: string): string[] {
  const normalized = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, " ")
    .trim();

  const words = normalized.split(/\s+/).filter((w) => w.length > 1);
  const filtered = words.filter((w) => !STOPWORDS.has(w));

  // If all words were stopwords (e.g. "what is that"), fall back to non-empty words
  const terms = filtered.length > 0 ? filtered : words;
  return Array.from(new Set(terms));
}

/**
 * Computes a lexical relevance score for a chunk against a query and set of query terms.
 */
export function scoreChunk(
  content: string,
  docName: string,
  query: string,
  queryTerms: string[],
): number {
  if (!content || queryTerms.length === 0) return 0;

  const contentLower = content.toLowerCase();
  const queryLower = query.toLowerCase().trim();
  const docNameLower = docName.toLowerCase();
  const words = contentLower.split(/\s+/);

  let score = 0;
  let matchedTermsCount = 0;

  // 1. Exact phrase match bonus
  if (queryLower.length > 3 && contentLower.includes(queryLower)) {
    score += 15.0;
  }

  // 2. Keyword occurrences & Term Frequency (TF)
  for (const term of queryTerms) {
    let count = 0;
    let pos = contentLower.indexOf(term);
    while (pos !== -1) {
      count++;
      pos = contentLower.indexOf(term, pos + term.length);
    }

    if (count > 0) {
      matchedTermsCount++;
      // Diminishing returns on term frequency (log/sqrt scale)
      const tfScore = Math.min(count, 5) * 2.0 + Math.sqrt(count);
      score += tfScore;

      // Word boundary match bonus (exact whole word)
      const wholeWordRegex = new RegExp(`\\b${term}\\b`, "i");
      if (wholeWordRegex.test(contentLower)) {
        score += 1.5;
      }
    }
  }

  // If no query terms matched at all, return 0 immediately
  if (matchedTermsCount === 0) {
    return 0;
  }

  // 3. Multi-term coverage bonus (coverage ratio)
  const coverageRatio = matchedTermsCount / queryTerms.length;
  score += coverageRatio * 8.0;

  if (matchedTermsCount === queryTerms.length && queryTerms.length > 1) {
    score += 6.0; // All query terms present
  }

  // 4. Heading match bonus
  const headingMatches = contentLower.match(/^#{1,6}\s+.*$/gm);
  if (headingMatches) {
    for (const heading of headingMatches) {
      for (const term of queryTerms) {
        if (heading.includes(term)) {
          score += 3.5;
        }
      }
    }
  }

  // 5. Document title match bonus
  for (const term of queryTerms) {
    if (docNameLower.includes(term)) {
      score += 2.0;
    }
  }

  // 6. Proximity bonus: check if any two distinct query terms appear within 25 words of each other
  if (queryTerms.length >= 2 && matchedTermsCount >= 2) {
    const termPositions: Array<{ term: string; index: number }> = [];
    words.forEach((word, idx) => {
      for (const term of queryTerms) {
        if (word.includes(term)) {
          termPositions.push({ term, index: idx });
          break;
        }
      }
    });

    for (let i = 0; i < termPositions.length - 1; i++) {
      const a = termPositions[i];
      const b = termPositions[i + 1];
      if (a.term !== b.term && Math.abs(a.index - b.index) <= 25) {
        score += 3.0;
        break;
      }
    }
  }

  return Math.round(score * 100) / 100;
}

/**
 * Searches and ranks document chunks based on lexical term matching and document relevance.
 * Enforces strict workspace isolation and returns grounded citations.
 */
export async function searchDocumentChunks(
  options: SearchChunksOptions
): Promise<RetrievalResult> {
  const {
    query,
    workspaceId,
    documentIds,
    maxTokens = 4000,
    topK = 8,
    minScoreThreshold = 1.0,
  } = options;

  const hasSpecificDocScope = Array.isArray(documentIds) && documentIds.length > 0;
  const queryTerms = extractQueryTerms(query);

  if ((queryTerms.length === 0 || !query.trim()) && !hasSpecificDocScope) {
    return {
      chunks: [],
      totalRetrieved: 0,
      hasRelevantEvidence: false,
      queryTerms: [],
      mode: "empty",
    };
  }

  // Strict tenant isolation: select documents belonging to the workspace
  let documents: Array<{
    id: string;
    name: string;
    chunks: Array<{
      id: string;
      documentId: string;
      index: number;
      content: string;
      pageNumber: number | null;
      metadata: unknown;
    }>;
  }> = [];

  try {
    documents = await db.document.findMany({
      where: {
        workspaceId,
        status: "READY",
        ...(hasSpecificDocScope
          ? { id: { in: documentIds } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        chunks: {
          select: {
            id: true,
            documentId: true,
            index: true,
            content: true,
            pageNumber: true,
            metadata: true,
          },
          orderBy: { index: "asc" },
        },
      },
    });
  } catch (dbErr) {
    if (isDatabaseConnectionError(dbErr)) {
      throw new DatabaseConnectionError();
    }
    throw dbErr;
  }

  if (documents.length === 0) {
    return {
      chunks: [],
      totalRetrieved: 0,
      hasRelevantEvidence: false,
      queryTerms,
      mode: "empty",
    };
  }

  const scoredChunks: RetrievedChunk[] = [];
  let mode: "lexical" | "attached_fallback" | "empty" = "empty";

  // 1. First attempt lexical search if query terms exist
  if (queryTerms.length > 0) {
    for (const doc of documents) {
      for (const chunk of doc.chunks) {
        const score = scoreChunk(chunk.content, doc.name, query, queryTerms);

        if (score >= minScoreThreshold) {
          const tokenCount =
            (chunk.metadata as { tokenCount?: number })?.tokenCount ||
            estimateTokenCount(chunk.content);

          const snippet = chunk.content
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 160);

          scoredChunks.push({
            id: chunk.id,
            documentId: chunk.documentId,
            documentName: doc.name,
            chunkIndex: chunk.index,
            content: chunk.content,
            pageNumber: chunk.pageNumber ?? undefined,
            tokenCount,
            score,
            citation: {
              documentId: chunk.documentId,
              documentName: doc.name,
              chunkIndex: chunk.index,
              pageNumber: chunk.pageNumber ?? undefined,
              snippet: snippet.length >= 160 ? `${snippet}...` : snippet,
            },
          });
        }
      }
    }
  }

  if (scoredChunks.length > 0) {
    mode = "lexical";
    // Sort by relevance score descending
    scoredChunks.sort((a, b) => b.score - a.score);
  } else if (hasSpecificDocScope) {
    // 2. Fallback for explicitly attached documents when lexical hits yield 0
    // (e.g. broad/exploratory/summary queries like "Summarize this", "What is this file?").
    // Provide document chunks in sequential order so the model receives real context.
    mode = "attached_fallback";
    for (const doc of documents) {
      for (const chunk of doc.chunks) {
        const tokenCount =
          (chunk.metadata as { tokenCount?: number })?.tokenCount ||
          estimateTokenCount(chunk.content);

        const snippet = chunk.content
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 160);

        scoredChunks.push({
          id: chunk.id,
          documentId: chunk.documentId,
          documentName: doc.name,
          chunkIndex: chunk.index,
          content: chunk.content,
          pageNumber: chunk.pageNumber ?? undefined,
          tokenCount,
          score: 1.0,
          citation: {
            documentId: chunk.documentId,
            documentName: doc.name,
            chunkIndex: chunk.index,
            pageNumber: chunk.pageNumber ?? undefined,
            snippet: snippet.length >= 160 ? `${snippet}...` : snippet,
          },
        });
      }
    }
  }

  // Apply top-K limit and token budget
  const selectedChunks: RetrievedChunk[] = [];
  let currentTokens = 0;

  for (const chunk of scoredChunks) {
    if (selectedChunks.length >= topK) break;
    if (currentTokens + chunk.tokenCount > maxTokens && selectedChunks.length > 0) {
      continue;
    }
    selectedChunks.push(chunk);
    currentTokens += chunk.tokenCount;
  }

  return {
    chunks: selectedChunks,
    totalRetrieved: selectedChunks.length,
    hasRelevantEvidence: selectedChunks.length > 0,
    queryTerms,
    mode: selectedChunks.length > 0 ? mode : "empty",
  };
}
