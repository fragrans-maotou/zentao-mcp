/** REST PUT 时只回填这些易被禅道清空的属性，不带回 title/spec/product 等。 */
export const PRESERVE_KEYS = [
    "plan",
    "module",
    "pri",
    "assignedTo",
    "category",
    "estimate",
];
const CUSTOM_FIELD_KEYS = [
    "tthldesign",
    "ttdevtest",
    "bz",
    "ttmedicalrisk",
    "ttisdatasafe",
    "ttnetsafe",
];
const FORM_CONTENT_KEYS = ["title", "spec", "verify"];
export function isNotFoundError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    return /\b404\b/.test(msg);
}
export function normalizeAssignedTo(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value === "string")
        return value;
    if (typeof value === "object" && "account" in value) {
        const account = value.account;
        if (typeof account === "string" && account)
            return account;
    }
    return undefined;
}
export function normalizePlan(value) {
    if (value === undefined || value === null || value === "")
        return undefined;
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string")
        return value;
    if (Array.isArray(value)) {
        const joined = value.map(String).filter((item) => item && item !== "0").join(",");
        return joined || undefined;
    }
    return undefined;
}
function copyIfPresent(target, key, value) {
    if (value !== undefined && value !== null) {
        target[key] = value;
    }
}
export function preservedAttributes(story) {
    const out = {};
    copyIfPresent(out, "plan", normalizePlan(story.plan));
    copyIfPresent(out, "module", story.module);
    copyIfPresent(out, "pri", story.pri);
    copyIfPresent(out, "assignedTo", normalizeAssignedTo(story.assignedTo));
    copyIfPresent(out, "category", story.category);
    copyIfPresent(out, "estimate", story.estimate);
    return out;
}
export function customFieldsFromStory(story) {
    const out = {};
    for (const key of CUSTOM_FIELD_KEYS) {
        copyIfPresent(out, key, story[key]);
    }
    return out;
}
export function formContentFromStory(story) {
    const out = {};
    for (const key of FORM_CONTENT_KEYS) {
        copyIfPresent(out, key, story[key]);
    }
    return out;
}
export function isCustomFieldKey(key) {
    return CUSTOM_FIELD_KEYS.includes(key);
}
export function buildStoryEditForm(currentStory, updates) {
    const currentPlan = normalizePlan(currentStory.plan);
    const targetPlan = updates.plan !== undefined ? normalizePlan(updates.plan) : currentPlan;
    const form = {
        product: currentStory.product,
        branch: currentStory.branch ?? 0,
        module: updates.module !== undefined ? updates.module : (currentStory.module ?? 0),
        plan: targetPlan !== undefined ? [targetPlan] : (currentPlan !== undefined ? [currentPlan] : [0]),
        source: updates.source !== undefined ? updates.source : (currentStory.source ?? ""),
        sourceNote: currentStory.sourceNote ?? "",
        title: updates.title !== undefined ? String(updates.title) : (currentStory.title ?? ""),
        category: updates.category !== undefined ? updates.category : (currentStory.category ?? "feature"),
        pri: updates.pri !== undefined ? updates.pri : (currentStory.pri ?? 3),
        estimate: updates.estimate !== undefined ? updates.estimate : (currentStory.estimate ?? 0),
        status: updates.status || currentStory.status || "draft",
        stage: currentStory.stage ?? "wait",
        spec: updates.spec !== undefined ? String(updates.spec) : (currentStory.spec ?? ""),
        verify: updates.verify !== undefined ? String(updates.verify) : (currentStory.verify ?? ""),
        assignedTo: updates.assignedTo !== undefined
            ? normalizeAssignedTo(updates.assignedTo) ?? ""
            : normalizeAssignedTo(currentStory.assignedTo) ?? "",
        // 防并发编辑令牌：必须使用当前需求的最新编辑时间
        lastEditedDate: currentStory.lastEditedDate ?? "",
        // 关键标记：草稿直改时必须带上 needNotReview: 1，否则禅道后端会以“评审人不能为空”拒绝保存
        needNotReview: 1,
        reviewer: [],
        uid: "",
    };
    if (currentStory.stage) {
        form["stages[0]"] = currentStory.stage;
    }
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
        if (v !== undefined && v !== null) {
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
export function shouldSubmitStoryEditForm(currentStory, updates) {
    // 1. 如果传了 spec 或 verify，由于 REST API PUT 会静默忽略富文本，必须通过 Web 表单提交
    if (updates.spec !== undefined || updates.verify !== undefined)
        return true;
    // 2. 如果包含自定义扩展字段（概要设计、自测说明、医疗风险等），必须通过 Web 表单提交
    if (Object.keys(updates).some(isCustomFieldKey))
        return true;
    // 3. 如果当前需求是草稿状态（draft），统一走 Web 编辑表单直改，避免 REST PUT 的副作用与字段丢失
    if (currentStory.status === "draft")
        return true;
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
];
