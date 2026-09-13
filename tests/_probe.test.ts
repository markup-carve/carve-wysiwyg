import { describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { carveToEditorDocument } from '../src/carve-import';
import { jsonToCarve } from '../src/editor';
import { lintCarve } from '@markup-carve/carve';

const out = (s: string) => process.stderr.write('\n' + s + '\n');
const BT = String.fromCharCode(96);

describe('probe', () => {
  it('sample roundtrip', () => {
    const file = readFileSync('src/main.ts', 'utf8');
    const start = file.indexOf('const SAMPLE = ' + BT) + ('const SAMPLE = ' + BT).length;
    const end = file.indexOf(BT + ';', start);
    const SAMPLE = file.slice(start, end).split('\\' + BT).join(BT).split('\\$').join('$');
    const doc = carveToEditorDocument(SAMPLE);
    out('NODE TYPES: ' + JSON.stringify((doc.content ?? []).map(n => n.type)));
    const back = jsonToCarve(doc);
    out('ROUNDTRIP EQUAL: ' + (back === SAMPLE));
    if (back !== SAMPLE) {
      const a = SAMPLE.split('\n');
      const b = back.split('\n');
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] !== b[i]) out('  line ' + (i + 1) + ':\n    - ' + JSON.stringify(a[i]) + '\n    + ' + JSON.stringify(b[i]));
      }
    }
    out('LINT SAMPLE: ' + JSON.stringify(lintCarve(SAMPLE)));
    out('LINT ROUNDTRIP: ' + JSON.stringify(lintCarve(back)));
  });
});
