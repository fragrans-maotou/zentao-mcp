import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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

test("unit/file: upload_image 支持传入 Base64 图片数据并返回持久化 img 标签与 URL", { timeout: 15_000 }, async () => {
  const captured = {};
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "POST" && req.url.includes("file-ajaxPasteImg")) {
      captured.method = req.method;
      captured.url = req.url;
      captured.headers = req.headers;
      captured.body = await readBody(req);

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end('<img src="/zentao/file-read-320907.png" alt="" />');
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
    const { tools } = await client.listTools();
    assert.ok(tools.some((t) => t.name === "upload_image"));

    const result = await client.callTool({
      name: "upload_image",
      arguments: {
        image_base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        alt: "示意图",
      },
    });

    assert.notEqual(result.isError, true);
    assert.ok(captured.url.includes("file-ajaxPasteImg"));
    assert.equal(captured.headers["x-requested-with"], "XMLHttpRequest");
    assert.ok(captured.body.includes("editor="));
    assert.ok(decodeURIComponent(captured.body).includes("示意图"));

    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.file_id, 320907);
    assert.equal(parsed.relative_url, "/zentao/file-read-320907.png");
    assert.equal(parsed.html, '<img src="/zentao/file-read-320907.png" alt="示意图" />');
    assert.ok(parsed.url.includes("/zentao/file-read-320907.png"));
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/file: upload_image 支持从本地图片文件路径读取并上传", { timeout: 15_000 }, async () => {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `test_img_${Date.now()}.png`);
  fs.writeFileSync(tmpFile, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const captured = {};
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "POST" && req.url.includes("file-ajaxPasteImg")) {
      captured.body = await readBody(req);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end('<img src="/zentao/file-read-320908.png" alt="" />');
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
      name: "upload_image",
      arguments: {
        image_path: tmpFile,
      },
    });

    assert.notEqual(result.isError, true);
    assert.ok(captured.body.includes("image%2Fpng"));

    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.success, true);
    assert.equal(parsed.file_id, 320908);
    assert.equal(parsed.relative_url, "/zentao/file-read-320908.png");
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/file: upload_image 拦截非图片格式附件（例如 zip 包）", { timeout: 15_000 }, async () => {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `test_archive_${Date.now()}.zip`);
  fs.writeFileSync(tmpFile, "dummy zip content");

  const { server, base } = await startMockZentao(async (req, res) => {
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
      name: "upload_image",
      arguments: {
        image_path: tmpFile,
      },
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("仅支持上传图片附件"));
    assert.ok(result.content[0].text.includes(".zip"));
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/file: upload_image 若禅道回显 data URL 而未返回持久化地址则失败", { timeout: 15_000 }, async () => {
  const { server, base } = await setupMockServer(async (req, res) => {
    if (req.method === "POST" && req.url.includes("file-ajaxPasteImg")) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end('<img src="data:image/png;base64,abc" alt="" />');
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
      name: "upload_image",
      arguments: {
        image_base64: "data:image/png;base64,abc",
      },
    });

    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("未返回有效图片地址"));
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("unit/file: upload_image 在缺少参数或文件不存在时给出清晰错误提示", { timeout: 15_000 }, async () => {
  const { server, base } = await startMockZentao(async (req, res) => {
    res.writeHead(404);
    res.end();
  });

  const client = await connectMcp({
    ZENTAO_BASE: base,
    ZENTAO_ACCOUNT: "test_user",
    ZENTAO_PASSWORD: "test_password",
  });

  try {
    // 1. 无任何参数
    const resNoArgs = await client.callTool({
      name: "upload_image",
      arguments: {},
    });
    assert.equal(resNoArgs.isError, true);
    assert.ok(resNoArgs.content[0].text.includes("至少提供 image_path"));

    // 2. 不存在的文件
    const resNotExist = await client.callTool({
      name: "upload_image",
      arguments: {
        image_path: "C:/non_existent_image_12345.png",
      },
    });
    assert.equal(resNotExist.isError, true);
    assert.ok(resNotExist.content[0].text.includes("找不到指定的图片文件"));
  } finally {
    await client.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
