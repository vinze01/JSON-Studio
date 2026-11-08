import { describe, expect, it } from 'vitest';
import { repairJson } from '@/utils/json/repair';
import { scanJson } from '@/utils/json/validate';

/** ~20 KB document whose only defect is a missing colon past offset 15000. */
function buildSample(): string {
  const bio =
    'Donec lobortis eleifend condimentum. Cras dictum dolor lacinia lectus vehicula rutrum. Maecenas quis nisi nunc.';
  const bio2 =
    'Aliquam sollicitudin ante ligula, eget malesuada nibh efficitur et. Vestibulum pharetra libero et velit gravida euismod.';
  const entries: string[] = [];
  for (let i = 0; i < 100; i++) {
    entries.push(
      `{"name": "Person ${i}", "language": "Sindhi", "id": "ID${i}00000000000000", "bio": "${i % 2 ? bio : bio2}", "version": ${i}.1}`,
    );
  }
  // The user's failing entry (`"language" "Galician"`) dropped in late.
  const broken = `{"name": "Noa Ervello", "language" "Galician", "id": "W9FR842CI16V8NU3", "bio": "${bio2}", "version": 9.33}`;
  entries.splice(75, 0, broken);
  return `[${entries.join(',')}]`;
}

describe('repairJson — large leaked sample regression', () => {
  it('repairs a ~20 KB document array whose only defect is a missing colon deep inside', () => {
    const text = buildSample();
    expect(text.length).toBeGreaterThan(20_000);
    const failOffset = text.indexOf('"language" "Galician"');
    expect(failOffset).toBeGreaterThan(15_000);

    const scan = scanJson(text);
    expect(scan.error?.message).toContain("Expected ':'");
    // Key-closing-quote index (keyOffset 0 + key 'language'.length 8 + 1).
    expect(scan.error?.offset).toBe(failOffset + 9);

    const res = repairJson(text);
    expect(res.ok).toBe(true);
    expect(res.repairsApplied).toEqual(['Inserted missing colons after property names']);
    const parsed = JSON.parse(res.repairedText) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(101);
    expect(parsed[75]).toEqual({
      name: 'Noa Ervello',
      language: 'Galician',
      id: 'W9FR842CI16V8NU3',
      bio: expect.any(String),
      version: 9.33,
    });
  });
});
