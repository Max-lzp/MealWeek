# 二次开发贡献边界

复用并保留：Tally Next.js 16 / React 19 / TypeScript / Tailwind 工程、锁文件基础、原业务代码、SQLite schema 与迁移、MIT LICENSE、上游 README 存档。

替换：src/app/page.tsx 为 MealWeek 入口；src/app/layout.tsx 为中文元信息与系统字体，移除全局 service worker 注册和外部 Google 字体。

修改：src/middleware.ts 允许 MealWeek 根页面并默认关闭上游页面/API；next.config.ts 修正 staleTimes.static、使用标准 next start 构建模式并配置本地开发来源；package.json/lockfile 新增测试工具和命令；.gitignore 排除测试产物。

新增：src/components/mealweek/MealWeek.tsx、mealweek.css（四页面与本地交互）；src/lib/mealweek.ts（模型、计算、偏好过滤、演示）；tests/、playwright.config.ts；MealWeek README、THIRD_PARTY_NOTICES、docs 内本轮交付文档与截图。

没有在 MVP 内复用上游认证、食品库、SQLite 日记、AI 解析或 Recharts 图表作为已交付能力；这些源码保留，默认不对外开放。
