export function semanticChunk(text) {
  // 1. Làm sạch text
  const cleanText = text
    .replace(/\r/g, "")
    .replace(/-\n/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  // 2. Tách theo đoạn văn
  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 50);

  const chunks = [];

  const maxLength = 900;
  const overlap = 150;

  let currentChunk = "";

  for (const paragraph of paragraphs) {
    // 3. Nếu đoạn còn vừa thì gom vào chunk hiện tại
    if ((currentChunk + " " + paragraph).length <= maxLength) {
      currentChunk += " " + paragraph;
    } else {
      // 4. Đẩy chunk cũ vào list
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      // 5. Nếu paragraph quá dài thì cắt nhỏ có overlap
      if (paragraph.length > maxLength) {
        let start = 0;

        while (start < paragraph.length) {
          const chunk = paragraph
            .slice(start, start + maxLength)
            .trim();

          if (chunk.length > 100) {
            chunks.push(chunk);
          }

          start += maxLength - overlap;
        }

        currentChunk = "";
      } else {
        currentChunk = paragraph;
      }
    }
  }

  // 6. Thêm chunk cuối
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}