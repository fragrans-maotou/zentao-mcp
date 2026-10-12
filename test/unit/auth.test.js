import { test } from "node:test";
import assert from "node:assert/strict";
import { connectMcp, readBody, startMockZentao } from "../helper.js";

test("unit/auth: login 成功获取 Token 并保存到当前会话", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await startMockZentao(async (req, res) => {
    captured.method = req.method;
    captured.url = req.url;
    captured.body = await readBody(req);

    if (req.method === "POST" && req.url === "/zentao/api.php/v1/tokens") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("\uFEFF" + JSON.stringify({ token: "test-auth-token-123" }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
  });

  try {
    const { tools } = await client.listTools();
    assert.ok(tools.some((t) => t.name === "login"));

    const result = await client.callTool({
      name: "login",
      arguments: {
        account: "admin",
        password: "secret_password",
      },
    });

    assert.notEqual(result.isError, true);
    assert.equal(captured.method, "POST");
    assert.equal(captured.url, "/zentao/api.php/v1/tokens");
    assert.deepEqual(JSON.parse(captured.body), {
      account: "admin",
      password: "secret_password",
    });

    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.token, "test-auth-token-123");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/auth: login 省略参数时自动使用环境变量 ZENTAO_ACCOUNT 与 ZENTAO_PASSWORD", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await startMockZentao(async (req, res) => {
    captured.body = await readBody(req);
    if (req.method === "POST" && req.url === "/zentao/api.php/v1/tokens") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: "env-token-456" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "env_admin",
    ZENTAO_PASSWORD: "env_password",
  });

  try {
    const result = await client.callTool({
      name: "login",
      arguments: {},
    });

    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(captured.body), {
      account: "env_admin",
      password: "env_password",
    });
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.token, "env-token-456");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/auth: 登录失败或未返回 Token 时返回错误信息", { timeout: 15_000 }, async () => {
  const { server, base } = await startMockZentao((req, res) => {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "用户名或密码错误" }));
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
  });

  try {
    const result = await client.callTool({
      name: "login",
      arguments: {
        account: "admin",
        password: "wrong_password",
      },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /用户名或密码错误/);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
