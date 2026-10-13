import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthTools } from "./auth.js";
import { registerPlanTools } from "./plan.js";
import { registerProductTools } from "./product.js";
import { registerProjectTools } from "./project.js";
import { registerExecutionTools } from "./execution.js";
import { registerStoryTools } from "./story.js";
import { registerTaskTools } from "./task.js";
import { registerSafetyDefensiveTools } from "./safety.js";

export function registerTools(server: McpServer) {
  registerAuthTools(server);
  registerProductTools(server);
  registerProjectTools(server);
  registerExecutionTools(server);
  registerPlanTools(server);
  registerStoryTools(server);
  registerTaskTools(server);
  registerSafetyDefensiveTools(server);
}


