# 万象会客厅

一个由人物包驱动的多人物对话网站。浏览器只负责人物选择与聊天展示；人物提示词、知识库、边界规则和 DeepSeek API Key 均由服务器读取。

## 请求链路

1. 浏览器请求 `GET /api/characters` 获取人物公开信息。
2. 用户选择人物并向 `POST /api/chat` 提交人物 ID、会话 ID 和消息。
3. 服务器读取对应人物包，组合系统提示、边界、知识、示例和近期历史。
4. 服务器使用环境变量中的密钥请求 DeepSeek Chat Completions API。
5. 服务器保存会话并仅向浏览器返回人物回复。

## 本地运行

安装 Node.js 18.17 或更高版本，然后在项目目录执行：

```powershell
Copy-Item .env.example .env
```

编辑 `.env`：

```text
DEEPSEEK_API_KEY=你的新密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
PORT=8000
```

不要使用已经公开发送过的密钥。密钥必须撤销后重新生成，并且 `.env` 不应提交到 Git。

启动：

```powershell
npm start
```

浏览器打开 `http://localhost:8000`。

## 人物包结构

每个角色放在 `characters` 下的独立目录中：

```text
characters/
└── character-id/
    ├── character.json
    ├── system-prompt.md
    ├── knowledge.md
    ├── boundaries.md
    └── examples.json
```

服务器启动时会自动扫描所有人物包。`character.json` 的 `id` 必须使用小写英文字母、数字和普通半角连字符。

建议目录名和文件名也统一使用普通半角连字符，避免 Linux、Docker 和部署平台中的 Unicode 路径兼容问题。

## 接口

- `GET /api/health`：服务和模型配置状态。
- `GET /api/characters`：人物公开信息，不返回内部人物包内容。
- `POST /api/chat`：发送消息并获取 DeepSeek 回复。
- `GET /api/conversations/:id`：读取当前服务器进程中的会话。
- `DELETE /api/conversations/:id`：清空会话。

`POST /api/chat` 示例：

```json
{
  "characterId": "luo-ji",
  "conversationId": null,
  "message": "什么是黑暗森林？"
}
```

## 上线前必须补充

- 将内存会话迁移到 Redis、PostgreSQL 或其他持久化数据库。
- 在 Nginx、Cloudflare 或部署平台增加 HTTPS 和更严格的限流。
- 为不同访问者增加匿名访客 ID 或账户体系，防止会话串用。
- 增加模型调用额度、费用统计、内容安全审核和日志脱敏。
- 如果前后端分开部署，配置明确的 CORS 白名单，不要开放任意来源。
- 将人物目录中的特殊 Unicode 连字符重命名为普通 `-`。

## 部署到 Netlify

项目已包含 `netlify.toml` 和 `netlify/functions`，不应把项目根目录直接作为静态发布目录。构建命令只会把 `index.html` 与 `app.js` 复制到 `dist`，人物 Prompt 和知识文件只打包进服务端函数。

### Git 部署

1. 将项目推送到 GitHub、GitLab 或 Bitbucket，确认 `.env` 没有被提交。
2. 在 Netlify 选择 **Add new project → Import an existing project**，连接仓库。
3. Netlify 会自动读取以下配置：
   - Build command：`npm run build`
   - Publish directory：`dist`
   - Functions directory：`netlify/functions`
4. 打开 **Project configuration → Environment variables**，添加：

```text
DEEPSEEK_API_KEY=新生成的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

5. 环境变量作用域必须包含 **Functions**，然后触发一次新的部署。
6. 部署完成后访问站点，并检查：
   - `/api/characters` 能返回人物列表。
   - 发送消息后能获得真实模型回复。

### 手动部署限制

不要仅将 `index.html` 拖入 Netlify Drop。该方式只部署静态文件，不会正确部署服务端函数和人物包。应使用 Git 导入，或者安装 Netlify CLI 后在项目根目录执行完整部署。

### 无服务器会话说明

Netlify Function 不保证同一用户的请求始终进入同一实例，因此当前前端会在每次请求中附带最近 20 条对话。这适合初期上线。需要账户、多设备同步或更长会话时，再接入 Netlify Blobs、Redis 或外部数据库。
