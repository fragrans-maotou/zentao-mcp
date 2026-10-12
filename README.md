# 禅道（ZenTao）MCP Server

基于 Model Context Protocol (MCP) 构建的禅道项目管理工具集服务，采用按领域分层的模块化架构，支持 AI 助手（如 Antigravity、Claude 等）直接通过标准协议调用禅道 API。

---

## 快速上手

把下面这段复制到 MCP 客户端配置里，只改三处环境变量即可使用，无需本地克隆或编译。

```json
{
  "mcpServers": {
    "zentao": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/fragrans-maotou/zentao-mcp.git"],
      "env": {
        "ZENTAO_BASE": "http://your-zentao-host/zentao",
        "ZENTAO_ACCOUNT": "your_account",
        "ZENTAO_PASSWORD": "your_password"
      }
    }
  }
}
```

环境变量说明：
- `ZENTAO_BASE`: 禅道访问根地址，例如 `http://your-zentao-host/zentao`（必填）
- `ZENTAO_ACCOUNT`: 禅道登录账号（配置后，所有工具均支持自动静默登录）
- `ZENTAO_PASSWORD`: 禅道登录密码

首次启动时 `npx` 会从 GitHub 拉取并安装依赖，之后会走本地缓存。

### 本地开发与测试

```bash
# 安装依赖
npm install

# 编译项目
npm run build

# 运行全量单元测试与集成测试
npm test

# 仅运行单元测试 (Mock)
npm run test:unit

# 仅运行集成测试 (依赖外部真实服务)
npm run test:integration
```

---

## 模块化工具清单

### 1. 认证领域 (`src/tools/auth.ts`)

#### `login` (登录获取 Token)
- **说明**：通过禅道账号与密码登录，自动将获取的 Token 存入当前会话，后续所有接口请求将自动在 Header 中携带 `Token: <token>`。
- **参数**：
  - `account` (string, 必填)：禅道用户名/账号
  - `password` (string, 必填)：密码
- **底层接口**：`POST {ZENTAO_BASE}/api.php/v1/tokens`

---

### 2. 产品领域 (`src/tools/product.ts`)

#### `list_products` (查询产品列表)
- **说明**：获取当前账号有权限的产品列表与产品 ID，辅助创建或筛选需求时选择 `product` 参数。
- **参数**：
  - `page` (number, 可选, 默认 1)：页码
  - `limit` (number, 可选, 默认 20)：每页数量
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/products`

#### `get_product` (获取产品详情)
- **说明**：根据产品 ID 获取单个产品的详细信息。
- **参数**：
  - `product_id` (number, 必填)：产品 ID
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/products/{product_id}`

---

### 3. 需求领域 (`src/tools/story.ts`)

#### `create_story` (创建需求)
- **说明**：在禅道指定产品下创建新需求（Story）。
- **参数**：
  - `product` (number, 必填)：所属产品 ID（可先使用 `list_products` 查询）
  - `title` (string, 必填)：需求名称/标题
  - `spec` (string, 可选)：需求详细描述
  - `verify` (string, 可选)：验收标准
  - `pri` (number, 可选, 默认 3)：优先级 1~4
  - `category` (string, 可选, 默认 feature)：需求类型（如 feature, interface, performance, safe, experience, other）
  - `module` (number, 可选)：所属模块 ID
  - `plan` (number, 可选)：关联的产品计划 ID
  - `assignedTo` (string, 可选)：指派给的账号
  - `source` (string, 可选)：需求来源（如 customer, user, po 等）
- **底层接口**：`POST {ZENTAO_BASE}/api.php/v1/stories`

#### `get_story` (获取需求详情)
- **说明**：根据需求 ID 获取需求完整数据（包含标题、描述 spec、验收标准 verify、版本号 version、状态 status 等）。
- **参数**：
  - `story_id` (number, 必填)：需求 ID
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/stories/{story_id}`

#### `list_stories` (查询需求列表)
- **说明**：获取指定产品下的需求列表（支持分页与状态筛选），便于查询需求 ID 进行后续查看或变更。
- **参数**：
  - `product_id` (number, 必填)：所属产品 ID
  - `page` (number, 可选, 默认 1)：页码
  - `limit` (number, 可选, 默认 20)：每页条数
  - `status` (string, 可选)：需求状态筛选（如 active, draft, changed, closed）
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/products/{product_id}/stories`

#### `change_story` (变更需求内容)
- **说明**：**修改需求描述或验收标准请使用此工具**。符合禅道官方需求变更业务流，变更后禅道会自动生成新版本（version+1）。支持指定新的需求描述 `spec`、验收标准 `verify`、标题 `title`，以及变更原因备注 `comment`。
- **参数**：
  - `story_id` (number, 必填)：需求 ID
  - `spec` (string, 可选)：变更后的需求详细描述内容
  - `verify` (string, 可选)：变更后的验收标准
  - `title` (string, 可选)：变更后的需求标题
  - `comment` (string, 可选)：变更原因/备注说明
- **底层接口**：`PUT {ZENTAO_BASE}/api.php/v1/stories/{story_id}/change`

#### `update_story` (更新需求属性)
- **说明**：编辑需求的基本属性字段（非需求内容变更流程）。用于更新优先级、所属模块、关联计划、指派人、需求类型、需求来源等。
- **参数**：
  - `story_id` (number, 必填)：需求 ID
  - `pri` (number, 可选)：优先级 (1-4)
  - `module` (number, 可选)：所属模块 ID
  - `plan` (number, 可选)：关联计划 ID
  - `assignedTo` (string, 可选)：指派给的账号
  - `category` (string, 可选)：需求类型
  - `source` (string, 可选)：需求来源
  - `estimate` (number, 可选)：预估工时
- **底层接口**：`PUT {ZENTAO_BASE}/api.php/v1/stories/{story_id}`

---

## 目录结构

```
zentao/
├── config.example.json  # MCP 客户端服务配置示例
├── package.json         # 项目依赖与测试脚本
├── tsconfig.json        # TypeScript 编译配置
├── README.md            # 项目说明文档
├── src/
│   ├── index.ts         # MCP 服务注册与 stdio 启动
│   ├── client.ts        # 底层 HTTP 封装、Token 拦截与 UTF-8 BOM 清洗
│   ├── types.ts         # 禅道相关的核心接口类型定义
│   └── tools/           # 按业务领域拆分的工具目录
│       ├── auth.ts      # 认证领域：login
│       ├── product.ts   # 产品领域：list_products, get_product
│       ├── story.ts     # 需求领域：create_story, get_story, list_stories, change_story, update_story
│       └── index.ts     # 统一汇聚注册导出
└── test/
    ├── helper.js        # 测试辅助公共函数 (MockServer / McpClient)
    ├── unit/            # Mock 单元测试
    │   ├── auth.test.js
    │   ├── product.test.js
    │   └── story.test.js
    └── integration/     # 依赖外部环境的集成测试
        └── live.test.js
```
