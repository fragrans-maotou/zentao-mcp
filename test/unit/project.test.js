import { test } from "node:test";
import assert from "node:assert/strict";
import { connectMcp, startMockZentao } from "../helper.js";

function setupMockServer(handler) {
  return startMockZentao(async (req, res) => {
    if (req.method === "POST" && req.url === "/zentao/api.php/v1/tokens") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: "mock-token" }));
      return;
    }
    return handler(req, res);
  });
}

test("unit/project: list_projects 与 get_project 获取项目信息", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/projects/10")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 10, name: "在线教育中台项目", status: "doing" }));
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/projects")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: 1, projects: [{ id: 10, name: "在线教育中台项目" }] }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const listRes = await client.callTool({
      name: "list_projects",
      arguments: {},
    });
    assert.notEqual(listRes.isError, true);
    assert.ok(listRes.content[0].text.includes("10"));

    const getRes = await client.callTool({
      name: "get_project",
      arguments: { project_id: 10 },
    });
    assert.notEqual(getRes.isError, true);
    const detail = JSON.parse(getRes.content[0].text);
    assert.equal(detail.id, 10);
    assert.equal(detail.name, "在线教育中台项目");
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/project: list_project_executions 与 list_project_stories 查询项目下执行和需求", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/projects/10/executions")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: 1, executions: [{ id: 101, name: "迭代一" }] }));
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/projects/10/stories")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: 1, stories: [{ id: 501, title: "需求1" }] }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const execRes = await client.callTool({
      name: "list_project_executions",
      arguments: { project_id: 10 },
    });
    assert.notEqual(execRes.isError, true);
    assert.ok(execRes.content[0].text.includes("101"));

    const storyRes = await client.callTool({
      name: "list_project_stories",
      arguments: { project_id: 10 },
    });
    assert.notEqual(storyRes.isError, true);
    assert.ok(storyRes.content[0].text.includes("501"));
  } finally {
    await client.close();
    server.close();
  }
});
