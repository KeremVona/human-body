import path from 'node:path';
import { contentReport } from '../src/data/contentReport';
import { loadContentInput } from './load-content';

const root = path.resolve(import.meta.dirname, '..');
const rows = contentReport(loadContentInput(root));

console.log(
  'system           | structures | featured | complete | missingLatin | gaps',
);
console.log(
  '-----------------|------------|----------|----------|--------------|-----',
);
for (const row of rows) {
  console.log(
    `${row.system.padEnd(16)} | ${String(row.structures).padStart(10)} | ${String(row.featured).padStart(8)} | ${String(row.featuredComplete).padStart(8)} | ${String(row.missingLatin).padStart(12)} | ${row.gaps.length}`,
  );
}

const allGaps = rows.flatMap((row) =>
  row.gaps.map((g) => ({ system: row.system, ...g })),
);
if (allGaps.length > 0) {
  console.log('\nFeatured gaps:');
  for (const gap of allGaps) {
    console.log(`- ${gap.system}/${gap.id}: ${gap.missing.join(', ')}`);
  }
}
