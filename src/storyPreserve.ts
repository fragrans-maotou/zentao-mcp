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

export const CUSTOM_FIELD_KEYS = [
  "tthldesign",
  "ttdevtest",
  "bz",
  "ttmedicalrisk",
  "ttisdatasafe",
  "ttnetsafe",
  "ttplan",
  "ttisperformance",
  "ttisdesigncheck",
  "ttcustomerid",
  "ttcustomername",
  "ttengineerprojectid",
  "ttengineerproject",
  "ttishighlightstory",
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

export function formatToZentaoDate(dateStr?: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function buildStoryEditForm(
  currentStory: ZenTaoStory,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const storyObj = currentStory as unknown as Record<string, unknown>;
  const currentPlan = normalizePlan(currentStory.plan);
  const targetPlan = updates.plan !== undefined ? normalizePlan(updates.plan) : currentPlan;

  // 1. 医疗风险和数据安全：在禅道 Web 表单中字段为 ttnetsafe（兼容 ttmedicalrisk），有就不动，没有默认填 "无"
  const rawMedicalRisk =
    updates.ttnetsafe ??
    updates.ttmedicalrisk ??
    storyObj.ttnetsafe ??
    storyObj.ttmedicalrisk;
  const medicalRisk =
    rawMedicalRisk !== undefined && rawMedicalRisk !== null && String(rawMedicalRisk).trim() !== ""
      ? String(rawMedicalRisk)
      : "无";

  // 2. 需提测演示：禅道中选项为 '1' (否) 和 '2' (是)，有就不动，没有默认填 否 ("1")
  const rawPerf = updates.ttisperformance ?? storyObj.ttisperformance;
  let isPerformance = "1"; // 默认：否
  if (rawPerf !== undefined && rawPerf !== null && String(rawPerf).trim() !== "") {
    const perfStr = String(rawPerf).trim();
    if (perfStr === "2" || perfStr === "是" || perfStr.toLowerCase() === "yes") {
      isPerformance = "2";
    } else {
      isPerformance = "1";
    }
  }

  // 3. 计划性质：禅道中选项为 'inplan' (计划内) 和 'outplan' (计划外)，有就不动，没有默认填 计划内 ("inplan")
  const rawPlanType = updates.ttplan ?? storyObj.ttplan;
  let planType = "inplan"; // 默认：计划内
  if (rawPlanType !== undefined && rawPlanType !== null && String(rawPlanType).trim() !== "") {
    const planStr = String(rawPlanType).trim();
    if (planStr === "outplan" || planStr === "计划外") {
      planType = "outplan";
    } else {
      planType = "inplan";
    }
  }

  // 4. 数据安全与架构设计评审 (默认 1)
  const isDataSafe =
    updates.ttisdatasafe !== undefined && updates.ttisdatasafe !== null && String(updates.ttisdatasafe).trim() !== ""
      ? String(updates.ttisdatasafe)
      : (currentStory.ttisdatasafe && String(currentStory.ttisdatasafe).trim() !== "")
        ? String(currentStory.ttisdatasafe)
        : "1";

  const isDesignCheck =
    updates.ttisdesigncheck !== undefined && updates.ttisdesigncheck !== null && String(updates.ttisdesigncheck).trim() !== ""
      ? String(updates.ttisdesigncheck)
      : (storyObj.ttisdesigncheck && String(storyObj.ttisdesigncheck).trim() !== "")
        ? String(storyObj.ttisdesigncheck)
        : "1";

  const form: Record<string, unknown> = {
    color: updates.color ?? storyObj.color ?? "",
    title: updates.title !== undefined ? String(updates.title) : (currentStory.title ?? ""),
    needNotReview: 1,
    spec: updates.spec !== undefined ? String(updates.spec) : (currentStory.spec ?? ""),
    verify: updates.verify !== undefined ? String(updates.verify) : (currentStory.verify ?? ""),
    ttnetsafe: medicalRisk,
    ttisdatasafe: isDataSafe,
    tthldesign: updates.tthldesign ?? currentStory.tthldesign ?? "",
    ttdevtest: updates.ttdevtest ?? currentStory.ttdevtest ?? "",
    comment: updates.comment ?? "",
    lastEditedDate: formatToZentaoDate(currentStory.lastEditedDate),
    product: currentStory.product,
    branch: currentStory.branch ?? 0,
    module: updates.module !== undefined ? updates.module : (currentStory.module ?? 0),
    parent: updates.parent !== undefined ? updates.parent : (currentStory.parent ?? 0),
    plan: targetPlan !== undefined ? [targetPlan] : (currentPlan !== undefined ? [currentPlan] : [0]),
    source: updates.source !== undefined ? updates.source : (currentStory.source ?? ""),
    sourceNote: currentStory.sourceNote ?? "",
    status: (updates.status as string) || currentStory.status || "draft",
    category: updates.category !== undefined ? updates.category : (currentStory.category ?? "feature"),
    pri: updates.pri !== undefined ? updates.pri : (currentStory.pri ?? 3),
    estimate: updates.estimate !== undefined ? updates.estimate : (currentStory.estimate ?? 0),
    ttcustomerid: updates.ttcustomerid ?? storyObj.ttcustomerid ?? "",
    ttcustomername: updates.ttcustomername ?? storyObj.ttcustomername ?? "",
    ttengineerprojectid: updates.ttengineerprojectid ?? storyObj.ttengineerprojectid ?? "",
    ttengineerproject: updates.ttengineerproject ?? storyObj.ttengineerproject ?? "",
    ttplan: planType,
    ttisdesigncheck: isDesignCheck,
    ttisperformance: isPerformance,
    ttmedicalrisk: medicalRisk,
    ttishighlightstory: updates.ttishighlightstory ?? storyObj.ttishighlightstory ?? "",
    feedbackBy: updates.feedbackBy ?? storyObj.feedbackBy ?? "",
    notifyEmail: updates.notifyEmail ?? storyObj.notifyEmail ?? "",
    keywords: updates.keywords ?? currentStory.keywords ?? "",
    assignedTo:
      updates.assignedTo !== undefined
        ? normalizeAssignedTo(updates.assignedTo) ?? ""
        : normalizeAssignedTo(currentStory.assignedTo) ?? "",
    reviewer: [],
    uid: "",
  };

  const currentStage = currentStory.stage || "projected";
  form["stages[0]"] = currentStage;
  form.stage = currentStage;

  // 显式指定评审人时才关闭 needNotReview
  if (updates.reviewer !== undefined) {
    const revs = Array.isArray(updates.reviewer)
      ? updates.reviewer.map(String)
      : [String(updates.reviewer)];
    form.reviewer = revs;
    if (revs.length > 0) {
      form.needNotReview = 0;
    }
  }

  // 补上现有的自定义扩展字段
  const custom = customFieldsFromStory(currentStory);
  for (const [k, v] of Object.entries(custom)) {
    if (v !== undefined && v !== null && form[k] === undefined) {
      form[k] = v;
    }
  }

  // 用用户传入的更新字段覆盖
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined && v !== null) {
      if (isCustomFieldKey(k)) {
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
  // 3. 如果当前需求是草稿状态（draft），统一走 Web 编辑表单直改，避免 REST PUT 的副作用与字段丢失
  if (currentStory.status === "draft") return true;
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

