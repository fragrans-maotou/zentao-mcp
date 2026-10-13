import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { postZentaoForm, zentaoOk, asError, getBaseUrl } from "../client.js";

const SUPPORTED_EXT_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function extractPersistedImageSrc(resText: string): string {
  const matches = [...resText.matchAll(/src=["']([^"']+)["']/gi)];
  const persisted = matches
    .map((match) => match[1])
    .find((src) => src && !src.toLowerCase().startsWith("data:"));
  if (!persisted) {
    throw new Error(`图片上传未返回有效图片地址：${resText}`);
  }
  return persisted;
}

export function getImageDataUrl(imagePath?: string, imageBase64?: string): string {
  if (imagePath) {
    const ext = path.extname(imagePath).toLowerCase();
    const mime = SUPPORTED_EXT_MIME[ext];
    if (!mime) {
      throw new Error(
        `当前仅支持上传图片附件（支持 png, jpg, jpeg, gif, webp, svg, bmp），暂不支持扩展名为 "${ext}" 的非图片附件`
      );
    }
    if (!fs.existsSync(imagePath)) {
      throw new Error(`找不到指定的图片文件：${imagePath}`);
    }
    const buffer = fs.readFileSync(imagePath);
    return `data:${mime};base64,${buffer.toString("base64")}`;
  }

  if (imageBase64) {
    const trimmed = imageBase64.trim();
    if (trimmed.startsWith("data:")) {
      if (!trimmed.startsWith("data:image/")) {
        throw new Error("当前仅支持上传图片附件，传入的 Base64 数据类型非 image/*");
      }
      return trimmed;
    }
    // 纯 Base64 字符串，默认作为 image/png
    return `data:image/png;base64,${trimmed}`;
  }

  throw new Error("请至少提供 image_path（本地图片路径）或 image_base64（Base64编码数据）中的一项");
}

export async function uploadImageToZentao(options: {
  image_path?: string;
  image_base64?: string;
  alt?: string;
}) {
  const dataUrl = getImageDataUrl(options.image_path, options.image_base64);
  const altText = escapeHtmlAttr(options.alt ?? "");
  const editorTag = `<img src="${dataUrl}" alt="${altText}" />`;

  const uid = Math.random().toString(16).substring(2, 15);
  const reqPath = `/file-ajaxPasteImg-${uid}.html`;

  const res = await postZentaoForm<string>(reqPath, {
    editor: editorTag,
  });

  const resText = typeof res === "string" ? res : JSON.stringify(res);
  const relativeUrl = extractPersistedImageSrc(resText);
  const fileIdMatch = relativeUrl.match(/file-read-(\d+)\./i);
  const fileId = fileIdMatch ? Number(fileIdMatch[1]) : undefined;

  const base = getBaseUrl();
  let fullUrl = relativeUrl;
  if (relativeUrl.startsWith("/")) {
    try {
      const urlObj = new URL(base);
      fullUrl = `${urlObj.origin}${relativeUrl}`;
    } catch {
      fullUrl = `${base.replace(/\/zentao\/?$/, "")}${relativeUrl}`;
    }
  }

  const cleanHtml = `<img src="${relativeUrl}" alt="${altText}" />`;

  return {
    success: true,
    file_id: fileId,
    url: fullUrl,
    relative_url: relativeUrl,
    html: cleanHtml,
    message: "图片上传成功，可直接将 html 字段内容嵌入需求描述(spec)或验收标准(verify)中使用",
  };
}

export function registerFileTools(server: McpServer) {
  server.tool(
    "upload_image",
    "上传图片到禅道富文本图片服务（支持本地图片路径或 Base64 编码，仅支持图片格式），返回已持久化的 HTML <img> 标签与访问链接。可直接将返回的 html 字段嵌入需求描述(spec)或验收标准(verify)等富文本字段中。",
    {
      image_path: z
        .string()
        .optional()
        .describe("本地图片文件完整路径（支持 png, jpg, jpeg, gif, webp, svg, bmp）"),
      image_base64: z
        .string()
        .optional()
        .describe("图片的 Base64 字符串或 Data URL（例如 data:image/png;base64,...）"),
      alt: z.string().optional().describe("图片描述说明文字 (alt 属性，默认为空)"),
    },
    async ({ image_path, image_base64, alt }) => {
      try {
        const result = await uploadImageToZentao({
          image_path,
          image_base64,
          alt,
        });
        return zentaoOk(result);
      } catch (err) {
        return asError(err);
      }
    }
  );
}
