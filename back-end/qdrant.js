import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
});

export const COLLECTION_NAME = process.env.COLLECTION_NAME;

export async function createCollection() {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.find(
    (c) => c.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 384,
        distance: "Cosine",
      },
    });

    console.log("HF collection created");
  } else {
    console.log("HF collection already exists");
  }
}