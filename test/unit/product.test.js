import { test } from "node:test";
import assert from "node:assert/strict";
import { connectMcp, readBody, startMockZentao } from "../helper.js";

test("unit/product: list_products 自动使用环境变量账号密码登录并查询产品列表", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await startMockZentao(async (req, res) => {
    if (req.method === "POST" && req.url === "/zentao/api.php/v1/tokens") {
      captured.loginBody = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: "auto-login-token" }));
      return;
    }

    if (req.url.startsWith("/zentao/api.php/v1/products")) {
      captured.url = req.url;
      captured.token = req.headers["token"];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          page: 1,
          total: 2,
          limit: 20,
          products: [
            { id: 1, name: "主打产品A", code: "PROD_A" },
            { id: 2, name: "衍生产品B", code: "PROD_B" },
          ],
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
      name: "list_products",
      arguments: { page: 1, limit: 10 },
    });

    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(captured.loginBody), {
      account: "test_user",
      password: "test_password",
    });
    assert.equal(captured.token, "auto-login-token");
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.products.length, 2);
    assert.equal(parsed.products[0].name, "主打产品A");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/product: get_product 查询单个产品详情", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await startMockZentao(async (req, res) => {
    if (req.method === "POST" && req.url === "/zentao/api.php/v1/tokens") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: "auto-login-token" }));
      return;
    }

    if (req.url === "/zentao/api.php/v1/products/1") {
      captured.url = req.url;
      captured.token = req.headers["token"];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 1,
          name: "主打产品A",
          code: "PROD_A",
          status: "normal",
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
      name: "get_product",
      arguments: { product_id: 1 },
    });

    assert.notEqual(result.isError, true);
    assert.equal(captured.url, "/zentao/api.php/v1/products/1");
    assert.equal(captured.token, "auto-login-token");
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, 1);
    assert.equal(parsed.name, "主打产品A");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
