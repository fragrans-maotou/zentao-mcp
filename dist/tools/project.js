import { z } from "zod";
import { asError, zentaoApi, zentaoOk } from "../client.js";
export function registerProjectTools(server) {
    registerListProjects(server);
    registerGetProject(server);
    registerListProjectExecutions(server);
    registerListProjectStories(server);
}
function registerListProjects(server) {
    server.tool("list_projects", "获取禅道项目列表（支持分页与状态筛选），便于获取项目 ID (project_id) 以便查看其下的执行或关联需求。", {
        page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
        status: z.string().optional().describe("按项目状态筛选，如 wait(未开始), doing(进行中), suspended(挂起), closed(关闭) 等"),
    }, async ({ page = 1, limit = 20, status }) => {
        try {
            const query = { page, limit };
            if (status)
                query.status = status;
            const res = await zentaoApi("/projects", {
                query,
            });
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerGetProject(server) {
    server.tool("get_project", "根据项目 ID 获取单个禅道项目的详细信息（包含项目名称、代号、状态、负责人 PM、起止日期等）。", {
        project_id: z.number().int().describe("禅道项目 ID"),
    }, async ({ project_id }) => {
        try {
            const res = await zentaoApi(`/projects/${project_id}`);
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerListProjectExecutions(server) {
    server.tool("list_project_executions", "获取指定项目下的所有执行/迭代（Sprint/Execution）列表。", {
        project_id: z.number().int().describe("所属项目 ID"),
        page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
    }, async ({ project_id, page = 1, limit = 20 }) => {
        try {
            const res = await zentaoApi(`/projects/${project_id}/executions`, {
                query: { page, limit },
            });
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerListProjectStories(server) {
    server.tool("list_project_stories", "获取指定项目关联的研发需求列表。", {
        project_id: z.number().int().describe("所属项目 ID"),
        page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
    }, async ({ project_id, page = 1, limit = 20 }) => {
        try {
            const res = await zentaoApi(`/projects/${project_id}/stories`, {
                query: { page, limit },
            });
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
