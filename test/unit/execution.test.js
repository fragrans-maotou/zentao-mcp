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

test("unit/execution: link_story_to_execution 成功关联需求到执行并自动补全所属产品 ID", { timeout: 15_000 }, async () => {
  const captured = { form: null, queryStory: null };

  const { server, base } = await setupMockServer(async (req, res) => {
    // 模拟自动查询需求详情以提取所属产品 ID
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/stories/47536") {
      captured.queryStory = true;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 47536, product: 48, title: "需求A" }));
      return;
    }

    // 模拟 execution-linkStory 表单接口
    if (req.method === "POST" && req.url.includes("/zentao/execution-linkStory-1507.json")) {
      captured.form = {
        url: req.url,
        headers: req.headers,
        body: await readBody(req),
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: "success", message: "保存成功" }));
      return;
    }

    // 关联后回查需求列表
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/executions/1507/stories")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          page: 1,
          total: 1,
          limit: 20,
          stories: [{ id: 47536, title: "需求A", product: 48 }],
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
      name: "link_story_to_execution",
      arguments: {
        execution_id: 1507,
        story_ids: 47536,
      },
    });

    assert.notEqual(result.isError, true);
    assert.ok(captured.form, "应当发起 execution-linkStory 请求");

    // 验证 Cookie 和 Token
    assert.ok(captured.form.headers.cookie.includes("zentaosid=mock-token"));
    assert.ok(captured.form.url.includes("zentaosid=mock-token"));

    // 验证 PHP 风格表单格式：stories[]=47536 以及 products[47536]=48
    assert.ok(captured.form.body.includes("stories%5B%5D=47536") || captured.form.body.includes("stories[]=47536"));
    assert.ok(captured.form.body.includes("products%5B47536%5D=48") || captured.form.body.includes("products[47536]=48"));

    const data = JSON.parse(result.content[0].text);
    assert.equal(data.success, true);
    assert.equal(data.execution_id, 1507);
    assert.deepEqual(data.story_ids, [47536]);
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/execution: link_story_to_execution 支持批量需求关联并使用传入的 products 映射", { timeout: 15_000 }, async () => {
  let formBody = "";

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "POST" && req.url.includes("/zentao/execution-linkStory-1507.json")) {
      formBody = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: "success" }));
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/executions/1507/stories")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: 2, stories: [] }));
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
      name: "link_story_to_execution",
      arguments: {
        execution_id: 1507,
        story_ids: [47536, 47537],
        products: {
          "47536": 48,
          "47537": 48,
        },
      },
    });

    assert.notEqual(result.isError, true);
    assert.ok(formBody.includes("stories%5B%5D=47536") || formBody.includes("stories[]=47536"));
    assert.ok(formBody.includes("stories%5B%5D=47537") || formBody.includes("stories[]=47537"));
    assert.ok(formBody.includes("products%5B47536%5D=48") || formBody.includes("products[47536]=48"));
    assert.ok(formBody.includes("products%5B47537%5D=48") || formBody.includes("products[47537]=48"));
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/execution: link_story_to_execution 在表单接口 404 时回退到 REST POST", { timeout: 15_000 }, async () => {
  const captured = { rest: null };

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/stories/47536") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 47536, product: 48, title: "需求A" }));
      return;
    }

    if (req.method === "POST" && req.url.startsWith("/zentao/api.php/v1/executions/1507/stories")) {
      captured.rest = {
        url: req.url,
        body: JSON.parse(await readBody(req)),
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success" }));
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/executions/1507/stories")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: 1, stories: [{ id: 47536 }] }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const result = await client.callTool({
      name: "link_story_to_execution",
      arguments: { execution_id: 1507, story_ids: 47536 },
    });

    assert.notEqual(result.isError, true);
    assert.ok(captured.rest, "表单 404 后应当回退 REST POST");
    assert.deepEqual(captured.rest.body.stories, [47536]);
    assert.equal(captured.rest.body.products["47536"], 48);
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/execution: list_executions 与 get_execution 查询执行信息", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/executions/1507")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 1507, name: "远程教学系统 V1.0.26.2", status: "doing" }));
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/executions")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ total: 1, executions: [{ id: 1507, name: "远程教学系统 V1.0.26.2" }] }));
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
      name: "list_executions",
      arguments: {},
    });
    assert.notEqual(listRes.isError, true);
    assert.ok(listRes.content[0].text.includes("1507"));

    const getRes = await client.callTool({
      name: "get_execution",
      arguments: { execution_id: 1507 },
    });
    assert.notEqual(getRes.isError, true);
    const detail = JSON.parse(getRes.content[0].text);
    assert.equal(detail.id, 1507);
    assert.equal(detail.name, "远程教学系统 V1.0.26.2");
  } finally {
    await client.close();
    server.close();
  }
});
