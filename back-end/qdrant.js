import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

dotenv.config();

export const COLLECTION_NAME =
  process.env.COLLECTION_NAME || "rag_documents_hf";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
});

async function ensurePayloadIndex(fieldName) {
  try {
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);

    const payloadSchema = collectionInfo.payload_schema || {};

    if (payloadSchema[fieldName]) {
      console.log(`Qdrant payload index "${fieldName}" already exists`);
      return;
    }

    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: fieldName,
      field_schema: "keyword",
      wait: true,
    });

    console.log(`Qdrant payload index "${fieldName}" created`);
  } catch (error) {
    console.log(
      `Cannot create payload index "${fieldName}":`,
      error.message
    );
  }
}

export async function createCollection() {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === COLLECTION_NAME
  );

  if (!exists) {
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: 384,
        distance: "Cosine",
      },
    });

    console.log(`Qdrant collection "${COLLECTION_NAME}" created`);
  } else {
    console.log(`Qdrant collection "${COLLECTION_NAME}" already exists`);
  }

  await ensurePayloadIndex("documentId");
  await ensurePayloadIndex("vectorDocumentId");
  await ensurePayloadIndex("uploadedBy");

  console.log("Qdrant collection ready");
}