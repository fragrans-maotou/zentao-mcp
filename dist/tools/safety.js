import { z } from "zod";
import { getBaseUrl, zentaoOk } from "../client.js";
/**
 * 安全防御工具集：
 * 用户安全规则明确要求：
 * “警惕 删除与关闭等的api我们就不提供了，我们则注释并返回 让他去页面自己操作”
 *
 * 涉及数据物理删除、业务关闭、归档或移除关联的高危操作，
 * MCP 绝不向禅道发送任何破坏性请求，统一进行安全防御拦截，
 * 并返回引导用户前往禅道 Web 界面由具备权限的人员人工确认并操作的指引。
 */
export function registerSafetyDefensiveTools(server) {
    server.tool("delete_story", "【安全保护】删除需求。为保障研发资产安全，MCP 严格禁止自动化删除需求，请前往禅道 Web 界面手动操作。", {
        story_id: z.number().int().describe("需求 ID"),
    }, async ({ story_id }) => {
        let webHint = "";
        try {
            webHint = `${getBaseUrl()}/story-view-${story_id}.html`;
        }
        catch { }
        return zentaoOk({
            safetyBlocked: true,
            operation: "delete_story",
            story_id,
            message: "⚠️【安全保护拦截】：为保障需求数据与研发资产安全，MCP 服务禁止直接调用删除需求的 API。请登录禅道 Web 页面由项目管理员人工确认并操作。",
            webHint,
        });
    });
    server.tool("close_story", "【安全保护】关闭需求。为符合研发流程规范与审计要求，MCP 禁止直接自动化关闭需求，请前往禅道 Web 界面处理。", {
        story_id: z.number().int().describe("需求 ID"),
    }, async ({ story_id }) => {
        let webHint = "";
        try {
            webHint = `${getBaseUrl()}/story-close-${story_id}.html`;
        }
        catch { }
        return zentaoOk({
            safetyBlocked: true,
            operation: "close_story",
            story_id,
            message: "⚠️【安全保护拦截】：需求的关闭涉及验收与评审流程审计，MCP 服务不提供自动化关闭。请登录禅道 Web 界面进行业务关闭与原因归档。",
            webHint,
        });
    });
    server.tool("delete_task", "【安全保护】删除任务。为保障工时记录与团队进度数据完整，MCP 禁止删除任务，请在 Web 页面操作。", {
        task_id: z.number().int().describe("任务 ID"),
    }, async ({ task_id }) => {
        let webHint = "";
        try {
            webHint = `${getBaseUrl()}/task-view-${task_id}.html`;
        }
        catch { }
        return zentaoOk({
            safetyBlocked: true,
            operation: "delete_task",
            task_id,
            message: "⚠️【安全保护拦截】：任务删除会影响工时消耗统计与燃尽图计算，MCP 服务不提供直接删除接口。请前往禅道 Web 页面人工核对后处理。",
            webHint,
        });
    });
    server.tool("close_task", "【安全保护】关闭任务。任务关闭需核对实际工时与验收状态，请在禅道 Web 界面操作。", {
        task_id: z.number().int().describe("任务 ID"),
    }, async ({ task_id }) => {
        let webHint = "";
        try {
            webHint = `${getBaseUrl()}/task-close-${task_id}.html`;
        }
        catch { }
        return zentaoOk({
            safetyBlocked: true,
            operation: "close_task",
            task_id,
            message: "⚠️【安全保护拦截】：关闭任务涉及工时确认与验收，MCP 服务禁止直接自动化关闭。请在禅道 Web 界面完成任务验收后手动关闭。",
            webHint,
        });
    });
    server.tool("delete_execution", "【安全保护】删除执行/迭代。执行承载了团队需求与任务，严禁通过 API 删除，请前往 Web 页面操作。", {
        execution_id: z.number().int().describe("执行/迭代 ID"),
    }, async ({ execution_id }) => {
        let webHint = "";
        try {
            webHint = `${getBaseUrl()}/execution-view-${execution_id}.html`;
        }
        catch { }
        return zentaoOk({
            safetyBlocked: true,
            operation: "delete_execution",
            execution_id,
            message: "⚠️【安全保护拦截】：执行/迭代属于核心项目阶段，包含关联需求和所有任务，严禁自动化删除！请登录禅道 Web 页面操作。",
            webHint,
        });
    });
    server.tool("delete_project", "【安全保护】删除项目。项目删除属于最高风险操作，严禁通过 API 自动化执行，请前往 Web 页面操作。", {
        project_id: z.number().int().describe("项目 ID"),
    }, async ({ project_id }) => {
        let webHint = "";
        try {
            webHint = `${getBaseUrl()}/project-view-${project_id}.html`;
        }
        catch { }
        return zentaoOk({
            safetyBlocked: true,
            operation: "delete_project",
            project_id,
            message: "⚠️【安全保护拦截】：项目删除属于高危破坏性操作，MCP 服务严格禁止调用该接口！请登录禅道 Web 页面由高权限管理员手动操作。",
            webHint,
        });
    });
    server.tool("unlink_story_from_execution", "【安全保护】从执行/迭代中移除需求。移除需求会影响关联任务与燃尽图，请前往禅道 Web 界面手动解除关联。", {
        execution_id: z.number().int().describe("执行 ID"),
        story_id: z.number().int().describe("需求 ID"),
    }, async ({ execution_id, story_id }) => {
        let webHint = "";
        try {
            webHint = `${getBaseUrl()}/execution-story-${execution_id}.html`;
        }
        catch { }
        return zentaoOk({
            safetyBlocked: true,
            operation: "unlink_story_from_execution",
            execution_id,
            story_id,
            message: "⚠️【安全保护拦截】：从执行/迭代中移除需求将影响现有任务分配，MCP 服务不提供自动解除关联。请登录禅道 Web 界面在执行视图中手动移除。",
            webHint,
        });
    });
}
