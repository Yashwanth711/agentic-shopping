// Run: npx tsx scripts/generate-embeddings.ts
// Generates embeddings for all products using Gemini embedding API
// Output: src/data/product-embeddings.json

import { products } from "../src/data/products";
import * as fs from "fs";
import * as path from "path";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error("Set GEMINI_API_KEY env var");
  process.exit(1);
}

// Convert product to a searchable text string
function productToText(p: typeof products[0]): string {
  return `${p.name} | ${p.category} | ₹${p.price} | ${p.color} | ${p.fabric} | ${p.tags.join(", ")} | ${p.occasion.join(", ")} | ${p.style} | ${p.description}`;
}

// Batch embed using Gemini
async function batchEmbed(texts: string[]): Promise<number[][]> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-exp-03-07:batchEmbedContents?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map(text => ({
          model: "models/gemini-embedding-exp-03-07",
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_DOCUMENT",
        })),
      }),
    }
  );

  const data = await response.json();
  if (data.error) {
    throw new Error(`Gemini embedding error: ${JSON.stringify(data.error)}`);
  }

  return data.embeddings.map((e: { values: number[] }) => e.values);
}

async function main() {
  console.log(`Generating embeddings for ${products.length} products...`);

  const BATCH_SIZE = 50; // Gemini allows up to 100 per batch
  const allEmbeddings: { id: string; embedding: number[] }[] = [];

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const texts = batch.map(productToText);

    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(products.length / BATCH_SIZE)} (${batch.length} products)...`);

    const embeddings = await batchEmbed(texts);

    for (let j = 0; j < batch.length; j++) {
      allEmbeddings.push({
        id: batch[j].id,
        embedding: embeddings[j],
      });
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < products.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Save to JSON
  const outputPath = path.join(__dirname, "..", "src", "data", "product-embeddings.json");
  fs.writeFileSync(outputPath, JSON.stringify(allEmbeddings));

  const fileSizeKB = Math.round(fs.statSync(outputPath).size / 1024);
  console.log(`\nDone! Saved ${allEmbeddings.length} embeddings to product-embeddings.json (${fileSizeKB}KB)`);
  console.log(`Embedding dimension: ${allEmbeddings[0].embedding.length}`);
}

main().catch(console.error);
