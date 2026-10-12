import { test } from "node:test";
import assert from "node:assert/strict";
import { connectMcp } from "../helper.js";

const liveBase = (process.env.ZENTAO_LIVE_BASE ?? "").trim();

test("integration: 针对真实部署的禅道服务器验证登录接口交互与错误返回", {
  timeout: 15_000,
  skip: liveBase ? false : "设置 ZENTAO_LIVE_BASE 后才会连接真实禅道环境",
}, async () => {
  const client = await connectMcp({
    ZENTAO_BASE: liveBase,
  });

  try {
    const result = await client.callTool({
      name: "login",
      arguments: {
        account: "test_integration_user",
        password: "test_integration_password",
      },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /登录失败/);
  } finally {
    await client.close();
  }
});
