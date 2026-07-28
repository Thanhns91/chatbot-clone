export function semanticChunk(text, options = {}) {
  const maxChars = options.maxChars || 1800;
  const overlapChars = options.overlapChars || 180;
  const minChars = options.minChars || 45;

  const rawText = String(text || "")
    .replace(/\r/g, "")
    .replace(/-\n(?=\p{L})/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

  if (!rawText) return [];

  const MONTH_PATTERN =
    "(?:January|February|March|April|May|June|July|August|September|October|November|December)";

  const DATE_PATTERN = new RegExp(
    `\\b${MONTH_PATTERN}\\s+(?:19|20)\\d{2}\\b|` +
      `\\b(?:19|20)\\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\\d|3[01])\\b|` +
      `\\b(?:0?[1-9]|[12]\\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\\d{2}\\b`,
    "i",
  );

  const normalizeForCompare = (value) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .trim();

  const isImportantShortText = (value = "") => {
    const textValue = String(value || "").trim();

    if (!textValue) return false;

    return (
      DATE_PATTERN.test(textValue) ||
      /https?:\/\/|www\.|doi\.org|ISBN|ISSN/i.test(textValue) ||
      /\b(?:NIST|ISO|IEC|IEEE|OECD|AI|RMF|TEVV)\b/i.test(textValue) ||
      /\b(?:version|publication|published|issued|release)\b/i.test(textValue) ||
      /\b(?:GOVERN|MAP|MEASURE|MANAGE)\b/.test(textValue) ||
      /^\[?(?:PAGE|TRANG)\s+\d+\]?$/i.test(textValue) ||
      /^[A-Z]{2,}(?:[\s./-]+[A-Z0-9]{1,})+$/.test(textValue) ||
      /^\d+(?:\.\d+)*\s+\S+/.test(textValue)
    );
  };

  const isHeading = (line = "") => {
    const value = line.trim();

    if (!value) return false;
    if (value.length > 140) return false;

    return (
      /^#{1,6}\s+/.test(value) ||
      /^chapter\s+\d+/i.test(value) ||
      /^section\s+\d+/i.test(value) ||
      /^part\s+\d+/i.test(value) ||
      /^appendix\s+[a-z0-9]+/i.test(value) ||
      /^bài\s+\d+/i.test(value) ||
      /^chương\s+\d+/i.test(value) ||
      /^mục\s+\d+/i.test(value) ||
      /^\d+(?:\.\d+)*\s+[\p{L}\p{N}]/u.test(value) ||
      /^[A-ZÀ-Ỹ0-9][A-ZÀ-Ỹ0-9\s:–—&/-]{4,}$/.test(value)
    );
  };

  const splitByPages = (input) => {
    const explicitPageRegex =
      /(?:^|\n)\s*(?:={2,}\s*)?\[?(?:PAGE|TRANG)\s+(\d+)\]?(?:\s*={2,})?\s*(?:\n|$)/gim;

    const matches = [
      ...input.matchAll(explicitPageRegex),
    ];

    if (matches.length === 0) {
      return [
        {
          page: null,
          text: input,
        },
      ];
    }

    const pages = [];

    const beforeFirstPage = input
      .slice(0, matches[0].index)
      .trim();

    if (beforeFirstPage) {
      pages.push({
        page: null,
        text: beforeFirstPage,
      });
    }

    for (
      let index = 0;
      index < matches.length;
      index += 1
    ) {
      const current = matches[index];
      const next = matches[index + 1];

      const page = Number(current[1]);

      const start =
        current.index +
        current[0].length;

      const end = next
        ? next.index
        : input.length;

      const pageText = input
        .slice(start, end)
        .trim();

      if (pageText) {
        pages.push({
          page,
          text: pageText,
        });
      }
    }

    return pages.length
      ? pages
      : [
          {
            page: null,
            text: input,
          },
        ];
  };

  const splitSentences = (paragraph = "") => {
    const normalized = String(
      paragraph || "",
    )
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) return [];

    return (
      normalized.match(
        /[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g,
      ) || [normalized]
    )
      .map((sentence) =>
        sentence.trim(),
      )
      .filter(Boolean);
  };

  const getTailByWords = (
    source,
    limit,
  ) => {
    const words = String(
      source || "",
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const tail = [];
    let total = 0;

    for (
      let index = words.length - 1;
      index >= 0;
      index -= 1
    ) {
      total +=
        words[index].length + 1;

      if (total > limit) break;

      tail.unshift(words[index]);
    }

    return tail.join(" ").trim();
  };

  const splitLongTextByWords = (
    longText,
  ) => {
    const words = String(
      longText || "",
    )
      .split(/\s+/)
      .filter(Boolean);

    const result = [];
    let start = 0;

    while (start < words.length) {
      let end = start;
      let length = 0;

      while (
        end < words.length &&
        length +
          words[end].length +
          1 <=
          maxChars
      ) {
        length +=
          words[end].length + 1;

        end += 1;
      }

      if (end === start) {
        end += 1;
      }

      const chunk = words
        .slice(start, end)
        .join(" ")
        .trim();

      if (chunk) {
        result.push(chunk);
      }

      if (end >= words.length) {
        break;
      }

      let overlapStart = end;
      let overlapLength = 0;

      while (
        overlapStart > start &&
        overlapLength <
          overlapChars
      ) {
        overlapStart -= 1;

        overlapLength +=
          words[overlapStart]
            .length + 1;
      }

      start = Math.max(
        overlapStart,
        start + 1,
      );
    }

    return result;
  };

  const pages = splitByPages(rawText);
  const chunks = [];

  /*
   * Tạo một chunk riêng cho phần đầu tài liệu.
   *
   * Chunk này giúp giữ lại:
   * - tên tài liệu;
   * - số hiệu;
   * - DOI/URL;
   * - ngày tháng xuất bản;
   * - cơ quan phát hành.
   */
  const frontMatterLength = Math.min(
    Math.max(maxChars, 1800),
    2600,
  );

  const frontMatterSource = rawText
    .slice(0, frontMatterLength)
    .trim();

  const hasFrontMatterMetadata =
    DATE_PATTERN.test(
      frontMatterSource,
    ) ||
    /doi\.org|this publication|published|publication|version|ISBN|ISSN/i.test(
      frontMatterSource,
    );

  if (
    frontMatterSource &&
    hasFrontMatterMetadata
  ) {
    chunks.push(
      `[FRONT MATTER]\n${frontMatterSource}`,
    );
  }

  for (const pageBlock of pages) {
    const lines = pageBlock.text
      .split("\n")
      .map((line) =>
        line.trim(),
      )
      .filter(Boolean);

    let currentHeading = "";
    let paragraphBuffer = [];

    const flushParagraph = () => {
      if (
        paragraphBuffer.length === 0
      ) {
        return null;
      }

      const paragraph =
        paragraphBuffer
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

      paragraphBuffer = [];

      return paragraph;
    };

    const blocks = [];

    for (const line of lines) {
      if (isHeading(line)) {
        const paragraph =
          flushParagraph();

        if (paragraph) {
          blocks.push({
            heading:
              currentHeading,
            text: paragraph,
          });
        }

        currentHeading = line
          .replace(
            /^#{1,6}\s+/,
            "",
          )
          .trim();

        blocks.push({
          heading:
            currentHeading,
          text: currentHeading,
          isHeadingOnly: true,
        });

        continue;
      }

      /*
       * Những dòng metadata ngắn được giữ riêng
       * thay vì để mất vì minChars.
       */
      if (
        isImportantShortText(line) &&
        paragraphBuffer.length > 0
      ) {
        const paragraph =
          flushParagraph();

        if (paragraph) {
          blocks.push({
            heading:
              currentHeading,
            text: paragraph,
          });
        }

        blocks.push({
          heading:
            currentHeading,
          text: line,
          isImportantShort: true,
        });

        continue;
      }

      paragraphBuffer.push(line);
    }

    const lastParagraph =
      flushParagraph();

    if (lastParagraph) {
      blocks.push({
        heading:
          currentHeading,
        text: lastParagraph,
      });
    }

    let current = "";

    const basePrefix =
      pageBlock.page
        ? `[PAGE ${pageBlock.page}]`
        : "";

    const pushCurrent = () => {
      const value =
        current.trim();

      if (
        value.length >= minChars ||
        isImportantShortText(value)
      ) {
        chunks.push(value);
      }

      current = "";
    };

    for (const block of blocks) {
      const headingPrefix =
        block.heading
          ? `${basePrefix} [SECTION: ${block.heading}]`
          : basePrefix;

      const finalPrefix =
        headingPrefix.trim();

      const textWithPrefix =
        finalPrefix
          ? `${finalPrefix}\n${block.text}`
          : block.text;

      if (
        block.isHeadingOnly ||
        block.isImportantShort
      ) {
        if (!current) {
          current =
            textWithPrefix;
        } else if (
          `${current}\n\n${textWithPrefix}`
            .length <= maxChars
        ) {
          current =
            `${current}\n\n${textWithPrefix}`;
        } else {
          pushCurrent();

          current =
            textWithPrefix;
        }

        continue;
      }

      const sentences =
        splitSentences(
          textWithPrefix,
        );

      for (const sentence of sentences) {
        if (
          sentence.length >
          maxChars
        ) {
          pushCurrent();

          const longChunks =
            splitLongTextByWords(
              sentence,
            );

          chunks.push(
            ...longChunks,
          );

          continue;
        }

        if (!current) {
          current = sentence;
          continue;
        }

        const next =
          `${current} ${sentence}`
            .trim();

        if (
          next.length <= maxChars
        ) {
          current = next;
        } else {
          const tail =
            getTailByWords(
              current,
              overlapChars,
            );

          chunks.push(
            current.trim(),
          );

          current = tail
            ? `${tail} ${sentence}`.trim()
            : sentence;
        }
      }
    }

    pushCurrent();
  }

  const seen = new Set();

  return chunks
    .map((chunk) =>
      chunk.trim(),
    )
    .filter(Boolean)
    .filter(
      (chunk) =>
        chunk.length >= minChars ||
        isImportantShortText(chunk),
    )
    .filter((chunk) => {
      const key =
        normalizeForCompare(
          chunk,
        ).slice(0, 900);

      if (!key) return false;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
}