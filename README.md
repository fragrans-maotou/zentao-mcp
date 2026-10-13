# 禅道（ZenTao）MCP Server

基于 Model Context Protocol (MCP) 构建的禅道项目管理工具集服务，采用按领域分层的模块化架构，支持 AI 助手（如 Antigravity、Claude 等）直接通过标准协议调用禅道 API。

---

## 快速上手

本服务用 `npx` 从 GitHub 拉取并启动，使用前需要本机已安装 **Node.js（≥ 18）** 和 **Git**。安装这两个软件、以及拉取本公开仓库，**都不需要 GitHub 账号，也不用登录**。

### 1. 安装 Node.js

1. 打开 [https://nodejs.org/](https://nodejs.org/)，下载 LTS 安装包（Windows 选 `.msi`）。
2. 一路下一步安装，保持勾选 **Add to PATH**。
3. 安装完成后**重新打开**终端或 MCP 客户端，执行：

```bash
node -v
npx -v
```

能看到版本号即可（Node 需 ≥ 18）。

### 2. 安装 Git

1. 打开 [https://git-scm.com/download/win](https://git-scm.com/download/win)，下载并安装 Git for Windows。
2. 安装选项保持默认即可（会自动加入 PATH）。
3. **不需要**注册或登录 GitHub。本仓库是公开的，`npx git+https://...` 只是匿名拉取，不会要账号密码。若安装后弹出 GitHub 登录窗口，关掉即可。
4. 重新打开终端后执行：

```bash
git --version
```

能看到版本号即可。

### 3. 配置 MCP 客户端

把下面这段复制到 MCP 客户端配置里，只改三处环境变量。无需手动克隆或编译。

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

### 4. 重启客户端

保存配置后重启 MCP 客户端。首次启动时 `npx` 会从 GitHub 拉取仓库并安装依赖，之后走本地缓存。

当前未发布到 npm，所以仓库里会带上编译后的 `dist/`；改完源码后请先 `npm run build`，再把生成的 JS 一起提交。仓库更新后，使用方需重启 MCP，或清一次 npx 缓存后再启动。

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
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/products/{product_id}/plans`（404 时回退 `.../productplans`）

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
- **底层接口**：`POST {ZENTAO_BASE}/api.php/v1/productplans/{plan_id}/linkstories`（404 时回退 `PUT .../stories/{story_id}`）

### 5. 任务领域 (`src/tools/task.ts`)

#### `create_task` (创建任务)
- **说明**：在禅道所属执行/迭代（Execution）下创建新任务（Task）。支持关联研发需求（Story）、所属模块、指派人、预计工时、开始与截止日期、优先级等。创建成功后自动回查并全量返回任务完整详情。
- **参数**：
  - `execution` (number, 必填)：所属执行/迭代 ID（对应 executionID）
  - `name` (string, 必填)：任务名称/标题
  - `type` (string, 可选, 默认 devel)：任务类型（如 `devel` 开发, `test` 测试, `design` 设计, `request` 需求, `study` 调研, `ui` UI设计, `misc` 其他）
  - `assignedTo` (string, 可选)：指派给的用户账号
  - `estimate` (number, 可选)：预计工时（小时）
  - `story` (number, 可选)：关联的相关研发需求 ID
  - `module` (number, 可选)：所属模块 ID
  - `estStarted` (string, 可选)：预计开始日期（YYYY-MM-DD）
  - `deadline` (string, 可选)：截止日期（YYYY-MM-DD）
  - `pri` (number, 可选, 默认 3)：优先级 1~4
  - `desc` (string, 可选)：任务描述或实现要求
- **底层接口**：`POST {ZENTAO_BASE}/api.php/v1/executions/{execution}/tasks`

#### `get_task` (获取任务详情)
- **说明**：根据任务 ID 获取单个任务的完整详情（包含任务名称、类型、所属执行 execution、关联需求 story、指派人、状态、工时、优先级、截止日期、描述等全部信息）。
- **参数**：
  - `task_id` (number, 必填)：任务 ID
- **底层接口**：`GET {ZENTAO_BASE}/api.php/v1/tasks/{task_id}`

#### `update_task` (修改任务)
- **说明**：编辑/修改任务属性。**采用 Fetch-and-Merge 先查后合保护策略**，先读取当前任务数据，未修改的字段（如所属执行、关联需求、模块、指派人等）自动完整保留提交，绝不因部分更新被清空；更新完成后回查并全量返回最新任务详情。
- **参数**：
  - `task_id` (number, 必填)：需要修改的任务 ID
  - `name` (string, 可选)：任务名称/标题
  - `execution` (number, 可选)：所属执行 ID（若不修改请留空，原执行将完整保留）
  - `type` (string, 可选)：任务类型（如 devel, test, design 等）
  - `assignedTo` (string, 可选)：指派给的用户账号
  - `estimate` (number, 可选)：预计工时（小时）
  - `story` (number, 可选)：关联的相关需求 ID（若不修改请留空，原需求将完整保留）
  - `module` (number, 可选)：所属模块 ID
  - `estStarted` (string, 可选)：预计开始日期（YYYY-MM-DD）
  - `deadline` (string, 可选)：截止日期（YYYY-MM-DD）
  - `pri` (number, 可选)：优先级 1~4
  - `desc` (string, 可选)：任务描述或实现要求
- **底层接口**：`PUT {ZENTAO_BASE}/api.php/v1/tasks/{task_id}`

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
│       ├── task.ts      # 任务领域：create_task, get_task, update_task
│       └── index.ts     # 统一汇聚注册导出
└── test/
    ├── helper.js        # 测试辅助公共函数 (MockServer / McpClient)
    ├── unit/            # Mock 单元测试
    │   ├── auth.test.js
    │   ├── product.test.js
    │   ├── plan.test.js
    │   ├── story.test.js
    │   └── task.test.js
    └── integration/     # 依赖外部环境的集成测试
        └── live.test.js
```

