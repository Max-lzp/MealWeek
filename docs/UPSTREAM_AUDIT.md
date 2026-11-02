# 上游检查与复用记录

- Tally 固定 commit：58dee54e3ee957e7d360133ce7dbc7c42741db63。
- 开始时 `/workspace/MealWeek` 只有未出生分支的 `.git`，无源文件或用户修改；保留其 Git 配置，未覆盖用户文件。
- 在独立 `/workspace/tally-upstream` 克隆并检出指定版本。`npm ci` 成功（Node 24.19.0 / npm 11.9.0，481 packages）。
- `npm run db:migrate` 成功，数据库在上游本地 data/health.db；没有现有真实数据被 reset。
- `npm run dev -- --hostname 127.0.0.1 --port 3001` 成功启动；`GET /login` 返回 200。
- 警告：Google Fonts 请求不可用但开发模式回退成功；staleTimes.static 为 0 不满足 Next 16 要求；middleware 命名已弃用。
- 未把登录页可访问描述成已完成账户、照片、食品库或周报全链路验证。

将指定版本代码（不含 .git、依赖、构建产物和数据）复制至 MealWeek 原有空工作目录。保留 MIT / 原作者署名，保留原 README 与原有功能代码。本轮采用同一 Next App Router / React / TypeScript / 构建工具底座，新增根页面。

本轮 MVP 不接上游 SQLite 日记或登录；其数据不与上游食品库混写。原生路由默认关闭（MEALWEEK_ENABLE_UPSTREAM 未设为 true 时返回 404），避免原生注册和 API 成为本轮本地 MVP 的额外攻击面。开启原生路由必须作为后续独立集成与安全验证任务。

没有采用“上游十分钟无法启动”的独立技术栈 fallback；上游实际能启动。复用范围限于框架与工程底座，不宣称原生业务已改造成中文完整产品。
