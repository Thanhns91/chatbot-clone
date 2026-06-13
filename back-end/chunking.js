export function semanticChunk(text, options = {}) {
  const maxChars = options.maxChars || 1000;
  const overlapChars = options.overlapChars || 180;

  const cleanText = String(text || "")
    .replace(/\r/g, "")
    .replace(/-\n/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!cleanText) return [];

  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  const getTailByWords = (source, limit) => {
    const words = source.trim().split(/\s+/);
    const tail = [];
    let total = 0;

    for (let i = words.length - 1; i >= 0; i--) {
      total += words[i].length + 1;
      if (total > limit) break;
      tail.unshift(words[i]);
    }

    return tail.join(" ").trim();
  };

  const splitSentences = (paragraph) => {
    const sentences = paragraph.match(/[^.!?。！？;:]+[.!?。！？;:]?/g);
    return sentences?.map((s) => s.trim()).filter(Boolean) || [paragraph];
  };

  const splitLongTextByWords = (longText) => {
    const words = longText.split(/\s+/).filter(Boolean);
    const result = [];

    let start = 0;

    while (start < words.length) {
      let end = start;
      let length = 0;

      while (end < words.length && length + words[end].length + 1 <= maxChars) {
        length += words[end].length + 1;
        end++;
      }

      if (end === start) end++;

      const chunk = words.slice(start, end).join(" ").trim();
      if (chunk) result.push(chunk);

      if (end >= words.length) break;

      let overlapStart = end;
      let overlapLength = 0;

      while (overlapStart > start && overlapLength < overlapChars) {
        overlapStart--;
        overlapLength += words[overlapStart].length + 1;
      }

      start = Math.max(overlapStart, start + 1);
    }

    return result;
  };

  const pushCurrent = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = "";
  };

  for (const paragraph of paragraphs) {
    const sentences = splitSentences(paragraph);

    for (const sentence of sentences) {
      if (sentence.length > maxChars) {
        pushCurrent();

        const longChunks = splitLongTextByWords(sentence);
        chunks.push(...longChunks);
        continue;
      }

      if (!current) {
        current = sentence;
        continue;
      }

      const next = `${current} ${sentence}`.trim();

      if (next.length <= maxChars) {
        current = next;
      } else {
        const tail = getTailByWords(current, overlapChars);
        chunks.push(current.trim());
        current = tail ? `${tail} ${sentence}`.trim() : sentence;
      }
    }
  }

  pushCurrent();

  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 30);
}