import { test } from "node:test";
import assert from "node:assert/strict";
import { connectMcp, readBody, startMockZentao } from "../helper.js";

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

test("unit/plan: list_product_plans 查询指定产品下的计划列表", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer((req, res) => {
    captured.url = req.url;
    captured.token = req.headers["token"];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        page: 1,
        total: 2,
        limit: 20,
        plans: [
          { id: 10, title: "2026 Q4 迭代计划", begin: "2026-10-01", end: "2026-10-31", status: "doing" },
          { id: 11, title: "2026 Q1 发布计划", begin: "2026-11-01", end: "2026-11-30", status: "wait" },
        ],
      })
    );
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const result = await client.callTool({
      name: "list_product_plans",
      arguments: { product_id: 1, page: 1, limit: 10 },
    });

    assert.notEqual(result.isError, true);
    assert.match(captured.url, /\/zentao\/api\.php\/v1\/products\/1\/productplans\?/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.plans.length, 2);
    assert.equal(parsed.plans[0].id, 10);
    assert.equal(parsed.plans[0].title, "2026 Q4 迭代计划");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/plan: get_plan 获取单个产品计划详情", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer((req, res) => {
    captured.url = req.url;
    if (req.url === "/zentao/api.php/v1/productplans/10") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 10,
          product: 1,
          title: "2026 Q4 迭代计划",
          begin: "2026-10-01",
          end: "2026-10-31",
          desc: "第四季度重点需求落地",
        })
      );
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
    const result = await client.callTool({
      name: "get_plan",
      arguments: { plan_id: 10 },
    });

    assert.notEqual(result.isError, true);
    assert.equal(captured.url, "/zentao/api.php/v1/productplans/10");
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, 10);
    assert.equal(parsed.title, "2026 Q4 迭代计划");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/plan: link_story_to_plan 优先调用官方 linkstories 接口", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "PUT" && req.url === "/zentao/api.php/v1/productplans/10/linkstories") {
      captured.body = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (req.method === "GET" && req.url === "/zentao/api.php/v1/stories/101") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 101,
          title: "扫码登录需求",
          product: 1,
          module: 3,
          plan: 10,
          pri: 2,
          assignedTo: "dev_lead",
          status: "active",
        })
      );
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const result = await client.callTool({
      name: "link_story_to_plan",
      arguments: { story_id: 101, plan_id: 10 },
    });

    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(captured.body), { stories: [101] });

    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.story_id, 101);
    assert.equal(parsed.plan_id, 10);
    assert.equal(parsed.story.plan, 10);
    assert.equal(parsed.story.module, 3);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/plan: link_story_to_plan 在官方接口 404 时回退到需求 PUT 并保留原字段", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/stories/101") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 101,
          title: "扫码登录需求",
          product: 1,
          module: 3,
          plan: 0,
          pri: 2,
          assignedTo: "dev_lead",
          spec: "不应被带回 PUT",
        })
      );
      return;
    }

    if (req.method === "PUT" && req.url === "/zentao/api.php/v1/stories/101") {
      captured.body = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 101, plan: 10, module: 3, pri: 2 }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const result = await client.callTool({
      name: "link_story_to_plan",
      arguments: { story_id: 101, plan_id: 10 },
    });

    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(captured.body), {
      plan: 10,
      module: 3,
      pri: 2,
      assignedTo: "dev_lead",
    });
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
