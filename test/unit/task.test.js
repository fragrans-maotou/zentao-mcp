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

test("unit/task: create_task 成功创建任务并回查完整详情", { timeout: 15_000 }, async () => {
  const captured = { post: null, get: null };
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/zentao/api.php/v1/executions/10/tasks") {
      captured.post = {
        method: req.method,
        url: req.url,
        body: JSON.parse(await readBody(req)),
      };
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: 201, status: "success" }));
      return;
    }

    if (req.method === "GET" && req.url === "/zentao/api.php/v1/tasks/201") {
      captured.get = { method: req.method, url: req.url };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 201,
          name: "实现禅道任务MCP工具",
          execution: 10,
          executionID: 10,
          type: "devel",
          story: 55,
          assignedTo: "admin",
          estimate: 6,
          pri: 1,
          status: "wait",
          deadline: "2026-10-20",
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
      name: "create_task",
      arguments: {
        execution: 10,
        name: "实现禅道任务MCP工具",
        type: "devel",
        story: 55,
        assignedTo: "admin",
        estimate: 6,
        pri: 1,
        deadline: "2026-10-20",
      },
    });

    assert.notEqual(result.isError, true);
    assert.ok(captured.post);
    assert.equal(captured.post.url, "/zentao/api.php/v1/executions/10/tasks");
    assert.equal(captured.post.body.name, "实现禅道任务MCP工具");
    assert.equal(captured.post.body.story, 55);
    assert.equal(captured.post.body.execution, undefined);
    assert.equal(captured.post.body.executionID, undefined);
    assert.equal(captured.post.body.estimate, 6);

    const text = result.content[0].text;
    const task = JSON.parse(text);
    assert.equal(task.id, 201);
    assert.equal(task.name, "实现禅道任务MCP工具");
    assert.equal(task.execution, 10);
    assert.equal(task.story, 55);
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/task: get_task 获取任务详情", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/tasks/301") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: 301,
          name: "编写单元测试与接口集成",
          execution: 12,
          type: "test",
          story: 88,
          status: "doing",
          pri: 2,
          estimate: 4,
          consumed: 2,
          left: 2,
          assignedTo: { account: "tester1", realname: "测试员" },
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
      name: "get_task",
      arguments: { task_id: 301 },
    });

    assert.notEqual(result.isError, true);
    const text = result.content[0].text;
    const task = JSON.parse(text);
    assert.equal(task.id, 301);
    assert.equal(task.name, "编写单元测试与接口集成");
    assert.equal(task.execution, 12);
    assert.equal(task.story, 88);
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/task: update_task 更新任务属性时自动保留未修改的执行(execution)、需求(story)等字段并全量返回", {
  timeout: 15_000,
}, async () => {
  const currentTaskData = {
    id: 501,
    name: "原任务标题",
    execution: 15,
    executionID: 15,
    type: "devel",
    story: 99,
    module: 4,
    pri: 3,
    estimate: 5,
    assignedTo: { account: "dev_user", realname: "研发" },
    desc: "原本的任务详细描述",
    estStarted: "2026-10-15",
    deadline: "2026-10-18",
  };

  let getCallCount = 0;
  let putBody = null;

  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/tasks/501") {
      getCallCount++;
      res.writeHead(200, { "Content-Type": "application/json" });
      if (getCallCount === 1) {
        res.end(JSON.stringify(currentTaskData));
      } else {
        res.end(
          JSON.stringify({
            ...currentTaskData,
            ...putBody,
            id: 501,
          })
        );
      }
      return;
    }

    if (req.method === "PUT" && req.url === "/zentao/api.php/v1/tasks/501") {
      putBody = JSON.parse(await readBody(req));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "success" }));
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
    // 仅修改工时 estimate 与优先级 pri，未修改 execution、story、module、assignedTo
    const result = await client.callTool({
      name: "update_task",
      arguments: {
        task_id: 501,
        estimate: 10,
        pri: 1,
      },
    });

    assert.notEqual(result.isError, true);
    assert.ok(putBody, "应当发送 PUT 请求");

    // 验证原有字段被完整保留并提交，防止被禅道清空
    assert.equal(putBody.execution, 15, "原有 execution 应当完整保留");
    assert.equal(putBody.executionID, 15, "原有 executionID 应当完整保留");
    assert.equal(putBody.story, 99, "原有 story 应当完整保留");
    assert.equal(putBody.module, 4, "原有 module 应当完整保留");
    assert.equal(putBody.name, "原任务标题", "原有 name 应当完整保留");
    assert.equal(putBody.type, "devel", "原有 type 应当完整保留");
    assert.equal(putBody.assignedTo, "dev_user", "原有 assignedTo 应当规范化提取账号保留");

    // 验证更新字段已生效
    assert.equal(putBody.estimate, 10, "修改后的工时应当生效");
    assert.equal(putBody.pri, 1, "修改后的优先级应当生效");

    // 验证全量返回了完整详情
    const task = JSON.parse(result.content[0].text);
    assert.equal(task.id, 501);
    assert.equal(task.estimate, 10);
    assert.equal(task.pri, 1);
    assert.equal(task.execution, 15);
    assert.equal(task.story, 99);
    assert.equal(task.module, 4);
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/task: update_task 参数为空时提示拦截", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({}));
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const result = await client.callTool({
      name: "update_task",
      arguments: { task_id: 123 },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /请至少提供一个要编辑修改的任务字段/);
  } finally {
    await client.close();
    server.close();
  }
});

test("unit/task: update_task 读取当前任务失败时中止更新", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/zentao/api.php/v1/tasks/999") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "任务不存在" }));
      return;
    }
    res.writeHead(500);
    res.end();
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    const result = await client.callTool({
      name: "update_task",
      arguments: { task_id: 999, name: "新名称" },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /无法读取任务 #999 的当前详情/);
  } finally {
    await client.close();
    server.close();
  }
});
