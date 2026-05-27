import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
});

export const COLLECTION_NAME =
  process.env.COLLECTION_NAME;

export async function createCollection() {
  try {
    const collections =
      await qdrant.getCollections();

    const exists =
      collections.collections.find(
        (c) => c.name === COLLECTION_NAME
      );

    if (!exists) {
      await qdrant.createCollection(
        COLLECTION_NAME,
        {
          vectors: {
            size: 3072,
            distance: "Cosine",
          },
        }
      );

      console.log("Collection created");
    } else {
      console.log("Collection already exists");
    }
  } catch (error) {
    console.log(error);
  }
}