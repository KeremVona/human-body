import path from 'node:path';
import { checkContent } from '../src/data/checkContent';
import { loadContentInput } from './load-content';

const root = path.resolve(import.meta.dirname, '..');
const report = checkContent(loadContentInput(root));

for (const warning of report.warnings) {
  console.warn(`WARN  ${warning}`);
}
for (const error of report.errors) {
  console.error(`ERROR ${error}`);
}

console.log(
  `check:content: ${report.errors.length} errors, ${report.warnings.length} warnings`,
);

if (report.errors.length > 0) {
  process.exitCode = 1;
}
