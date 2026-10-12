import { registerAuthTools } from "./auth.js";
import { registerProductTools } from "./product.js";
import { registerStoryTools } from "./story.js";
export function registerTools(server) {
    registerAuthTools(server);
    registerProductTools(server);
    registerStoryTools(server);
}
