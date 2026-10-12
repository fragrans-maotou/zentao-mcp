import { z } from "zod";
import { asError, zentaoApi, zentaoOk } from "../client.js";
export function registerTaskTools(server) {
    registerCreateTask(server);
    registerGetTask(server);
    registerUpdateTask(server);
}
function registerCreateTask(server) {
    server.tool("create_task", "在禅道中创建新任务（Task）。支持指定所属执行(迭代)、任务名称、类型、指派人、预计工时、关联需求(Story)、截止日期、优先级等。创建成功后自动获取并返回完整任务详情。", {
        execution: z.number().int().describe("所属执行/迭代 ID（必填，对应 executionID）"),
        name: z.string().min(1).describe("任务名称/标题（必填）"),
        type: z
            .string()
            .optional()
            .default("devel")
            .describe("任务类型，如 devel (开发), test (测试), design (设计), request (需求), study (调研), ui (UI设计), misc (其他) 等，默认 devel"),
        assignedTo: z.string().optional().describe("指派给的用户账号（可选）"),
        estimate: z.number().optional().describe("预计工时 (小时，可选)"),
        story: z.number().int().optional().describe("关联的相关研发需求 ID（可选）"),
        module: z.number().int().optional().describe("所属模块 ID（可选）"),
        estStarted: z.string().optional().describe("预计开始日期（格式 YYYY-MM-DD，可选）"),
        deadline: z.string().optional().describe("截止日期（格式 YYYY-MM-DD，可选）"),
        pri: z.number().int().min(1).max(4).optional().default(3).describe("优先级：1 (最高) 到 4 (最低)，默认 3"),
        desc: z.string().optional().describe("任务描述或实现要求（可选）"),
    }, async (args) => {
        try {
            const payload = {
                name: args.name,
                type: args.type,
                pri: args.pri,
            };
            if (args.assignedTo !== undefined && args.assignedTo !== null) {
                payload.assignedTo = args.assignedTo;
            }
            if (args.estimate !== undefined && args.estimate !== null) {
                payload.estimate = args.estimate;
            }
            if (args.story !== undefined && args.story !== null) {
                payload.story = args.story;
            }
            if (args.module !== undefined && args.module !== null) {
                payload.module = args.module;
            }
            if (args.estStarted !== undefined && args.estStarted !== null) {
                payload.estStarted = args.estStarted;
            }
            if (args.deadline !== undefined && args.deadline !== null) {
                payload.deadline = args.deadline;
            }
            if (args.desc !== undefined && args.desc !== null) {
                payload.desc = args.desc;
            }
            const res = await zentaoApi(`/executions/${args.execution}/tasks`, {
                method: "POST",
                body: payload,
            });
            const taskId = res?.id;
            if (taskId) {
                try {
                    const detail = await zentaoApi(`/tasks/${taskId}`);
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
function registerGetTask(server) {
    server.tool("get_task", "根据任务 ID (task_id) 获取单个禅道任务的完整详情，包含任务名称、类型、所属执行(execution)、关联需求(story)、指派人、状态、工时、优先级、截止日期、描述等全部信息。", {
        task_id: z.number().int().describe("禅道任务 ID"),
    }, async ({ task_id }) => {
        try {
            const res = await zentaoApi(`/tasks/${task_id}`);
            return zentaoOk(res);
        }
        catch (err) {
            return asError(err);
        }
    });
}
function registerUpdateTask(server) {
    server.tool("update_task", "编辑/修改任务属性（自动采用 Fetch-and-Merge 策略，绝不删除或清空所属执行、关联需求、模块等未修改字段；所有详情完整返回，修改的返回修改后的值，未修改的完整保留）。支持更新任务名称、执行、类型、指派人、工时、关联需求、模块、截止日期、优先级、描述等。", {
        task_id: z.number().int().describe("需要修改的任务 ID"),
        name: z.string().min(1).optional().describe("任务名称/标题"),
        execution: z.number().int().optional().describe("所属执行/迭代 ID（若不修改请留空，原所属执行将被自动完整保留）"),
        type: z.string().optional().describe("任务类型，如 devel, test, design, request 等"),
        assignedTo: z.string().optional().describe("指派给的用户账号"),
        estimate: z.number().optional().describe("预计工时 (小时)"),
        story: z.number().int().optional().describe("关联的相关需求 ID（若不修改请留空，原关联需求将被自动完整保留）"),
        module: z.number().int().optional().describe("所属模块 ID"),
        estStarted: z.string().optional().describe("预计开始日期（YYYY-MM-DD）"),
        deadline: z.string().optional().describe("截止日期（YYYY-MM-DD）"),
        pri: z.number().int().min(1).max(4).optional().describe("优先级：1 到 4"),
        desc: z.string().optional().describe("任务描述或实现要求"),
    }, async ({ task_id, ...updates }) => {
        const inputUpdates = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined && value !== null) {
                inputUpdates[key] = value;
            }
        }
        if (Object.keys(inputUpdates).length === 0) {
            return asError(new Error("请至少提供一个要编辑修改的任务字段"));
        }
        try {
            // 第一步：先查当前任务详情，防止丢失原有未修改的关联字段
            let currentTask;
            try {
                currentTask = await zentaoApi(`/tasks/${task_id}`);
            }
            catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                return asError(new Error(`无法读取任务 #${task_id} 的当前详情，已中止修改以免覆盖已有数据：${detail}`));
            }
            // 第二步：提取未变动的基准字段（如 execution, story, module, assignedTo 等）
            const preservedExecution = currentTask.execution ??
                currentTask.executionID ??
                currentTask.project;
            const preservedStory = currentTask.story;
            const preservedModule = currentTask.module;
            const preservedName = currentTask.name;
            const preservedType = currentTask.type;
            const preservedPri = currentTask.pri;
            const preservedEstimate = currentTask.estimate;
            const preservedDesc = currentTask.desc;
            const preservedEstStarted = currentTask.estStarted;
            const preservedDeadline = currentTask.deadline;
            let preservedAssignedTo;
            if (typeof currentTask.assignedTo === "string") {
                preservedAssignedTo = currentTask.assignedTo;
            }
            else if (currentTask.assignedTo && typeof currentTask.assignedTo === "object") {
                preservedAssignedTo = currentTask.assignedTo.account;
            }
            // 合并保留字段与更新字段
            const mergedBody = {};
            if (preservedExecution !== undefined && preservedExecution !== null) {
                mergedBody.execution = preservedExecution;
                mergedBody.executionID = preservedExecution;
            }
            if (preservedStory !== undefined && preservedStory !== null && preservedStory !== 0) {
                mergedBody.story = preservedStory;
            }
            if (preservedModule !== undefined && preservedModule !== null && preservedModule !== 0) {
                mergedBody.module = preservedModule;
            }
            if (preservedName)
                mergedBody.name = preservedName;
            if (preservedType)
                mergedBody.type = preservedType;
            if (preservedPri !== undefined)
                mergedBody.pri = preservedPri;
            if (preservedEstimate !== undefined)
                mergedBody.estimate = preservedEstimate;
            if (preservedDesc !== undefined)
                mergedBody.desc = preservedDesc;
            if (preservedEstStarted)
                mergedBody.estStarted = preservedEstStarted;
            if (preservedDeadline)
                mergedBody.deadline = preservedDeadline;
            if (preservedAssignedTo)
                mergedBody.assignedTo = preservedAssignedTo;
            // 应用用户明确传入的更新字段
            for (const [key, value] of Object.entries(inputUpdates)) {
                mergedBody[key] = value;
                if (key === "execution") {
                    mergedBody.executionID = value;
                }
            }
            // 第三步：提交修改
            await zentaoApi(`/tasks/${task_id}`, {
                method: "PUT",
                body: mergedBody,
            });
            // 第四步：回查最新任务详情，全量返回所有属性
            let latestTask;
            try {
                latestTask = await zentaoApi(`/tasks/${task_id}`);
            }
            catch { }
            return zentaoOk(latestTask ?? {
                ...currentTask,
                ...mergedBody,
                id: task_id,
            });
        }
        catch (err) {
            return asError(err);
        }
    });
}
