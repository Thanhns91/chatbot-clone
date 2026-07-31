import pool from "./db.js";

function fixMojibake(text = "") {
  if (!text) return text;
  let str = String(text);

  for (let i = 0; i < 2; i++) {
    if (
      /[\u00C0-\u00FF]/.test(str) ||
      str.includes("Ã") ||
      str.includes("áº") ||
      str.includes("Ná»") ||
      str.includes("Ä‘") ||
      str.includes("Æ°")
    ) {
      try {
        const decoded = Buffer.from(str, "latin1").toString("utf8");
        if (decoded && !decoded.includes("\uFFFD")) {
          str = decoded;
        } else {
          break;
        }
      } catch {
        break;
      }
    } else {
      break;
    }
  }
  return str;
}

async function fixOtherTables() {
  try {
    // 1. Topics
    const [topics] = await pool.query("SELECT topicId, topicName FROM Topics");
    for (const t of topics) {
      const fixed = fixMojibake(t.topicName);
      if (fixed !== t.topicName) {
        console.log(`Topic ID ${t.topicId}: "${t.topicName}" -> "${fixed}"`);
        await pool.query("UPDATE Topics SET topicName = ? WHERE topicId = ?", [fixed, t.topicId]);
      }
    }

    // 2. Subjects
    const [subjects] = await pool.query("SELECT subjectId, subjectName FROM Subjects");
    for (const s of subjects) {
      const fixed = fixMojibake(s.subjectName);
      if (fixed !== s.subjectName) {
        console.log(`Subject ID ${s.subjectId}: "${s.subjectName}" -> "${fixed}"`);
        await pool.query("UPDATE Subjects SET subjectName = ? WHERE subjectId = ?", [fixed, s.subjectId]);
      }
    }

    // 3. DocumentTypes
    const [docTypes] = await pool.query("SELECT documentTypeId, typeName FROM DocumentTypes");
    for (const dt of docTypes) {
      const fixed = fixMojibake(dt.typeName);
      if (fixed !== dt.typeName) {
        console.log(`DocumentType ID ${dt.documentTypeId}: "${dt.typeName}" -> "${fixed}"`);
        await pool.query("UPDATE DocumentTypes SET typeName = ? WHERE documentTypeId = ?", [fixed, dt.documentTypeId]);
      }
    }

    // 4. Levels
    const [levels] = await pool.query("SELECT levelId, levelName FROM Levels");
    for (const l of levels) {
      const fixed = fixMojibake(l.levelName);
      if (fixed !== l.levelName) {
        console.log(`Level ID ${l.levelId}: "${l.levelName}" -> "${fixed}"`);
        await pool.query("UPDATE Levels SET levelName = ? WHERE levelId = ?", [fixed, l.levelId]);
      }
    }

    console.log("=== All DB tables checked & fixed! ===");
  } catch (err) {
    console.error("Fix error:", err);
  } finally {
    process.exit(0);
  }
}

fixOtherTables();
