import { products } from "@/data/products";

interface ProductEmbedding {
  id: string;
  embedding: number[];
}

let cachedEmbeddings: ProductEmbedding[] | null = null;

// Load embeddings lazily
function getEmbeddings(): ProductEmbedding[] {
  if (cachedEmbeddings) return cachedEmbeddings;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedEmbeddings = require("@/data/product-embeddings.json") as ProductEmbedding[];
    return cachedEmbeddings;
  } catch {
    return [];
  }
}

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Embed a query using Gemini
async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_QUERY",
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(`Embedding error: ${data.error.message}`);
  return data.embedding.values;
}

// Search products using RAG
export async function searchProducts(
  query: string,
  apiKey: string,
  topK: number = 8
): Promise<typeof products[number][]> {
  const embeddings = getEmbeddings();

  // If no embeddings file, fall back to returning empty (caller uses full catalog)
  if (embeddings.length === 0) {
    console.warn("No product embeddings found — falling back to full catalog");
    return [];
  }

  // Embed the user query
  const queryEmbedding = await embedQuery(query, apiKey);

  // Calculate similarity scores
  const scores = embeddings.map(pe => ({
    id: pe.id,
    score: cosineSimilarity(queryEmbedding, pe.embedding),
  }));

  // Sort by similarity, take top K
  scores.sort((a, b) => b.score - a.score);
  const topIds = scores.slice(0, topK).map(s => s.id);

  // Return full product objects in ranked order
  return topIds
    .map(id => products.find(p => p.id === id))
    .filter((p): p is typeof products[number] => !!p);
}
