import { z } from "zod";
import { asError, zentaoApi, zentaoOk } from "../client.js";
import { isNotFoundError, preservedAttributes } from "../storyPreserve.js";
export function registerPlanTools(server) {
    server.tool("list_product_plans", "获取指定产品下的产品计划列表（包含计划 ID、名称、起止日期、状态等）。业务规范流程：需求生成/创建完成后，AI 可先调用本工具查询产品计划，向用户询问并确认关联哪一个计划，或根据用户指定的计划进行关联。", {
        product_id: z.number().int().describe("所属产品 ID（必填）"),
        page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
        status: z
            .string()
            .optional()
            .describe("计划状态筛选，如 all(全部), doing(进行中), wait(未开始), done(已完成) 等"),
    }, async ({ product_id, page = 1, limit = 20, status }) => {
        try {
            const query = { page, limit };
            if (status)
                query.status = status;
            try {
                const res = await zentaoApi(`/products/${product_id}/plans`, { query });
                return zentaoOk(res);
            }
            catch (err) {
                // v1 主路径是 /plans；部分环境仍用 v2 风格 /productplans
                if (isNotFoundError(err)) {
                    const fallbackRes = await zentaoApi(`/products/${product_id}/productplans`, { query });
                    return zentaoOk(fallbackRes);
                }
                throw err;
            }
        }
        catch (err) {
            return asError(err);
        }
    });
    server.tool("get_plan", "根据产品计划 ID 获取单个计划的详细信息（包含名称、描述、起止时间等）。", {
        plan_id: z.number().int().describe("产品计划 ID"),
    }, async ({ plan_id }) => {
        try {
            try {
                const res = await zentaoApi(`/productplans/${plan_id}`);
                return zentaoOk(res);
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                if (errMsg.includes("404")) {
                    const fallbackRes = await zentaoApi(`/plans/${plan_id}`);
                    return zentaoOk(fallbackRes);
                }
                throw err;
            }
        }
        catch (err) {
            return asError(err);
        }
    });
    server.tool("link_story_to_plan", "将已生成或创建好的需求关联到指定产品计划（业务流程：需求创建完成后，再调用本工具关联到产品计划上）。优先调用官方 linkstories 接口；若环境不支持则回退更新需求 plan，并保留模块、优先级等易被清空的字段。", {
        story_id: z.number().int().describe("已生成的需求 ID"),
        plan_id: z.number().int().describe("目标产品计划 ID"),
    }, async ({ story_id, plan_id }) => {
        try {
            const linked = await linkStoriesToPlan(plan_id, story_id);
            if (!linked) {
                await linkStoryByUpdatingStory(story_id, plan_id);
            }
            let latestStory;
            try {
                latestStory = await zentaoApi(`/stories/${story_id}`);
            }
            catch { }
            return zentaoOk({
                ok: true,
                message: `需求 #${story_id} 已成功关联到产品计划 #${plan_id}`,
                story_id,
                plan_id,
                story: latestStory ?? { id: story_id, plan: plan_id },
            });
        }
        catch (err) {
            return asError(err);
        }
    });
}
async function linkStoriesToPlan(plan_id, story_id) {
    const body = { stories: [story_id] };
    try {
        await zentaoApi(`/productplans/${plan_id}/linkstories`, { method: "POST", body });
        return true;
    }
    catch (err) {
        if (!isNotFoundError(err))
            throw err;
    }
    try {
        await zentaoApi(`/plans/${plan_id}/linkstories`, { method: "POST", body });
        return true;
    }
    catch (err) {
        if (!isNotFoundError(err))
            throw err;
        return false;
    }
}
async function linkStoryByUpdatingStory(story_id, plan_id) {
    let currentStory;
    try {
        currentStory = await zentaoApi(`/stories/${story_id}`);
    }
    catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(`无法读取需求 #${story_id} 的当前详情，已中止关联计划以免覆盖已有字段：${detail}`);
    }
    await zentaoApi(`/stories/${story_id}`, {
        method: "PUT",
        body: {
            ...preservedAttributes(currentStory),
            plan: plan_id,
        },
    });
}
