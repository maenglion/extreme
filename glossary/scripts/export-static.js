import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTerm, listTerms, openGlossary } from '../db/glossary.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(root, 'public', 'data');
const db = openGlossary();

try {
  const summaries = listTerms(db);
  const terms = summaries.map((summary) => getTerm(db, summary.id));
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'terms.json'),
    `${JSON.stringify({ terms }, null, 2)}\n`,
    'utf8'
  );
  console.log(`Exported ${terms.length} terms for static hosting.`);
} finally {
  db.close();
}
