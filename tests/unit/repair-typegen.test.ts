import { describe, expect, it } from 'vitest';
import { repairJson } from '@/utils/json/repair';
import { jsonToTypeScript } from '@/utils/json/typegen';

describe('repairJson', () => {
  it('repairs single-quoted keys and values', () => {
    const input = "{'id': 101, 'name': 'John Doe', 'active': true}";
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({
      id: 101,
      name: 'John Doe',
      active: true,
    });
  });

  it('repairs unquoted object keys', () => {
    const input = '{ id: 101, name: "Alice", is_admin: false }';
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({
      id: 101,
      name: 'Alice',
      is_admin: false,
    });
  });

  it('repairs trailing commas', () => {
    const input = '{\n  "items": [1, 2, 3,],\n  "name": "test",\n}';
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({
      items: [1, 2, 3],
      name: 'test',
    });
  });

  it('repairs Python literals (True, False, None)', () => {
    const input = '{"success": True, "failed": False, "data": None}';
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({
      success: true,
      failed: false,
      data: null,
    });
  });

  it('strips single-line and multi-line comments', () => {
    const input = `
      // Configuration file
      {
        /* Primary ID */
        "id": 1,
        "name": "Config" // end of line comment
      }
    `;
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({
      id: 1,
      name: 'Config',
    });
  });

  it('repairs missing colons between keys and values', () => {
    const input = '{"language" "Galician", "code": "gl"}';
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({ language: 'Galician', code: 'gl' });
    expect(res.repairsApplied).toContain('Inserted missing colons after property names');
  });

  it('repairs the first member missing a colon after an opening brace', () => {
    const input = '{"a" 1, "b": 2}';
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({ a: 1, b: 2 });
  });

  it('does not insert colons inside arrays', () => {
    const input = '[1, "a" "b", 2]';
    const res = repairJson(input);
    // Missing commas inside arrays are handled by the comma pass, never by
    // the colon pass: `"a" "b"` must become `"a", "b"`, not `"a": "b"`.
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual([1, 'a', 'b', 2]);
    expect(res.repairsApplied).not.toContain('Inserted missing colons after property names');
  });

  it('repairs missing colons in later members of a document array', () => {
    const input =
      '[{"name": "Adeel", "language": "Sindhi"}, {"name": "Noa", "language" "Galician", "id": "WR"}]';
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual([
      { name: 'Adeel', language: 'Sindhi' },
      { name: 'Noa', language: 'Galician', id: 'WR' },
    ]);
    expect(res.repairsApplied).toContain('Inserted missing colons after property names');
  });

  it('repairs missing colons when values are numbers', () => {
    const input = '{"a" 1, "b": "x"}';
    const res = repairJson(input);
    expect(res.ok).toBe(true);
    expect(JSON.parse(res.repairedText)).toEqual({ a: 1, b: 'x' });
  });
});

describe('jsonToTypeScript', () => {
  it('generates interfaces for nested objects', () => {
    const data = {
      id: 101,
      name: 'Alice',
      address: {
        city: 'New York',
        zip: 10001,
      },
      tags: ['admin', 'user'],
    };
    const ts = jsonToTypeScript(data, 'User');
    expect(ts).toContain('export interface User');
    expect(ts).toContain('id: number;');
    expect(ts).toContain('name: string;');
    expect(ts).toContain('tags: string[];');
    expect(ts).toContain('address: UserAddress;');
  });
});

