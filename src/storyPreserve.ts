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

export function buildStoryEditForm(
  currentStory: ZenTaoStory,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const form: Record<string, unknown> = {
    product: currentStory.product,
    branch: currentStory.branch ?? 0,
    module: currentStory.module ?? 0,
    plan: normalizePlan(currentStory.plan) ?? 0,
    source: currentStory.source ?? "",
    sourceNote: currentStory.sourceNote ?? "",
    title: currentStory.title ?? "",
    category: currentStory.category ?? "feature",
    pri: currentStory.pri ?? 3,
    estimate: currentStory.estimate ?? 0,
    status: currentStory.status ?? "draft",
    stage: currentStory.stage ?? "wait",
    spec: currentStory.spec ?? "",
    verify: currentStory.verify ?? "",
    assignedTo: normalizeAssignedTo(currentStory.assignedTo) ?? "",
    // 防并发编辑令牌：必须使用当前需求的最新编辑时间
    lastEditedDate: currentStory.lastEditedDate ?? "",
  };

  if (currentStory.stage) {
    form["stages[0]"] = currentStory.stage;
  }

  // 补上现有的自定义扩展字段
  const custom = customFieldsFromStory(currentStory);
  for (const [k, v] of Object.entries(custom)) {
    if (v !== undefined && v !== null) {
      form[k] = v;
    }
  }

  // 用用户传入的更新字段覆盖
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null) {
      if (k === "assignedTo") {
        form[k] = normalizeAssignedTo(v) ?? v;
      } else if (k === "plan") {
        form[k] = normalizePlan(v) ?? v;
      } else {
        form[k] = v;
      }
    }
  }

  return form;
}

export function shouldSubmitStoryEditForm(
  currentStory: ZenTaoStory,
  updates: Record<string, unknown>
): boolean {
  // 1. 如果传了 spec 或 verify，由于 REST API PUT 会静默忽略富文本，必须通过 Web 表单提交
  if (updates.spec !== undefined || updates.verify !== undefined) return true;
  // 2. 如果包含自定义扩展字段（概要设计、自测说明、医疗风险等），必须通过 Web 表单提交
  if (Object.keys(updates).some(isCustomFieldKey)) return true;
  // 3. 如果当前需求是草稿状态（draft），且传入了标题等核心内容变更，直接走 Web 编辑表单直改草稿
  if (currentStory.status === "draft" && updates.title !== undefined) return true;
  return false;
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

