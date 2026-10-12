import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

export function startMockZentao(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}/zentao` });
    });
  });
}

export async function connectMcp(env = {}) {
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(projectRoot, "dist", "index.js")],
    cwd: projectRoot,
    env: {
      ...process.env,
      ...env,
    },
    stderr: "inherit",
  });

  const client = new Client({ name: "zentao-test-client", version: "1.0.0" });
  await client.connect(transport);
  return client;
}
