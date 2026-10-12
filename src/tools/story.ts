import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asError, postZentaoForm, zentaoApi, zentaoOk } from "../client.js";
import type { StoryChangeResult, ZenTaoPagination, ZenTaoStory } from "../types.js";

export function registerStoryTools(server: McpServer) {
  registerCreateStory(server);
  registerGetStory(server);
  registerListStories(server);
  registerChangeStory(server);
  registerUpdateStory(server);
}

function registerCreateStory(server: McpServer) {
  server.tool(
    "create_story",
    "在禅道中创建新需求（Story）。支持指定产品ID、需求标题、描述、验收标准、优先级等。",
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
      plan: z.number().int().optional().describe("关联的产品计划 ID"),
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
    "根据需求 ID (story_id) 获取单个禅道需求的完整信息，包含标题、描述(spec)、验收标准(verify)、版本号、状态等。",
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
    "变更需求内容（官方变更流程，升级版本号并触发重新评审）。支持变更评审者、研发需求名称、描述、需求分析(verify)、医疗风险和数据安全、需数据安全评审、概要设计、开发自测、备注等。",
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
        return zentaoOk(res ?? { success: true, message: "需求变更已提交成功", story_id });
      } catch (err) {
        return asError(err);
      }
    }
  );
}

function registerUpdateStory(server: McpServer) {
  server.tool(
    "update_story",
    "直接编辑需求（非官方变更流程，不升级版本号、不触发重新评审）。支持修改概要设计、开发自测、备注、医疗风险和数据安全*、需数据安全评审，以及基础属性与描述等。",
    {
      story_id: z.number().int().describe("需要更新的需求 ID"),
      tthldesign: z.string().optional().describe("概要设计 (HLD)"),
      ttdevtest: z.string().optional().describe("开发自测说明"),
      bz: z.string().optional().describe("备注 (bz)"),
      ttmedicalrisk: z.string().optional().describe("医疗风险和数据安全*"),
      ttisdatasafe: z.string().optional().describe("需数据安全评审（\"1\" 为是，\"0\" 为否）"),
      title: z.string().optional().describe("研发需求名称（标题）"),
      spec: z.string().optional().describe("需求描述详细内容"),
      verify: z.string().optional().describe("需求分析 / 验收标准"),
      pri: z.number().int().min(1).max(4).optional().describe("优先级：1 (最高) 到 4 (最低)"),
      module: z.number().int().optional().describe("所属模块 ID"),
      plan: z.number().int().optional().describe("关联的产品计划 ID"),
      assignedTo: z.string().optional().describe("指派给的用户账号"),
      category: z
        .enum(["feature", "interface", "performance", "safe", "experience", "other"])
        .optional()
        .describe("需求类型"),
      source: z.string().optional().describe("需求来源"),
      estimate: z.number().optional().describe("预计工时 (小时)"),
    },
    async ({ story_id, ...updates }) => {
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined && value !== null) {
          body[key] = value;
        }
      }

      if (Object.keys(body).length === 0) {
        return asError(new Error("请至少提供一个要编辑更新的字段"));
      }

      try {
        const customFieldKeys = [
          "tthldesign",
          "ttdevtest",
          "bz",
          "ttmedicalrisk",
          "ttisdatasafe",
          "ttnetsafe",
        ];
        const hasCustom = Object.keys(body).some((k) => customFieldKeys.includes(k));

        if (hasCustom) {
          await postZentaoForm(`/story-edit-${story_id}.json`, body);
        }

        const standardKeys = [
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
        const standardBody: Record<string, unknown> = {};
        for (const k of standardKeys) {
          if (body[k] !== undefined) standardBody[k] = body[k];
        }

        let res: ZenTaoStory | undefined;
        if (Object.keys(standardBody).length > 0) {
          res = await zentaoApi<ZenTaoStory>(`/stories/${story_id}`, {
            method: "PUT",
            body: standardBody,
          });
        }

        return zentaoOk(res ?? { success: true, story_id });
      } catch (err) {
        return asError(err);
      }
    }
  );
}
