import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asError, zentaoApi, zentaoOk } from "../client.js";
import type { ZenTaoPagination, ZenTaoProduct } from "../types.js";

export function registerProductTools(server: McpServer) {
  server.tool(
    "list_products",
    "获取禅道产品列表，便于在创建或筛选需求时获取产品 ID (product)。",
    {
      page: z.number().int().min(1).optional().default(1).describe("页码，默认 1"),
      limit: z.number().int().min(1).max(100).optional().default(20).describe("每页条数，默认 20"),
    },
    async ({ page = 1, limit = 20 }) => {
      try {
        const res = await zentaoApi<ZenTaoPagination<ZenTaoProduct>>("/products", {
          query: { page, limit },
        });
        return zentaoOk(res);
      } catch (err) {
        return asError(err);
      }
    }
  );

  server.tool(
    "get_product",
    "根据产品 ID 获取单个禅道产品的详细信息。",
    {
      product_id: z.number().int().describe("禅道产品 ID"),
    },
    async ({ product_id }) => {
      try {
        const res = await zentaoApi<ZenTaoProduct>(`/products/${product_id}`);
        return zentaoOk(res);
      } catch (err) {
        return asError(err);
      }
    }
  );
}
