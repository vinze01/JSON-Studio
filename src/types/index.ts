/** Shared JSON value types. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/** Viewer modes available in the workspace. */
export type ViewMode = 'tree' | 'code' | 'raw';

/** User-adjustable preferences, persisted via Chrome Storage. */
export type ThemeOption = 'light' | 'dark' | 'system';

export interface Preferences {
  theme: ThemeOption;
  indent: 2 | 4;
  wrap: boolean;
  defaultView: ViewMode;
  /**
   * Reprint numbers, key order and string escapes verbatim when formatting or
   * minifying, so round trips never alter data (see utils/json/reprint.ts).
   */
  losslessNumbers: boolean;
}

/** Where the current document came from. */
export interface SourceInfo {
  origin: 'editor' | 'file' | 'tab';
  /** Page URL when captured from a browser tab. */
  pageUrl?: string;
}

/** 0-based line/column position of a syntax location. */
export interface SourcePosition {
  line: number;
  column: number;
}

export interface JsonDiagnostic {
  message: string;
  offset: number;
  line: number;
  column: number;
}

/** Structural details collected by the scanner. */
export interface ScanInfo {
  duplicateKeys: DuplicateKeyFinding[];
  precisionNotes: number;
  maxDepth: number;
}

export interface DuplicateKeyFinding {
  pointer: string;
  occurrences: number;
}

export interface ScanResult {
  ok: boolean;
  error: JsonDiagnostic | null;
  info: ScanInfo;
  /** True when valid but the document was too large for a full scan. */
  scanSkipped: boolean;
}

export interface DocumentStats {
  sizeBytes: number;
  rootType: JsonNodeType | 'empty' | 'invalid';
  items: number | null;
  depth: number;
}

export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface SearchMatch {
  pointer: string;
  kind: 'key' | 'value';
  preview: string;
}

export interface SearchOutcome {
  matches: SearchMatch[];
  truncated: boolean;
}

export interface JsonTreeNode {
  pointer: string;
  label: string;
  /** True when the label is an array index rather than a property name. */
  isIndex: boolean;
  type: JsonNodeType;
  value: JsonValue;
  /** Human-readable size summary for containers, e.g. "3 keys" or "4 items". */
  summary: string | null;
  depth: number;
  hasChildren: boolean;
}

/* ------------------------------ parse results ----------------------------- */

export interface ParseSuccess {
  ok: true;
  data: JsonValue;
}

export interface ParseFailure {
  ok: false;
  error: JsonDiagnostic;
}

export type ParseResult = ParseSuccess | ParseFailure;

/* -------------------------------- formatting ------------------------------ */

/**
 * Shared outcome of the text-level serializers (format, minify, lossless
 * reprint). Failure carries the same diagnostics the parser produces.
 */
export type FormattingResult =
  | { ok: true; text: string }
  | { ok: false; message: string; offset: number; line: number; column: number };

/** Result of the smart repair pass. */
export interface RepairResult {
  ok: boolean;
  repairedText: string;
  repairsApplied: string[];
}

/** Store-level outcome of a format/minify against the live editor text. */
export type FormatOutcome = { ok: true; text: string } | { ok: false; detail: string };

/* ---------------------------------- search -------------------------------- */

export interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  matchKeys?: boolean;
  matchValues?: boolean;
  /** Safety cap so huge documents can't freeze the UI. */
  limit?: number;
}

/* ---------------------------------- toasts -------------------------------- */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

/* ------------------------------ browser toolbox --------------------------- */

export type FileReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too-large' | 'read-error' | 'empty'; message: string };

/** Staged payload transported between the popup/background and the workspace. */
export interface PendingDocument {
  text: string;
  capturedAt: number;
  source: { pageUrl?: string; title?: string };
}

/* ------------------------------ page inspection --------------------------- */

/** Routing bindings for opening the workspace tab (background-only). */
export interface WorkspaceEnv {
  runtime: { getURL: (path: string) => string };
  tabs: {
    create: (props: { url: string }) => void;
    query: (info: { url: string }) => Promise<Array<{ id?: number; windowId?: number }>>;
    update: (id: number, props: { active: boolean }) => void;
  };
  windows: { update: (id: number, props: { focused: boolean }) => void } | null;
}

/** Raw page extraction result produced by the injected function. */
export interface ExtractOutcome {
  kind: 'json-doc' | 'text-doc' | 'pre-block' | 'none';
  text: string;
  contentType: string;
  title: string | undefined;
}

/** Popup-facing result after validation of an extraction. */
export type InspectResult =
  | { status: 'captured'; bytes: number; contentType: string }
  | { status: 'nothing-found'; detail: string }
  | { status: 'restricted'; detail: string }
  | { status: 'too-large'; detail: string }
  | { status: 'error'; detail: string };

/* ------------------------------------ UI ---------------------------------- */

/** Generic labelled option for toolbar controls and viewers. */
export interface ToolbarOption {
  value: string;
  label: string;
  /** Icon component (Lucide functional component). */
  icon: object;
}
