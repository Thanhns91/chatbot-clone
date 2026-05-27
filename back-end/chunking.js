export function semanticChunk(text, maxLength = 1000) {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length > maxLength) {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    } else {
      currentChunk += "\n" + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}