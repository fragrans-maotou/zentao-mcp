import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthTools } from "./auth.js";
import { registerPlanTools } from "./plan.js";
import { registerProductTools } from "./product.js";
import { registerStoryTools } from "./story.js";
import { registerTaskTools } from "./task.js";

export function registerTools(server: McpServer) {
  registerAuthTools(server);
  registerProductTools(server);
  registerPlanTools(server);
  registerStoryTools(server);
  registerTaskTools(server);
}

