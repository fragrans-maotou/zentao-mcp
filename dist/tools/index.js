import { registerAuthTools } from "./auth.js";
import { registerPlanTools } from "./plan.js";
import { registerProductTools } from "./product.js";
import { registerStoryTools } from "./story.js";
import { registerTaskTools } from "./task.js";
export function registerTools(server) {
    registerAuthTools(server);
    registerProductTools(server);
    registerPlanTools(server);
    registerStoryTools(server);
    registerTaskTools(server);
}
