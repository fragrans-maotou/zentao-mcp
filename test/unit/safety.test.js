import { test } from "node:test";
import assert from "node:assert/strict";
import { connectMcp, startMockZentao } from "../helper.js";

test("unit/safety: 针对删除与关闭等高危操作进行安全防御拦截，不发起任何真实请求并返回 Web 操作指引", { timeout: 15_000 }, async () => {
  let anyRequestReceived = false;

  const { server, base } = await startMockZentao(async (req, res) => {
    // 任何非 token 请求都不应该被触发
    if (req.url !== "/zentao/api.php/v1/tokens") {
      anyRequestReceived = true;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ token: "mock-token" }));
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const toolsToTest = [
      { name: "delete_story", args: { story_id: 101 } },
      { name: "close_story", args: { story_id: 101 } },
      { name: "delete_task", args: { task_id: 202 } },
      { name: "close_task", args: { task_id: 202 } },
      { name: "delete_execution", args: { execution_id: 303 } },
      { name: "delete_project", args: { project_id: 404 } },
      { name: "unlink_story_from_execution", args: { execution_id: 303, story_id: 101 } },
    ];

    for (const item of toolsToTest) {
      const res = await client.callTool({
        name: item.name,
        arguments: item.args,
      });

      assert.notEqual(res.isError, true, `${item.name} 应当正常返回拦截说明对象`);
      const body = JSON.parse(res.content[0].text);
      assert.equal(body.safetyBlocked, true, `${item.name} 应当被 safetyBlocked 标记`);
      assert.match(body.message, /安全保护拦截/);
      assert.ok(body.webHint, `${item.name} 应当包含 webHint 页面指引`);
    }

    assert.equal(anyRequestReceived, false, "整个过程中绝不能向服务器发送任何破坏性的 DELETE 或修改请求");
  } finally {
    await client.close();
    server.close();
  }
});
