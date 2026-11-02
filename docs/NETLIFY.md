# Netlify 部署

仓库：Max-lzp/MealWeek；生产分支：main。netlify.toml 已配置 Node.js 24、npm run build、.next 发布目录与默认关闭上游路由。由 Netlify 自动检测 Next.js 并使用官方集成，无需手动建立静态导出或改成 out/。

## 账户前提

需要有权操作的 Netlify 账户 / 团队。可以在 Netlify 网页导入 GitHub 的 Max-lzp/MealWeek，选择 main，按 netlify.toml 构建。

自动 CLI 发布需要安全配置 NETLIFY_AUTH_TOKEN（Netlify Personal Access Token）；不要把它写入仓库或聊天。可通过云环境设置安全填入。Netlify API 目标为 api.netlify.com。若存在多个可选团队，需先明确目标团队，不能擅自选择付费套餐或升级。

## 发布前后核验

- 本地 npm ci、npm test、npm run build 应通过。
- 执行发布后记录实际站点 ID、HTTPS 域名、部署 ID，只有拿到响应并验证才能称部署成功。
- HTTPS 域名下核验上传照片、手动保存、刷新保留、周报、360/390px；验证 /api/auth/signup 和 /api/debug/diary 返回 404。
- 不在公开验证中输入真实健康资料，只用演示 / 合成记录。
- 新域名的 localStorage 与本地地址隔离，不会自动迁移或跨设备同步。
- NETLIFY_AUTH_TOKEN 是部署工具凭据，不应配置为 NEXT_PUBLIC 变量，也不需要交给网页。

本项目没有云端用户健康数据库、真实 AI 识别或账户登录。没有采购服务、绑定付费域名或升级套餐的授权。

## 文字 / 语音迭代

本轮仍无模型或语音服务 API Key 要求。语音依赖浏览器 Web Speech API，Netlify HTTPS 可满足安全上下文条件，但不保证每种手机浏览器支持或系统语音网络可达。AI 页面明确未接入，文字估算为内置参考表规则。
