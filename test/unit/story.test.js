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

test("unit/story: create_story 成功创建需求", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/zentao/api.php/v1/stories") {
      captured.method = req.method;
      captured.url = req.url;
      captured.headers = req.headers;
      captured.body = await readBody(req);
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 101,
          title: "支持第三方扫码登录",
          product: 1,
          pri: 2,
          status: "draft",
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
      name: "create_story",
      arguments: {
        product: 1,
        title: "支持第三方扫码登录",
        spec: "用户可以在移动端扫描二维码直接登录",
        verify: "APP扫码后页面在 1 秒内跳转",
        pri: 2,
      },
    });

    assert.notEqual(result.isError, true);
    assert.equal(captured.method, "POST");
    assert.equal(captured.url, "/zentao/api.php/v1/stories");
    assert.equal(captured.headers["token"], "mock-token");
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, 101);
    assert.equal(parsed.title, "支持第三方扫码登录");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: get_story 获取需求详情", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer((req, res) => {
    captured.url = req.url;
    captured.token = req.headers["token"];

    if (req.url === "/zentao/api.php/v1/stories/101") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 101,
          title: "支持第三方扫码登录",
          spec: "用户可以在移动端扫描二维码直接登录",
          verify: "APP扫码后页面在 1 秒内跳转",
          version: 1,
          status: "active",
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
      name: "get_story",
      arguments: { story_id: 101 },
    });

    assert.notEqual(result.isError, true);
    assert.equal(captured.url, "/zentao/api.php/v1/stories/101");
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, 101);
    assert.equal(parsed.version, 1);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: list_stories 查询产品下的需求列表", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer((req, res) => {
    captured.url = req.url;
    captured.token = req.headers["token"];

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        page: 1,
        total: 1,
        limit: 20,
        stories: [
          { id: 101, title: "支持第三方扫码登录", status: "active" },
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
      name: "list_stories",
      arguments: { product_id: 1, page: 1, limit: 10, status: "active" },
    });

    assert.notEqual(result.isError, true);
    assert.match(captured.url, /\/zentao\/api\.php\/v1\/products\/1\/stories\?/);
    assert.match(captured.url, /status=active/);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.stories[0].id, 101);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: change_story 变更需求描述并升级版本", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "PUT" && req.url === "/zentao/api.php/v1/stories/101/change") {
      captured.method = req.method;
      captured.url = req.url;
      captured.body = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 101,
          version: 2,
          status: "changed",
          title: "支持微信和企微扫码登录",
          spec: "新增支持企业微信扫码认证",
          verify: "企业微信扫码后完成SSO自动绑定",
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
      name: "change_story",
      arguments: {
        story_id: 101,
        title: "支持微信和企微扫码登录",
        spec: "新增支持企业微信扫码认证",
        verify: "企业微信扫码后完成SSO自动绑定",
        comment: "根据安全审计要求增加企业微信SSO支持",
      },
    });

    assert.notEqual(result.isError, true);
    assert.equal(captured.method, "PUT");
    assert.equal(captured.url, "/zentao/api.php/v1/stories/101/change");
    assert.deepEqual(JSON.parse(captured.body), {
      title: "支持微信和企微扫码登录",
      spec: "新增支持企业微信扫码认证",
      verify: "企业微信扫码后完成SSO自动绑定",
      comment: "根据安全审计要求增加企业微信SSO支持",
    });

    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.id, 101);
    assert.equal(parsed.version, 2);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: change_story 参数为空时提示拦截", { timeout: 15_000 }, async () => {
  const client = await connectMcp({
    ZENTAO_BASE: "http://127.0.0.1:9999/zentao",
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const result = await client.callTool({
      name: "change_story",
      arguments: {
        story_id: 101,
      },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /至少需要提供/);
  } finally {
    await client.close();
  }
});

test("unit/story: update_story 更新需求属性时自动保留原所属计划(plan)与未修改字段", { timeout: 15_000 }, async () => {
  const captured = {};
  let currentStory = {
    id: 101,
    title: "扫码登录需求",
    product: 1,
    plan: 88,
    module: 5,
    pri: 3,
    category: "feature",
    assignedTo: "original_dev",
  };

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/stories/101") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(currentStory));
      return;
    }

    if (req.method === "PUT" && req.url === "/zentao/api.php/v1/stories/101") {
      captured.putBody = await readBody(req);
      const parsedBody = JSON.parse(captured.putBody);
      currentStory = { ...currentStory, ...parsedBody };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(currentStory));
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
      name: "update_story",
      arguments: {
        story_id: 101,
        pri: 1,
        assignedTo: "dev_lead",
      },
    });

    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(captured.putBody), {
      plan: 88,
      module: 5,
      pri: 1,
      category: "feature",
      assignedTo: "dev_lead",
    });

    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.pri, 1);
    assert.equal(parsed.assignedTo, "dev_lead");
    assert.equal(parsed.plan, 88);
    assert.equal(parsed.module, 5);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: update_story 读取当前需求失败时中止更新", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "PUT") {
      captured.putCalled = true;
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
      name: "update_story",
      arguments: {
        story_id: 101,
        pri: 1,
      },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /已中止更新/);
    assert.equal(captured.putCalled, undefined);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: update_story 将 assignedTo 对象规范化为账号字符串", { timeout: 15_000 }, async () => {
  const captured = {};
  const currentStory = {
    id: 101,
    title: "扫码登录需求",
    plan: "88,90",
    module: 5,
    assignedTo: { account: "original_dev", realname: "原开发" },
  };

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/stories/101") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(currentStory));
      return;
    }
    if (req.method === "PUT" && req.url === "/zentao/api.php/v1/stories/101") {
      captured.putBody = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 101, pri: 2, plan: "88,90", assignedTo: "original_dev" }));
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
      name: "update_story",
      arguments: { story_id: 101, pri: 2 },
    });

    assert.notEqual(result.isError, true);
    assert.deepEqual(JSON.parse(captured.putBody), {
      plan: "88,90",
      module: 5,
      pri: 2,
      assignedTo: "original_dev",
    });
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: 未配置账号密码且未登录时调用返回登录提示", { timeout: 15_000 }, async () => {
  const client = await connectMcp({
    ZENTAO_BASE: "http://127.0.0.1:9999/zentao",
  });

  try {
    const result = await client.callTool({
      name: "create_story",
      arguments: {
        product: 1,
        title: "未登录测试",
      },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /ZENTAO_ACCOUNT/);
  } finally {
    await client.close();
  }
});

test("unit/story: edit_draft_story 直改草稿需求并携带 lastEditedDate 防并发编辑令牌与 Cookie", { timeout: 15_000 }, async () => {
  const captured = { form: null, formBody: "" };
  const currentStory = {
    id: 47536,
    product: 48,
    branch: 0,
    module: 2,
    plan: 10,
    title: "原草稿标题",
    status: "draft",
    stage: "wait",
    spec: "原需求描述",
    verify: "原验收标准",
    assignedTo: "developer1",
    lastEditedDate: "2026-10-13 10:34:25",
  };

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/stories/47536")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ...currentStory,
          spec: captured.form ? "更新后的详细需求描述" : currentStory.spec,
          verify: captured.form ? "更新后的验收标准" : currentStory.verify,
        })
      );
      return;
    }

    if (req.method === "POST" && req.url.includes("story-edit-47536")) {
      captured.form = {
        url: req.url,
        headers: req.headers,
      };
      captured.formBody = await readBody(req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: "success", message: "保存成功" }));
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
      name: "edit_draft_story",
      arguments: {
        story_id: 47536,
        spec: "更新后的详细需求描述",
        verify: "更新后的验收标准",
      },
    });

    assert.notEqual(result.isError, true);
    assert.ok(captured.form, "应当调用 story-edit Web 表单接口");
    assert.ok(captured.form.headers.cookie.includes("zentaosid=mock-token"));

    // 验证必须包含从原需求提取的 lastEditedDate 防并发编辑令牌
    assert.ok(
      captured.formBody.includes("lastEditedDate=2026-10-13+10%3A34%3A25") ||
      captured.formBody.includes("lastEditedDate=2026-10-13%2010%3A34%3A25")
    );
    // 验证包含 spec 与 verify
    assert.ok(captured.formBody.includes("spec="));
    assert.ok(captured.formBody.includes("verify="));
    // 验证包含状态 draft
    assert.ok(captured.formBody.includes("status=draft"));
    // 验证包含 needNotReview=1 防拦截标记
    assert.ok(captured.formBody.includes("needNotReview=1"));
    // 验证包含企业定制必填项默认补全：计划性质(inplan)、提测演示(1为否)、医疗风险(无)
    assert.ok(captured.formBody.includes("ttplan=inplan"));
    assert.ok(captured.formBody.includes("ttisperformance=1"));
    assert.ok(captured.formBody.includes("ttnetsafe="));

    const data = JSON.parse(result.content[0].text);
    assert.equal(data.id, 47536);
    assert.equal(data.spec, "更新后的详细需求描述");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: update_story 传入 spec 和 verify 时自动通过 Web story-edit 提交并避免被静默忽略", { timeout: 15_000 }, async () => {
  let webFormCalled = false;
  const currentStory = {
    id: 47536,
    product: 48,
    title: "草稿标题",
    status: "draft",
    spec: "旧描述",
    verify: "旧分析",
    lastEditedDate: "2026-10-13 10:34:25",
  };

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/stories/47536")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ...currentStory,
          spec: webFormCalled ? "新描述内容" : currentStory.spec,
        })
      );
      return;
    }

    if (req.method === "POST" && req.url.includes("story-edit-47536")) {
      webFormCalled = true;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: "success" }));
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
      name: "update_story",
      arguments: {
        story_id: 47536,
        spec: "新描述内容",
        pri: 2,
      },
    });

    assert.notEqual(result.isError, true);
    assert.equal(webFormCalled, true, "传入 spec 时必须触发 Web 端 story-edit 表单提交");
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: update_story 在 Web 编辑页全部失败时中止，避免把 spec 未保存当成成功", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/stories/47536")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 47536,
          product: 48,
          title: "草稿标题",
          status: "draft",
          spec: "旧描述",
          lastEditedDate: "2026-10-13 10:34:25",
        })
      );
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
      name: "update_story",
      arguments: {
        story_id: 47536,
        spec: "新描述内容",
      },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /无法通过 Web 编辑页保存需求 #47536/);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/story: edit_draft_story 在禅道服务端返回 result: fail 拒绝时准确抛出错误并提示原因", { timeout: 15_000 }, async () => {
  const currentStory = {
    id: 47536,
    product: 48,
    title: "草稿标题",
    status: "draft",
    spec: "旧描述",
    lastEditedDate: "2026-10-13 10:34:25",
  };

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url.startsWith("/zentao/api.php/v1/stories/47536")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(currentStory));
      return;
    }

    if (req.method === "POST" && req.url.includes("story-edit-47536")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ result: "fail", message: { reviewer: ["评审人不能为空"] } }));
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
      name: "edit_draft_story",
      arguments: {
        story_id: 47536,
        spec: "新描述内容",
      },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /评审人不能为空/);
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});


