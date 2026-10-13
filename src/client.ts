let sessionToken = "";

export type ZentaoRequest = {
  method?: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
};

export function getEnvCredentials() {
  return {
    account: (process.env.ZENTAO_ACCOUNT ?? "").trim(),
    password: (process.env.ZENTAO_PASSWORD ?? "").trim(),
  };
}

export function getBaseUrl(): string {
  const base = (process.env.ZENTAO_BASE ?? "").trim();
  if (!base) {
    throw new Error(
      "缺少禅道地址，请设置环境变量 ZENTAO_BASE，例如 http://your-zentao-host/zentao"
    );
  }
  return base.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p.startsWith("/api.php/v1/") || p === "/api.php/v1") {
    return p;
  }
  if (p.startsWith("/api.php/")) {
    return p;
  }
  return `/api.php/v1${p}`;
}

function toQuery(query?: Record<string, unknown>): string {
  if (!query) return "";
  const entries = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return entries.length ? `?${new URLSearchParams(entries)}` : "";
}

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const TOKEN_FILE = path.join(os.homedir(), ".zentao_token");
const isTest = () => Boolean(process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === "test");

export function setSessionToken(token: string) {
  const value = token.trim();
  sessionToken = value.replace(/^(Token|Bearer)\s+/i, "");
  if (!isTest()) {
    try {
      if (sessionToken) {
        fs.writeFileSync(TOKEN_FILE, sessionToken, "utf-8");
      } else if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
    } catch {}
  }
}

export function clearSessionToken() {
  sessionToken = "";
  if (!isTest()) {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
    } catch {}
  }
}

export function getSessionToken(): string {
  if (!sessionToken && !isTest()) {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        sessionToken = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
      }
    } catch {}
  }
  return sessionToken;
}

export async function loginWithCredentials(
  accountInput?: string,
  passwordInput?: string
): Promise<string> {
  const envCreds = getEnvCredentials();
  const account = accountInput?.trim() || envCreds.account;
  const password = passwordInput?.trim() || envCreds.password;

  if (!account || !password) {
    throw new Error(
      "缺少登录账号或密码，请在配置中设置 ZENTAO_ACCOUNT 和 ZENTAO_PASSWORD 环境变量，或在 login 工具中传入账号密码"
    );
  }

  const res = await zentaoApi<{ token?: string }>("/tokens", {
    method: "POST",
    body: { account, password },
  });

  const token = res?.token;
  if (!token) {
    throw new Error(`登录未返回有效 Token：${JSON.stringify(res)}`);
  }

  setSessionToken(token);
  return token;
}

export async function ensureSessionToken(): Promise<string> {
  const token = getSessionToken();
  if (token) {
    return token;
  }

  const envCreds = getEnvCredentials();
  if (envCreds.account && envCreds.password) {
    return await loginWithCredentials(envCreds.account, envCreds.password);
  }

  throw new Error(
    "未登录或缺少 Token，请在配置中设置 ZENTAO_ACCOUNT 和 ZENTAO_PASSWORD 环境变量，或先调用 login 工具登录"
  );
}

export async function zentaoApi<T>(path: string, req: ZentaoRequest = {}): Promise<T> {
  const normalizedPath = normalizePath(path);
  const method = (req.method ?? (req.body !== undefined ? "POST" : "GET")).toUpperCase();
  const headers: Record<string, string> = { ...req.headers };
  const skipAuth = normalizedPath.endsWith("/tokens");

  if (!skipAuth) {
    const token = await ensureSessionToken();
    if (token) {
      headers["Token"] = token;
    }
  }

  const init: RequestInit = { method, headers };

  if (req.body !== undefined) {
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const fullUrl = `${getBaseUrl()}${normalizedPath}${toQuery(req.query)}`;
  const res = await fetch(fullUrl, init);

  if (res.status === 401 || res.status === 403) {
    if (!skipAuth) clearSessionToken();
    throw new Error("Token 无效或已过期，请检查 ZENTAO_ACCOUNT、ZENTAO_PASSWORD 或调用 login 重新登录");
  }

  const rawText = await res.text();
  const cleanText = rawText.replace(/^\uFEFF/, "").trim();

  if (!res.ok) {
    let errDetail = cleanText;
    try {
      const parsed = JSON.parse(cleanText);
      if (typeof parsed?.error === "string") {
        errDetail = parsed.error;
      } else if (parsed?.error) {
        errDetail = JSON.stringify(parsed.error);
      } else if (parsed?.message) {
        errDetail = parsed.message;
      }
    } catch {}
    throw new Error(`请求失败 (${res.status})：${errDetail}`);
  }

  if (!cleanText) {
    return undefined as T;
  }

  try {
    const data = JSON.parse(cleanText) as T;
    return data;
  } catch {
    throw new Error(`服务器响应格式错误（非 JSON）：${cleanText.slice(0, 300)}`);
  }
}

export function buildPhpFormData(data: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();

  function appendValue(prefix: string, value: unknown) {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          appendValue(`${prefix}[]`, item);
        } else {
          params.append(`${prefix}[]`, String(item));
        }
      }
    } else if (typeof value === "object") {
      for (const [subKey, subVal] of Object.entries(value)) {
        appendValue(`${prefix}[${subKey}]`, subVal);
      }
    } else {
      params.append(prefix, String(value));
    }
  }

  for (const [k, v] of Object.entries(data)) {
    appendValue(k, v);
  }
  return params;
}

export async function postZentaoForm<T = unknown>(
  path: string,
  formData: Record<string, unknown>
): Promise<T> {
  const token = await ensureSessionToken();
  const base = getBaseUrl();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}${sep}zentaosid=${token}`;

  const bodyParams = buildPhpFormData(formData);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: `zentaosid=${token};`,
      Token: token,
    },
    body: bodyParams.toString(),
  });

  const rawText = await res.text();
  const cleanText = rawText.replace(/^\uFEFF/, "").trim();

  if (res.status === 401 || res.status === 403) {
    clearSessionToken();
    throw new Error("Token 无效或已过期，请检查 ZENTAO_ACCOUNT、ZENTAO_PASSWORD 或调用 login 重新登录");
  }

  if (!res.ok) {
    throw new Error(`请求失败 (${res.status})：${cleanText.slice(0, 300)}`);
  }

  // 表单接口成功时可能返回 JSON，也可能返回 HTML 完成页
  try {
    return JSON.parse(cleanText) as T;
  } catch {
    return cleanText as unknown as T;
  }
}

export const zentaoOk = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: data !== undefined ? JSON.stringify(data, null, 2) : JSON.stringify({ success: true }, null, 2),
    },
  ],
});

export function asError(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  return {
    isError: true as const,
    content: [
      {
        type: "text" as const,
        text:
          text.includes("Token 无效") ||
          text.includes("未登录") ||
          text.includes("过期")
            ? "Token 无效或未登录，请检查 ZENTAO_ACCOUNT 与 ZENTAO_PASSWORD 环境变量，或调用 login 工具重新登录"
            : text,
      },
    ],
  };
}
