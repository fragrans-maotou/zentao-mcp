import { z } from "zod";
import { asError, postZentaoForm, zentaoApi, zentaoOk } from "../client.js";
import { customFieldsFromStory, formContentFromStory, isCustomFieldKey, preservedAttributes, STANDARD_UPDATE_KEYS, } from "../storyPreserve.js";
export function registerStoryTools(server) {
    registerCreateStory(server);
    registerGetStory(server);
    registerListStories(server);
    registerChangeStory(server);
    registerUpdateStory(server);
}
function registerCreateStory(server) {
    server.tool("create_story", "在禅道中创建新需求（Story）。支持指定产品ID、需求标题、描述、验收标准、优先级等。业务流程推荐：创建时 plan 可留空，待需求生成完成后，调用 list_product_plans 查询计划列表，向用户确认后通过 link_story_to_plan 关联到指定产品计划。", {
        product: z.number().int().describe("所属产品 ID（必填，可使用 list_products 查询）"),
        title: z.string().min(1).describe("需求名称/标题（必填）"),
        spec: z.string().optional().describe("需求详细描述，可包含背景与业务说明"),
        verify: z.string().optional().describe("验收标准，包含验收流程与测试判定规则"),
        pri: z.number().int().min(1).max(4).optional().default(3).describe("优先级：1 (最高) 到 4 (最低)，默认 3"),
        category: z
            .enum(["feature", "interface", "performance", "safe", "experience", "other"])
            .optional()
            .default("feature")
            .describe("需求类型，默认 feature"),
        module: z.number().int().optional().describe("所属模块 ID"),
        plan: z.number().int().optional().describe("关联的产品计划 ID（可选，常规流程为需求生成后通过 link_story_to_plan 关联）"),
        assignedTo: z.string().optional().describe("指派给的用户账号"),
        source: z.string().optional().describe("需求来源，如 customer, user, po 等"),
    }, async (args) => {
        try {
            const payload = {};
            for (const [key, value] of Object.entries(args)) {
                if (value !== undefined && value !== null) {
                    payload[key] = value;
                }
            }
            const res = await zentaoApi("/stories", {
                method: "POST",
                body: payload,
            });
            // 若创建接口返回了包含 ID 的简要数据，尝试回查完整详情以丰富返回内容
            if (res?.id) {
                try {
                    const detail = await zentaoApi(`/stories/${res.id}`);
                    if (detail)
                        return zentaoOk(detail);
                }
                catch { }
            }
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerGetStory(server) {
    server.tool("get_story", "根据需求 ID (story_id) 获取单个禅道需求的完整信息，包含标题、描述(spec)、验收标准(verify)、版本号、状态、所属计划(plan)、模块、优先级等所有详情。", {
        story_id: z.number().int().describe("禅道需求 ID"),
    }, async ({ story_id }) => {
        try {
            const res = await zentaoApi(`/stories/${story_id}`);
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerListStories(server) {
    server.tool("list_stories", "获取指定产品下的需求列表（支持分页与状态筛选），便于获取需求 ID 进行后续查看或变更。", {
        product_id: z.number().int().describe("所属产品 ID"),
        page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
        status: z.string().optional().describe("按需求状态筛选，如 active(激活), draft(草稿), changed(已变更), closed(已关闭) 等"),
    }, async ({ product_id, page = 1, limit = 20, status }) => {
        try {
            const query = { page, limit };
            if (status)
                query.status = status;
            const res = await zentaoApi(`/products/${product_id}/stories`, { query });
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerChangeStory(server) {
    server.tool("change_story", "变更需求内容（官方变更流程，升级版本号并触发重新评审）。支持变更评审者、研发需求名称、描述、需求分析(verify)、医疗风险和数据安全、需数据安全评审、概要设计、开发自测、备注等。变更后完整返回所有详情。", {
        story_id: z.number().int().describe("需要变更的需求 ID"),
        title: z.string().optional().describe("研发需求名称（标题）"),
        spec: z.string().optional().describe("需求描述详细内容"),
        verify: z.string().optional().describe("需求分析 / 验收标准"),
        reviewer: z
            .union([z.array(z.string()), z.string()])
            .optional()
            .describe("评审者账号，支持账号数组（如 [\"huangk\", \"zhantt\"]）或逗号分隔的字符串"),
        ttmedicalrisk: z.string().optional().describe("医疗风险和数据安全*"),
        ttisdatasafe: z.string().optional().describe("需数据安全评审（\"1\" 为是，\"0\" 为否）"),
        tthldesign: z.string().optional().describe("概要设计 (HLD)"),
        ttdevtest: z.string().optional().describe("开发自测说明"),
        bz: z.string().optional().describe("备注 (bz)"),
        comment: z.string().optional().describe("变更原因或备注说明"),
    }, async ({ story_id, title, spec, verify, reviewer, ttmedicalrisk, ttisdatasafe, tthldesign, ttdevtest, bz, comment, }) => {
        const body = {};
        if (title !== undefined)
            body.title = title;
        if (spec !== undefined)
            body.spec = spec;
        if (verify !== undefined)
            body.verify = verify;
        if (reviewer !== undefined)
            body.reviewer = reviewer;
        if (ttmedicalrisk !== undefined)
            body.ttmedicalrisk = ttmedicalrisk;
        if (ttisdatasafe !== undefined)
            body.ttisdatasafe = ttisdatasafe;
        if (tthldesign !== undefined)
            body.tthldesign = tthldesign;
        if (ttdevtest !== undefined)
            body.ttdevtest = ttdevtest;
        if (bz !== undefined)
            body.bz = bz;
        if (comment !== undefined)
            body.comment = comment;
        if (Object.keys(body).length === 0) {
            return asError(new Error("变更需求至少需要提供一项要变更的字段（评审者、研发需求名称、描述、需求分析、医疗风险和数据安全、需数据安全评审、概要设计、开发自测、备注）"));
        }
        try {
            const res = await zentaoApi(`/stories/${story_id}/change`, {
                method: "PUT",
                body,
            });
            // 变更成功后，回查最新完整需求详情（包含新版本号、未变动的plan/module等），全量返回给用户
            try {
                const detail = await zentaoApi(`/stories/${story_id}`);
                if (detail)
                    return zentaoOk(detail);
            }
            catch { }
            return zentaoOk(res ?? { success: true, message: "需求变更已提交成功", story_id });
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerUpdateStory(server) {
    server.tool("update_story", "编辑/更新需求属性（自动先查后合，绝不删除或清空所属计划 plan 等未修改字段；所有详情完整返回，修改的返回修改后的值，未修改的完整保留）。支持更新计划、优先级、模块、指派人、需求类型、概要设计、开发自测等属性。", {
        story_id: z.number().int().describe("需要更新的需求 ID"),
        plan: z.number().int().optional().describe("关联的产品计划 ID（若不修改请留空，原计划将被自动完整保留；若需修改请传入新计划 ID）"),
        pri: z.number().int().min(1).max(4).optional().describe("优先级：1 (最高) 到 4 (最低)"),
        module: z.number().int().optional().describe("所属模块 ID"),
        assignedTo: z.string().optional().describe("指派给的用户账号"),
        category: z
            .enum(["feature", "interface", "performance", "safe", "experience", "other"])
            .optional()
            .describe("需求类型"),
        source: z.string().optional().describe("需求来源"),
        estimate: z.number().optional().describe("预计工时 (小时)"),
        title: z.string().optional().describe("研发需求名称（标题）"),
        spec: z.string().optional().describe("需求描述详细内容"),
        verify: z.string().optional().describe("需求分析 / 验收标准"),
        tthldesign: z.string().optional().describe("概要设计 (HLD)"),
        ttdevtest: z.string().optional().describe("开发自测说明"),
        bz: z.string().optional().describe("备注 (bz)"),
        ttmedicalrisk: z.string().optional().describe("医疗风险和数据安全*"),
        ttisdatasafe: z.string().optional().describe("需数据安全评审（\"1\" 为是，\"0\" 为否）"),
    }, async ({ story_id, ...updates }) => {
        const inputUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined && value !== null) {
                inputUpdates[key] = value;
            }
        }
        if (Object.keys(inputUpdates).length === 0) {
            return asError(new Error("请至少提供一个要编辑更新的字段"));
        }
        try {
            let currentStory;
            try {
                currentStory = await zentaoApi(`/stories/${story_id}`);
            }
            catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                return asError(new Error(`无法读取需求 #${story_id} 的当前详情，已中止更新以免覆盖已有字段：${detail}`));
            }
            const preserved = preservedAttributes(currentStory);
            const restBody = { ...preserved };
            for (const [k, v] of Object.entries(inputUpdates)) {
                if (STANDARD_UPDATE_KEYS.includes(k)) {
                    restBody[k] = v;
                }
            }
            const hasCustom = Object.keys(inputUpdates).some(isCustomFieldKey);
            if (hasCustom) {
                const formBody = {
                    ...formContentFromStory(currentStory),
                    ...preserved,
                    ...customFieldsFromStory(currentStory),
                    ...inputUpdates,
                };
                try {
                    await postZentaoForm(`/story-edit-${story_id}.json`, formBody);
                }
                catch {
                    // 表单接口不可用时仍继续 REST 更新标准字段
                }
            }
            if (Object.keys(restBody).length > 0) {
                await zentaoApi(`/stories/${story_id}`, {
                    method: "PUT",
                    body: restBody,
                });
            }
            let latestStory;
            try {
                latestStory = await zentaoApi(`/stories/${story_id}`);
            }
            catch { }
            return zentaoOk(latestStory ?? {
                ...currentStory,
                ...restBody,
                ...inputUpdates,
                id: story_id,
            });
        }
        catch (err) {
            return asError(err);
        }
    });
}
