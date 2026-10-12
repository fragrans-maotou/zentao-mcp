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

首次启动时 `npx` 会从 GitHub 拉取仓库并安装依赖，之后走本地缓存。当前未发布到 npm，所以仓库里会带上编译后的 `dist/`；改完源码后请先 `npm run build`，再把生成的 JS 一起提交。

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
- **说明**：编辑/更新需求属性字段（采用先查后合机制，自动保留未修改的字段，绝不冲掉或清空原有所属计划 `plan`；修改的返回修改后的值，未修改的完整保留）。
- **参数**：
  - `story_id` (number, 必填)：需求 ID
  - `plan` (number, 可选)：关联计划 ID（若不修改请留空，原计划将自动完整保留）
  - `pri` (number, 可选)：优先级 (1-4)
  - `module` (number, 可选)：所属模块 ID
  - `assignedTo` (string, 可选)：指派给的账号
  - `category` (string, 可选)：需求类型
  - `source` (string, 可选)：需求来源
  - `estimate` (number, 可选)：预估工时
  - `tthldesign` (string, 可选)：概要设计
  - `ttdevtest` (string, 可选)：开发自测说明
  - `bz` (string, 可选)：备注
  - `ttmedicalrisk` (string, 可选)：医疗风险和数据安全
  - `ttisdatasafe` (string, 可选)：需数据安全评审 ("1"/"0")
- **底层接口**：`PUT {ZENTAO_BASE}/api.php/v1/stories/{story_id}`

---

### 4. 产品计划领域 (`src/tools/plan.ts`)

#### `list_product_plans` (获取产品计划列表)
- **说明**：获取指定产品下的产品计划列表（包含计划 ID、名称、起止日期、状态等）。推荐工作流：需求生成/创建完成后，AI 调用本工具查询该产品下的计划列表，向用户询问确认选择哪一个计划，或直接关联用户指定的计划。
- **参数**：
  - `product_id` (number, 必填)：所属产品 ID
  - `page` (number, 可选, 默认 1)：页码
  - `limit` (number, 可选, 默认 20)：每页条数
  - `status` (string, 可选)：状态筛选（如 all, doing, wait, done）
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/products/{product_id}/productplans`

#### `get_plan` (获取产品计划详情)
- **说明**：根据计划 ID 获取单个产品计划的详细信息（包含关联的需求、Bug、起止日期等）。
- **参数**：
  - `plan_id` (number, 必填)：产品计划 ID
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/productplans/{plan_id}`

#### `link_story_to_plan` (需求关联到产品计划)
- **说明**：将已生成或创建好的需求关联到指定产品计划（业务流程：需求先创建完成，再调用本工具关联到计划上）。优先走官方关联接口，失败时再回退到更新需求 `plan` 字段，并保留易被清空的属性。
- **参数**：
  - `story_id` (number, 必填)：需求 ID
  - `plan_id` (number, 必填)：目标产品计划 ID
- **底层接口**：`PUT {ZENTAO_BASE}/api.php/v1/productplans/{plan_id}/linkstories`（404 时回退 `PUT .../stories/{story_id}`）

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
│       ├── plan.ts      # 计划领域：list_product_plans, get_plan, link_story_to_plan
│       ├── story.ts     # 需求领域：create_story, get_story, list_stories, change_story, update_story
│       └── index.ts     # 统一汇聚注册导出
└── test/
    ├── helper.js        # 测试辅助公共函数 (MockServer / McpClient)
    ├── unit/            # Mock 单元测试
    │   ├── auth.test.js
    │   ├── product.test.js
    │   ├── plan.test.js
    │   └── story.test.js
    └── integration/     # 依赖外部环境的集成测试
        └── live.test.js
```
