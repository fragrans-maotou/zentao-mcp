import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asError, postZentaoForm, zentaoApi, zentaoOk } from "../client.js";
import {
  buildStoryEditForm,
  preservedAttributes,
  shouldSubmitStoryEditForm,
  STANDARD_UPDATE_KEYS,
} from "../storyPreserve.js";
import type { StoryChangeResult, ZenTaoPagination, ZenTaoStory } from "../types.js";

export function registerStoryTools(server: McpServer) {
  registerCreateStory(server);
  registerGetStory(server);
  registerListStories(server);
  registerChangeStory(server);
  registerUpdateStory(server);
  registerEditDraftStory(server);
}


function registerCreateStory(server: McpServer) {
  server.tool(
    "create_story",
    "在禅道中创建新需求（Story）。支持指定产品ID、需求标题、描述、验收标准、优先级等。业务流程推荐：创建时 plan 可留空，待需求生成完成后，调用 list_product_plans 查询计划列表，向用户确认后通过 link_story_to_plan 关联到指定产品计划。",
    {
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
    },
    async (args) => {
      try {
        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(args)) {
          if (value !== undefined && value !== null) {
            payload[key] = value;
          }
        }

        const res = await zentaoApi<ZenTaoStory>("/stories", {
          method: "POST",
          body: payload,
        });

        // 若创建接口返回了包含 ID 的简要数据，尝试回查完整详情以丰富返回内容
        if (res?.id) {
          try {
            const detail = await zentaoApi<ZenTaoStory>(`/stories/${res.id}`);
            if (detail) return zentaoOk(detail);
          } catch {}
        }

        return zentaoOk(res);
      } catch (err) {
        return asError(err);
      }
    }
  );
}

function registerGetStory(server: McpServer) {
  server.tool(
    "get_story",
    "根据需求 ID (story_id) 获取单个禅道需求的完整信息，包含标题、描述(spec)、验收标准(verify)、版本号、状态、所属计划(plan)、模块、优先级等所有详情。",
    {
      story_id: z.number().int().describe("禅道需求 ID"),
    },
    async ({ story_id }) => {
      try {
        const res = await zentaoApi<ZenTaoStory>(`/stories/${story_id}`);
        return zentaoOk(res);
      } catch (err) {
        return asError(err);
      }
    }
  );
}

function registerListStories(server: McpServer) {
  server.tool(
    "list_stories",
    "获取指定产品下的需求列表（支持分页与状态筛选），便于获取需求 ID 进行后续查看或变更。",
    {
      product_id: z.number().int().describe("所属产品 ID"),
      page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
      limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
      status: z.string().optional().describe("按需求状态筛选，如 active(激活), draft(草稿), changed(已变更), closed(已关闭) 等"),
    },
    async ({ product_id, page = 1, limit = 20, status }) => {
      try {
        const query: Record<string, unknown> = { page, limit };
        if (status) query.status = status;

        const res = await zentaoApi<ZenTaoPagination<ZenTaoStory>>(
          `/products/${product_id}/stories`,
          { query }
        );
        return zentaoOk(res);
      } catch (err) {
        return asError(err);
      }
    }
  );
}

function registerChangeStory(server: McpServer) {
  server.tool(
    "change_story",
    "变更需求内容（官方变更流程，升级版本号并触发重新评审）。支持变更评审者、研发需求名称、描述、需求分析(verify)、医疗风险和数据安全、需数据安全评审、概要设计、开发自测、备注等。变更后完整返回所有详情。",
    {
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
    },
    async ({
      story_id,
      title,
      spec,
      verify,
      reviewer,
      ttmedicalrisk,
      ttisdatasafe,
      tthldesign,
      ttdevtest,
      bz,
      comment,
    }) => {
      const body: Record<string, unknown> = {};
      if (title !== undefined) body.title = title;
      if (spec !== undefined) body.spec = spec;
      if (verify !== undefined) body.verify = verify;
      if (reviewer !== undefined) body.reviewer = reviewer;
      if (ttmedicalrisk !== undefined) body.ttmedicalrisk = ttmedicalrisk;
      if (ttisdatasafe !== undefined) body.ttisdatasafe = ttisdatasafe;
      if (tthldesign !== undefined) body.tthldesign = tthldesign;
      if (ttdevtest !== undefined) body.ttdevtest = ttdevtest;
      if (bz !== undefined) body.bz = bz;
      if (comment !== undefined) body.comment = comment;

      if (Object.keys(body).length === 0) {
        return asError(
          new Error(
            "变更需求至少需要提供一项要变更的字段（评审者、研发需求名称、描述、需求分析、医疗风险和数据安全、需数据安全评审、概要设计、开发自测、备注）"
          )
        );
      }

      try {
        const res = await zentaoApi<StoryChangeResult>(
          `/stories/${story_id}/change`,
          {
            method: "PUT",
            body,
          }
        );

        // 变更成功后，回查最新完整需求详情（包含新版本号、未变动的plan/module等），全量返回给用户
        try {
          const detail = await zentaoApi<ZenTaoStory>(`/stories/${story_id}`);
          if (detail) return zentaoOk(detail);
        } catch {}

        return zentaoOk(res ?? { success: true, message: "需求变更已提交成功", story_id });
      } catch (err) {
        return asError(err);
      }
    }
  );
}

async function submitStoryEditForm(
  storyId: number,
  formBody: Record<string, unknown>
): Promise<void> {
  const paths = [
    `/story-edit-${storyId}-default-story.html`,
    `/index.php?m=story&f=edit&storyID=${storyId}&from=default-story`,
    `/story-edit-${storyId}.html`,
  ];

  let lastError: unknown;
  for (const path of paths) {
    try {
      await postZentaoForm(path, formBody);
      return;
    } catch (err) {
      lastError = err;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "未知错误");
  throw new Error(`无法通过 Web 编辑页保存需求 #${storyId}：${detail}`);
}

async function applyStoryUpdates(
  story_id: number,
  updates: Record<string, unknown>
) {
  const inputUpdates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      inputUpdates[key] = value;
    }
  }

  if (Object.keys(inputUpdates).length === 0) {
    return asError(new Error("请至少提供一个要编辑更新的字段"));
  }

  try {
    let currentStory: ZenTaoStory;
    try {
      currentStory = await zentaoApi<ZenTaoStory>(`/stories/${story_id}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return asError(
        new Error(`无法读取需求 #${story_id} 的当前详情，已中止更新以免覆盖已有字段：${detail}`)
      );
    }

    const preserved = preservedAttributes(currentStory);

    // 判断是否需要通过 Web 端 story-edit 表单提交：
    // 当包含 spec(需求描述)、verify(验收标准/需求分析)、自定义扩展字段、或草稿状态修改时，
    // 由于 REST API PUT 会静默忽略富文本字段，必须走 Web 编辑页接口，并带上 lastEditedDate 防并发编辑令牌与 needNotReview: 1
    const needWebForm = shouldSubmitStoryEditForm(currentStory, inputUpdates);
    if (needWebForm) {
      const formBody = buildStoryEditForm(currentStory, inputUpdates);
      await submitStoryEditForm(story_id, formBody);
      // Web 端 story-edit 表单已全量保存（包含属性、计划、描述、验收标准与扩展字段），
      // 严禁在此之后再次调用 REST PUT，否则 REST 接口会因缺少 spec/verify 字段而重置需求描述
    } else {
      // 仅当非草稿且纯修改属性字段时，调用 REST API PUT
      const restBody: Record<string, unknown> = { ...preserved };
      for (const [k, v] of Object.entries(inputUpdates)) {
        if ((STANDARD_UPDATE_KEYS as readonly string[]).includes(k)) {
          restBody[k] = v;
        }
      }

      if (Object.keys(restBody).length > 0) {
        await zentaoApi<ZenTaoStory>(`/stories/${story_id}`, {
          method: "PUT",
          body: restBody,
        });
      }
    }

    // 更新后全量回查最新需求详情并返回
    let latestStory: ZenTaoStory | undefined;
    try {
      latestStory = await zentaoApi<ZenTaoStory>(`/stories/${story_id}`);
    } catch {}

    return zentaoOk(
      latestStory ?? {
        ...currentStory,
        ...inputUpdates,
        id: story_id,
      }
    );
  } catch (err) {
    return asError(err);
  }
}

function registerUpdateStory(server: McpServer) {
  server.tool(
    "update_story",
    "编辑/更新需求属性与内容（自动先查后合，绝不删除或清空所属计划 plan 等未修改字段；已彻底解决禅道 REST PUT 忽略 spec/verify 的问题，自动注入 lastEditedDate 防并发令牌与 Web Cookie 会话，支持修改富文本描述、验收标准、计划、优先级、模块、指派人等所有字段，全量返回最新详情）。",
    {
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
      spec: z.string().optional().describe("需求描述详细内容 (富文本已支持通过 Web 编辑页直接保存)"),
      verify: z.string().optional().describe("需求分析 / 验收标准 (富文本已支持通过 Web 编辑页直接保存)"),
      tthldesign: z.string().optional().describe("概要设计 (HLD)"),
      ttdevtest: z.string().optional().describe("开发自测说明"),
      bz: z.string().optional().describe("备注 (bz)"),
      ttmedicalrisk: z.string().optional().describe("医疗风险和数据安全（默认为 \"无\"）"),
      ttnetsafe: z.string().optional().describe("医疗风险和数据安全（默认为 \"无\"）"),
      ttisdatasafe: z.string().optional().describe("需数据安全评审（\"1\" 为是，\"0\" 为否，默认 \"1\"）"),
      ttplan: z.enum(["inplan", "outplan"]).optional().describe("计划性质：inplan (计划内，默认) 或 outplan (计划外)"),
      ttisperformance: z.enum(["0", "1", "2"]).optional().describe("需提测演示：\"1\" (否，默认) 或 \"2\" (是)，传入 \"0\" 亦自动兼容映射为否"),
      ttisdesigncheck: z.enum(["0", "1"]).optional().describe("需架构设计评审：\"1\" (是，默认) 或 \"0\" (否)"),
      status: z.enum(["draft", "active"]).optional().describe("需求状态：draft (保持草稿) 或 active (激活需求)"),
    },
    async ({ story_id, ...updates }) => {
      return applyStoryUpdates(story_id, updates);
    }
  );
}

function registerEditDraftStory(server: McpServer) {
  server.tool(
    "edit_draft_story",
    "直接编辑草稿需求内容（直改 spec 描述与 verify 验收标准，无版本号上升与重新评审副作用）。对应禅道 Web 端 story-edit 页面机制。自动提取并携带 lastEditedDate 防并发编辑令牌与 Web 会话 Cookie，已自动适配计划性质(ttplan)、提测演示(ttisperformance)、医疗风险(ttmedicalrisk/ttnetsafe)等必填字段默认值，支持修改需求描述、验收标准、标题、优先级、模块、类别、所属计划等，保存后全量返回最新详情。",
    {
      story_id: z.number().int().describe("需要编辑的草稿需求 ID"),
      title: z.string().optional().describe("需求标题"),
      spec: z.string().optional().describe("需求详细描述 (spec)"),
      verify: z.string().optional().describe("需求分析 / 验收标准 (verify)"),
      pri: z.number().int().min(1).max(4).optional().describe("优先级：1 到 4"),
      module: z.number().int().optional().describe("所属模块 ID"),
      plan: z.number().int().optional().describe("关联的产品计划 ID"),
      assignedTo: z.string().optional().describe("指派给的用户账号"),
      category: z
        .enum(["feature", "interface", "performance", "safe", "experience", "other"])
        .optional()
        .describe("需求类型"),
      estimate: z.number().optional().describe("预计工时 (小时)"),
      tthldesign: z.string().optional().describe("概要设计 (HLD)"),
      ttdevtest: z.string().optional().describe("开发自测说明"),
      bz: z.string().optional().describe("备注 (bz)"),
      ttmedicalrisk: z.string().optional().describe("医疗风险和数据安全（默认为 \"无\"）"),
      ttnetsafe: z.string().optional().describe("医疗风险和数据安全（默认为 \"无\"）"),
      ttisdatasafe: z.string().optional().describe("需数据安全评审（\"1\" 为是，\"0\" 为否，默认 \"1\"）"),
      ttplan: z.enum(["inplan", "outplan"]).optional().describe("计划性质：inplan (计划内，默认) 或 outplan (计划外)"),
      ttisperformance: z.enum(["0", "1", "2"]).optional().describe("需提测演示：\"1\" (否，默认) 或 \"2\" (是)，传入 \"0\" 亦自动兼容映射为否"),
      ttisdesigncheck: z.enum(["0", "1"]).optional().describe("需架构设计评审：\"1\" (是，默认) 或 \"0\" (否)"),
      status: z.enum(["draft", "active"]).optional().default("draft").describe("保存状态：draft (默认保持草稿) 或 active (转为激活)"),
    },
    async ({ story_id, ...updates }) => {
      return applyStoryUpdates(story_id, updates);
    }
  );
}

