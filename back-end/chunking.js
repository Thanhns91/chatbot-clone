export function semanticChunk(text, options = {}) {
  const maxChars = options.maxChars || 2200;
  const overlapChars = options.overlapChars || 120;
  const minChars = options.minChars || 80;

  const rawText = String(text || "")
    .replace(/\r/g, "")
    .replace(/-\n/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (!rawText) return [];

  const normalizeForCompare = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();

  const isHeading = (line = "") => {
    const value = line.trim();

    if (!value) return false;
    if (value.length > 120) return false;

    return (
      /^#{1,6}\s+/.test(value) ||
      /^chapter\s+\d+/i.test(value) ||
      /^section\s+\d+/i.test(value) ||
      /^part\s+\d+/i.test(value) ||
      /^bài\s+\d+/i.test(value) ||
      /^chương\s+\d+/i.test(value) ||
      /^mục\s+\d+/i.test(value) ||
      /^\d+(\.\d+)*\s+[\p{L}\p{N}]/u.test(value) ||
      /^[A-ZÀ-Ỹ0-9][A-ZÀ-Ỹ0-9\s:–—-]{4,}$/.test(value)
    );
  };

  const splitByPages = (input) => {
    const pageRegex =
      /(?:^|\n)\s*(?:={2,}\s*)?(?:PAGE|Page|page|TRANG|Trang|trang)\s+(\d+)(?:\s*={2,})?\s*(?:\n|$)/g;

    const matches = [...input.matchAll(pageRegex)];

    if (matches.length === 0) {
      return [
        {
          page: null,
          text: input,
        },
      ];
    }

    const pages = [];

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const next = matches[i + 1];

      const page = Number(current[1]);
      const start = current.index + current[0].length;
      const end = next ? next.index : input.length;

      const pageText = input.slice(start, end).trim();

      if (pageText) {
        pages.push({
          page,
          text: pageText,
        });
      }
    }

    return pages.length > 0
      ? pages
      : [
          {
            page: null,
            text: input,
          },
        ];
  };

  const splitSentences = (paragraph) => {
    const sentences = String(paragraph || "").match(
      /[^.!?。！？]+[.!?。！？]?/g,
    );

    return sentences?.map((s) => s.trim()).filter(Boolean) || [paragraph];
  };

  const getTailByWords = (source, limit) => {
    const words = String(source || "").trim().split(/\s+/);
    const tail = [];
    let total = 0;

    for (let i = words.length - 1; i >= 0; i--) {
      total += words[i].length + 1;

      if (total > limit) break;

      tail.unshift(words[i]);
    }

    return tail.join(" ").trim();
  };

  const splitLongTextByWords = (longText) => {
    const words = String(longText || "").split(/\s+/).filter(Boolean);
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

  const pages = splitByPages(rawText);
  const chunks = [];

  for (const pageBlock of pages) {
    const lines = pageBlock.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let currentHeading = "";
    let paragraphBuffer = [];

    const flushParagraph = () => {
      if (paragraphBuffer.length === 0) return null;

      const paragraph = paragraphBuffer.join(" ").replace(/\s+/g, " ").trim();
      paragraphBuffer = [];

      return paragraph;
    };

    const blocks = [];

    for (const line of lines) {
      if (isHeading(line)) {
        const paragraph = flushParagraph();

        if (paragraph) {
          blocks.push({
            heading: currentHeading,
            text: paragraph,
          });
        }

        currentHeading = line.replace(/^#{1,6}\s+/, "").trim();

        blocks.push({
          heading: currentHeading,
          text: currentHeading,
          isHeadingOnly: true,
        });
      } else {
        paragraphBuffer.push(line);
      }
    }

    const lastParagraph = flushParagraph();

    if (lastParagraph) {
      blocks.push({
        heading: currentHeading,
        text: lastParagraph,
      });
    }

    let current = "";

    const prefixParts = [];

    if (pageBlock.page) {
      prefixParts.push(`[PAGE ${pageBlock.page}]`);
    }

    const basePrefix = prefixParts.join(" ");

    const pushCurrent = () => {
      const value = current.trim();

      if (value.length >= minChars) {
        chunks.push(value);
      }

      current = "";
    };

    for (const block of blocks) {
      const headingPrefix = block.heading
        ? `${basePrefix} [SECTION: ${block.heading}]`
        : basePrefix;

      const finalPrefix = headingPrefix.trim();

      const textWithPrefix = finalPrefix
        ? `${finalPrefix}\n${block.text}`
        : block.text;

      if (block.isHeadingOnly) {
        if (!current) {
          current = textWithPrefix;
        } else if (`${current}\n\n${textWithPrefix}`.length <= maxChars) {
          current = `${current}\n\n${textWithPrefix}`;
        } else {
          pushCurrent();
          current = textWithPrefix;
        }

        continue;
      }

      const sentences = splitSentences(textWithPrefix);

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
  }

  const seen = new Set();

  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= minChars)
    .filter((chunk) => {
      const key = normalizeForCompare(chunk).slice(0, 600);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}