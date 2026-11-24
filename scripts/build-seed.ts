// Regenerates src/data/seed-plan.json from the Excel plan in doc/.
// Run: npm run seed
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { importPlanFromXlsx } from '../src/data/importXlsx';

const docDir = join(import.meta.dirname, '..', 'doc');
const file = readdirSync(docDir).find((f) => f.endsWith('.xlsx'));
if (!file) throw new Error(`No .xlsx found in ${docDir}`);

const { plan, warnings } = importPlanFromXlsx(readFileSync(join(docDir, file)), {
  id: 'seed-2026-11-24',
  name: file.replace(/^Jump Rope Tracker\s*[—-]\s*/, '').replace(/\.xlsx$/, ''),
});

const out = join(import.meta.dirname, '..', 'src', 'data', 'seed-plan.json');
writeFileSync(out, JSON.stringify(plan, null, 2) + '\n');
console.log(`Wrote ${plan.days.length} days (${plan.startDate} → ${plan.days.at(-1)?.date}) to ${out}`);
for (const w of warnings) console.warn('warning:', w);
