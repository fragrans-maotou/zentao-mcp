import { z } from "zod";
import { asError, loginWithCredentials, zentaoOk } from "../client.js";
export function registerAuthTools(server) {
    server.tool("login", "登录禅道并获取 Token（若环境变量已配置 ZENTAO_ACCOUNT 和 ZENTAO_PASSWORD，其他工具会自动静默登录，无需手动调用本工具）。", {
        account: z
            .string()
            .optional()
            .describe("禅道登录账号，缺省时使用环境变量 ZENTAO_ACCOUNT"),
        password: z
            .string()
            .optional()
            .describe("禅道登录密码，缺省时使用环境变量 ZENTAO_PASSWORD"),
    }, async ({ account, password }) => {
        try {
            const token = await loginWithCredentials(account, password);
            return zentaoOk({
                ok: true,
                message: "登录成功，会话 Token 已保存，后续请求将自动携带",
                token,
            });
        }
        catch (err) {
            return asError(err);
        }
    });
}
