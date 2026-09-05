import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(here, 'glossary.sqlite');

export function normalizeTermName(value) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko-KR');
}

export function openGlossary(dbPath = process.env.GLOSSARY_DB_PATH || defaultDbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  return db;
}

export function upsertTerm(db, input) {
  const required = ['name', 'definition', 'primaryExample', 'usageContext', 'mechanism'];
  for (const field of required) {
    if (!input[field]?.trim()) throw new Error(`${field} is required`);
  }

  const normalizedName = normalizeTermName(input.name);
  const sourceKey = input.sourceKey?.trim() || null;
  const existing = db.prepare('SELECT id FROM terms WHERE normalized_name = ?').get(normalizedName);

  db.exec('BEGIN IMMEDIATE');
  try {
    let termId;
    if (existing) {
      termId = existing.id;
      const occurrenceAlreadyExists = sourceKey
        ? db.prepare('SELECT 1 FROM term_occurrences WHERE source_key = ?').get(sourceKey)
        : null;

      if (!occurrenceAlreadyExists) {
        db.prepare(`
          UPDATE terms
          SET definition = ?, primary_example = ?, usage_context = ?, mechanism = ?,
              occurrence_count = occurrence_count + 1, last_seen_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(input.definition.trim(), input.primaryExample.trim(), input.usageContext.trim(), input.mechanism.trim(), termId);
      }
    } else {
      const result = db.prepare(`
        INSERT INTO terms (name, normalized_name, definition, primary_example, usage_context, mechanism)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        input.name.trim(), normalizedName, input.definition.trim(), input.primaryExample.trim(),
        input.usageContext.trim(), input.mechanism.trim()
      );
      termId = Number(result.lastInsertRowid);
    }

    const occurrenceExists = sourceKey
      ? db.prepare('SELECT 1 FROM term_occurrences WHERE source_key = ?').get(sourceKey)
      : null;
    if (!occurrenceExists) {
      db.prepare('INSERT INTO term_occurrences (term_id, source_key, source_text) VALUES (?, ?, ?)')
        .run(termId, sourceKey, input.sourceText?.trim() || null);
    }

    for (const rawTag of input.tags || []) {
      const tag = rawTag.trim();
      if (!tag) continue;
      db.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING').run(tag);
      const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(tag);
      db.prepare('INSERT INTO term_tags (term_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING').run(termId, tagRow.id);
    }

    if (input.lesson) {
      db.prepare(`
        INSERT INTO term_lessons
          (term_id, memory_hook, why_it_matters, logic_steps, common_mistake, related_terms)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(term_id) DO UPDATE SET
          memory_hook = excluded.memory_hook,
          why_it_matters = excluded.why_it_matters,
          logic_steps = excluded.logic_steps,
          common_mistake = excluded.common_mistake,
          related_terms = excluded.related_terms
      `).run(
        termId,
        input.lesson.memoryHook,
        input.lesson.whyItMatters,
        JSON.stringify(input.lesson.logicSteps || []),
        input.lesson.commonMistake,
        JSON.stringify(input.lesson.relatedTerms || [])
      );
    }

    db.exec('COMMIT');
    return termId;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listTerms(db) {
  const terms = db.prepare(`
    SELECT id, name, definition, primary_example AS primaryExample,
           usage_context AS usageContext, mechanism, occurrence_count AS occurrenceCount,
           first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt,
           EXISTS(SELECT 1 FROM term_lessons WHERE term_id = terms.id) AS hasLesson
    FROM terms
    ORDER BY last_seen_at DESC, name COLLATE NOCASE
  `).all();
  const tagStatement = db.prepare(`
    SELECT tags.name FROM tags
    JOIN term_tags ON term_tags.tag_id = tags.id
    WHERE term_tags.term_id = ? ORDER BY tags.name
  `);
  return terms.map((term) => ({ ...term, tags: tagStatement.all(term.id).map((row) => row.name) }));
}

export function getTerm(db, id) {
  const term = db.prepare(`
    SELECT id, name, definition, primary_example AS primaryExample,
           usage_context AS usageContext, mechanism, occurrence_count AS occurrenceCount,
           first_seen_at AS firstSeenAt, last_seen_at AS lastSeenAt
    FROM terms WHERE id = ?
  `).get(id);
  if (!term) return null;

  term.tags = db.prepare(`
    SELECT tags.name FROM tags
    JOIN term_tags ON term_tags.tag_id = tags.id
    WHERE term_tags.term_id = ? ORDER BY tags.name
  `).all(id).map((row) => row.name);

  const lesson = db.prepare(`
    SELECT memory_hook AS memoryHook, why_it_matters AS whyItMatters,
           logic_steps AS logicSteps, common_mistake AS commonMistake,
           related_terms AS relatedTerms
    FROM term_lessons WHERE term_id = ?
  `).get(id);
  term.lesson = lesson ? {
    ...lesson,
    logicSteps: JSON.parse(lesson.logicSteps),
    relatedTerms: JSON.parse(lesson.relatedTerms)
  } : null;
  return term;
}
