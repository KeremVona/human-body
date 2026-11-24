import path from 'node:path';
import { contentLocaleReport, contentReport } from '../src/data/contentReport';
import { loadContentInput } from './load-content';

const root = path.resolve(import.meta.dirname, '..');
const input = loadContentInput(root);
const rows = contentReport(input);

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

const localeRows = contentLocaleReport(input);
if (localeRows.length > 0) {
  console.log('\nlocale | names            | featured');
  console.log('-------|------------------|-----------------');
  for (const row of localeRows) {
    const namesPct =
      row.namesTotal > 0
        ? Math.round((row.namesTranslated / row.namesTotal) * 100)
        : 0;
    const featPct =
      row.featuredTotal > 0
        ? Math.round((row.featuredTranslated / row.featuredTotal) * 100)
        : 0;
    console.log(
      `${row.locale.padEnd(6)} | ${`${row.namesTranslated}/${row.namesTotal} (${namesPct}%)`.padEnd(16)} | ${row.featuredTranslated}/${row.featuredTotal} (${featPct}%)`,
    );
  }
}
