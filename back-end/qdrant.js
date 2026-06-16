import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

export const COLLECTION_NAME =
  process.env.COLLECTION_NAME || "rag_documents_hf";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

export async function createCollection() {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === COLLECTION_NAME
  );

  if (exists) {
    console.log(`Qdrant collection "${COLLECTION_NAME}" already exists`);
    return;
  }

  await qdrant.createCollection(COLLECTION_NAME, {
    vectors: {
      size: 384,
      distance: "Cosine",
    },
  });

  console.log(`Qdrant collection "${COLLECTION_NAME}" created`);
}