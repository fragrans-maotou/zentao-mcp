import { z } from "zod";
import { asError, postZentaoForm, zentaoApi, zentaoOk } from "../client.js";
export function registerExecutionTools(server) {
    registerLinkStoryToExecution(server);
    registerListExecutions(server);
    registerGetExecution(server);
    registerListExecutionStories(server);
}
function registerLinkStoryToExecution(server) {
    server.tool("link_story_to_execution", "将已创建的需求关联到项目执行/迭代（Execution）中。对应禅道 execution 模块的 linkStory 方法。支持批量关联需求，自动智能补全每个需求所属的产品 ID (products)，通过 Web 会话提交关联并记录 linked2execution 动态，成功后全量返回关联详情与该执行下的需求。", {
        execution_id: z.number().int().describe("目标执行/迭代 ID（例如 1507）"),
        story_ids: z
            .union([z.array(z.number().int()), z.number().int()])
            .describe("要关联的需求 ID，支持单个数字或数字数组（例如 [47536, 47537]）"),
        products: z
            .record(z.string(), z.number().int())
            .optional()
            .describe("每个需求所属的产品 ID 映射，例如 {\"47536\": 48}。若不传，工具将自动查询每个需求的 product ID 智能填充"),
    }, async ({ execution_id, story_ids, products: inputProducts }) => {
        try {
            const storiesList = Array.isArray(story_ids) ? story_ids : [story_ids];
            if (storiesList.length === 0) {
                return asError(new Error("请至少提供一个要关联的需求 ID"));
            }
            // 智能解析并补全每个需求所属的产品 ID
            const productMap = { ...(inputProducts ?? {}) };
            for (const sid of storiesList) {
                const sidKey = String(sid);
                if (productMap[sidKey] === undefined) {
                    try {
                        const storyDetail = await zentaoApi(`/stories/${sid}`);
                        if (storyDetail?.product) {
                            productMap[sidKey] = storyDetail.product;
                        }
                    }
                    catch {
                        // 若未查到，保持尝试
                    }
                }
            }
            // 构造表单数据，兼容 stories[] 与 products[storyId]
            const formData = {
                stories: storiesList,
                products: productMap,
            };
            let linkResult;
            // 优先调用 Web 表单接口（伪静态路由 .json）
            try {
                linkResult = await postZentaoForm(`/execution-linkStory-${execution_id}.json`, formData);
            }
            catch {
                // 备选 1：动态路由格式
                try {
                    linkResult = await postZentaoForm(`/index.php?m=execution&f=linkStory&executionID=${execution_id}`, formData);
                }
                catch {
                    // 备选 2：RESTful 兼容端点 POST /executions/{executionID}/stories
                    try {
                        linkResult = await zentaoApi(`/executions/${execution_id}/stories`, {
                            method: "POST",
                            body: {
                                stories: storiesList,
                                products: productMap,
                            },
                        });
                    }
                    catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        return asError(new Error(`关联需求到执行 #${execution_id} 失败：${msg}`));
                    }
                }
            }
            // 关联完成后，回查执行详情及需求列表丰富返回数据
            let latestStories;
            try {
                latestStories = await zentaoApi(`/executions/${execution_id}/stories`);
            }
            catch { }
            return zentaoOk({
                success: true,
                message: `已成功将需求 [${storiesList.join(", ")}] 关联到执行/迭代 #${execution_id}`,
                execution_id,
                story_ids: storiesList,
                products: productMap,
                result: linkResult,
                storiesInExecution: latestStories,
            });
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerListExecutions(server) {
    server.tool("list_executions", "获取执行/迭代列表（支持按项目 ID 筛选、分页与状态筛选），便于获取执行 ID (execution_id) 以便关联需求或拆解任务。", {
        project_id: z.number().int().optional().describe("所属项目 ID（可选，传则查询指定项目下的执行）"),
        page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
        status: z.string().optional().describe("按状态筛选，如 wait(未开始), doing(进行中), suspended(已挂起), closed(已关闭) 等"),
    }, async ({ project_id, page = 1, limit = 20, status }) => {
        try {
            const query = { page, limit };
            if (status)
                query.status = status;
            const path = project_id ? `/projects/${project_id}/executions` : "/executions";
            const res = await zentaoApi(path, { query });
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerGetExecution(server) {
    server.tool("get_execution", "根据执行 ID 获取单个执行/迭代（Sprint/Execution）的详细信息，包含所属项目、名称、状态、起止日期等。", {
        execution_id: z.number().int().describe("执行 ID"),
    }, async ({ execution_id }) => {
        try {
            const res = await zentaoApi(`/executions/${execution_id}`);
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerListExecutionStories(server) {
    server.tool("list_execution_stories", "获取指定执行/迭代下已关联的所有研发需求列表。", {
        execution_id: z.number().int().describe("执行/迭代 ID"),
        page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
    }, async ({ execution_id, page = 1, limit = 20 }) => {
        try {
            const res = await zentaoApi(`/executions/${execution_id}/stories`, {
                query: { page, limit },
            });
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
