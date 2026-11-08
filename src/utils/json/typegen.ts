/**
 * Generates TypeScript type definitions from JSON data.
 */
import type { JsonValue } from '@/types';

export function jsonToTypeScript(
  value: JsonValue,
  rootName = 'RootObject',
  indentSize = 2,
): string {
  const interfaces: Map<string, string> = new Map();
  const indent = ' '.repeat(indentSize);

  function capitalize(str: string): string {
    if (!str) return 'Item';
    const clean = str.replace(/[^a-zA-Z0-9]/g, '');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  function resolveType(val: JsonValue, suggestedName: string): string {
    if (val === null) return 'null';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'string') return 'string';

    if (Array.isArray(val)) {
      if (val.length === 0) return 'unknown[]';
      // Sample array items to determine union or object type
      const types = Array.from(new Set(val.map((item) => resolveType(item, suggestedName))));
      if (types.length === 1) {
        return `${types[0]}[]`;
      }
      return `(${types.join(' | ')})[]`;
    }

    if (typeof val === 'object') {
      const typeName = capitalize(suggestedName);
      const lines: string[] = [];

      for (const [key, propVal] of Object.entries(val)) {
        const propTypeName = resolveType(propVal, `${typeName}${capitalize(key)}`);
        const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
        lines.push(`${indent}${safeKey}: ${propTypeName};`);
      }

      const body = lines.length > 0 ? `{\n${lines.join('\n')}\n}` : '{}';
      interfaces.set(typeName, `export interface ${typeName} ${body}`);
      return typeName;
    }

    return 'unknown';
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      const itemType = resolveType(value[0], 'Item');
      return `${Array.from(interfaces.values()).join('\n\n')}\n\nexport type ${rootName} = ${itemType}[];`;
    }
    const itemType = resolveType(value[0] ?? null, 'Item');
    return `export type ${rootName} = ${itemType}[];`;
  }

  if (typeof value === 'object' && value !== null) {
    resolveType(value, rootName);
    return Array.from(interfaces.values()).join('\n\n');
  }

  return `export type ${rootName} = ${typeof value};`;
}

