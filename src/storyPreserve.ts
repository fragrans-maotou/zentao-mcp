import type { ZenTaoStory } from "./types.js";

/** REST PUT 时只回填这些易被禅道清空的属性，不带回 title/spec/product 等。 */
export const PRESERVE_KEYS = [
  "plan",
  "module",
  "pri",
  "assignedTo",
  "category",
  "estimate",
] as const;

const CUSTOM_FIELD_KEYS = [
  "tthldesign",
  "ttdevtest",
  "bz",
  "ttmedicalrisk",
  "ttisdatasafe",
  "ttnetsafe",
] as const;

const FORM_CONTENT_KEYS = ["title", "spec", "verify"] as const;

export function isNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b404\b/.test(msg);
}

export function normalizeAssignedTo(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "account" in value) {
    const account = (value as { account?: unknown }).account;
    if (typeof account === "string" && account) return account;
  }
  return undefined;
}

export function normalizePlan(value: unknown): string | number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const joined = value.map(String).filter((item) => item && item !== "0").join(",");
    return joined || undefined;
  }
  return undefined;
}

function copyIfPresent(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined && value !== null) {
    target[key] = value;
  }
}

export function preservedAttributes(story: ZenTaoStory): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  copyIfPresent(out, "plan", normalizePlan(story.plan));
  copyIfPresent(out, "module", story.module);
  copyIfPresent(out, "pri", story.pri);
  copyIfPresent(out, "assignedTo", normalizeAssignedTo(story.assignedTo));
  copyIfPresent(out, "category", story.category);
  copyIfPresent(out, "estimate", story.estimate);
  return out;
}

export function customFieldsFromStory(story: ZenTaoStory): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CUSTOM_FIELD_KEYS) {
    copyIfPresent(out, key, story[key as keyof ZenTaoStory]);
  }
  return out;
}

export function formContentFromStory(story: ZenTaoStory): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FORM_CONTENT_KEYS) {
    copyIfPresent(out, key, story[key]);
  }
  return out;
}

export function isCustomFieldKey(key: string): boolean {
  return (CUSTOM_FIELD_KEYS as readonly string[]).includes(key);
}

export const STANDARD_UPDATE_KEYS = [
  "title",
  "spec",
  "verify",
  "pri",
  "module",
  "plan",
  "assignedTo",
  "category",
  "source",
  "estimate",
] as const;
