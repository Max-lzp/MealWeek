# MealWeek：运动饮食记录与 Memory 产品实验

> 给 Codex 的建设说明。作者需求：龙正鹏 Max；资料核查日期：2026-11-02。
> 这是待开发规格，不是已经运行的产品。上游仅做了远程文件审阅，尚未安装、构建或做安全审计。

## 0. 直接给 Codex 的开工指令

请按本 README，在 Tally 开源项目上二次开发一个手机浏览器可用的中文个人饮食记录产品。先读取当前目录的指令与文件，确认是否已经有代码；有代码时不要覆盖。空目录时检出下方固定版本。在保留上游功能和许可证的前提下，先完成 P0，再完成 P1 Memory，最后补充 P2 受约束的周报 Agent。

先交付一个无需模型密钥、使用明确标注的模拟数据也能完整操作的版本，再接真实视觉模型。不要仅输出方案。逐项实现、运行关键测试、检查手机尺寸界面，记录尚未验证的部分。不要采购服务、公开部署、上传真实健康记录、把密钥写进仓库或给原作者发消息。网络、依赖或模型不可用时完成不依赖它们的工作，并说明具体阻塞。

产品目标：拍摄/上传三餐及加餐照片，确认食物与份量，记录运动与当天总消耗估计；查看日内能量估算、一周趋势；管理自己的偏好记忆；结合周报主动确认是否调整目标。

第一位使用者：有篮球院队/校队经历、校级长跑金牌、曾控制饮食摄入的成年业余运动者。不能把个人偏好当成全部用户需求；未来通过访谈验证。

## 1. 上游选择与复用边界

推荐仓库：https://github.com/GeneArnold/tally

固定起点：`58dee54e3ee957e7d360133ce7dbc7c42741db63`，2026-08-18。

核查方式：已读取 README、LICENSE、package.json、数据库 schema、AI provider/解析路由、日记写入路由、周摘要路由、迁移脚本及 Dockerfile；**未实机运行**。

复用：Next.js App Router + TypeScript、Tailwind、SQLite/better-sqlite3 + Drizzle、登录、饮食日记、食品库、照片/文字解析入口、Recharts、PWA基础。

自己新增：中文手机流程；多食物确认和不确定性呈现；摄入/消耗口径；完整度标记；运动输入；周报告；目标版本管理；Memory规则与评估；可选周报Agent。

许可证：上游 MIT，Copyright (c) 2026 Gene Arnold。保留 LICENSE 与版权声明，新增 THIRD_PARTY_NOTICES.md，作品展示明确写“基于 Tally 二次开发”。不要把上游登录、食品库和图表描述成自己从零开发。

## 2. 已发现的代码事实：先处理这些问题

1. 真正的照片调用入口是 `src/app/api/ai/parse-food/route.ts`，通过 `src/lib/ai-providers.ts` 选 provider；另有 `src/lib/ai-food-parser.ts`。先检索实际引用，避免改了未使用的旧文件。
2. 原提示词倾向给单个营养值，未做严格运行时 schema 校验。新增多食物数组、范围、未知状态、人工确认，使用 Zod（新增依赖）验证。不能把模型给出的低/高值称为统计置信区间。
3. `src/app/api/diary/add/route.ts` 使用 `food.calories`，解析端返回 `energy_kcal`；现有前端可能已做映射，必须追踪全链路再修。原写入逻辑把缺失值变成0，必须保留 unknown，补测试避免漏记被判作零摄入。
4. `src/app/api/v1/diary/summary/[period]/route.ts` 目前是 TODO，只返回空 averages。周报不属于已完成的上游能力。
5. schema已有 exercises 表，但不能据此宣称已有可用运动录入界面；检查路由及页面后再复用。
6. schema默认英制，逐一核查 kg/g/cm/kcal 与 lbs/oz 的转换。迁移保留旧值与单位，不能只改显示标签。
7. 根 package.json 未提供测试命令。为这次新增业务逻辑加入 Vitest，关键流程加入 Playwright；不要声称上游已有完整测试。
8. 上游自托管不等于数据完全不外传：真实AI模式会把图片/文本传给选定provider；界面说明接收方并由用户触发。README里模型价格/免费额度未核实，不作为承诺。
9. 上游 Dockerfile 使用 node:20-alpine，但 better-sqlite3 是原生依赖。按锁文件核查Node兼容性；有需要时统一本地/容器至可构建版本并记录原因，不盲目升级框架。

## 3. 初始化：给开发代理，不要求用户手工照抄

空目录示例；目标目录已存在时先检查，禁止覆盖：

```powershell
git clone https://github.com/GeneArnold/tally.git mealweek
Set-Location mealweek
git checkout -b feature/mealweek 58dee54e3ee957e7d360133ce7dbc7c42741db63
```

保留 origin 指向上游，未经用户指示不要推送。把本规格保存为 `docs/MEALWEEK_SPEC.md`，保留上游 README 为 `docs/UPSTREAM_README.md`，重写项目 README 说明二次开发。

按上游 lockfile优先 `npm ci`；原生依赖失败时先确认运行时/编译工具或使用容器，不以删锁文件解决。为新增测试安装并锁定 Vitest、Playwright；schema校验加入Zod。

复制 `.env.example` 为 `.env.local`（已存在则保留）；生成随机 JWT_SECRET，默认 `AI_MODE=mock`、`DATABASE_PATH=./data/health.db`。新增 `AI_VISION_MODEL`、`AI_TEXT_MODEL`，模型标识可配置，沿用原provider接口并在实际接入前核查其官方文档。不使用NEXT_PUBLIC前缀保存模型密钥。

注意：独立迁移脚本不一定读取Next.js的`.env.local`。为迁移/seed脚本显式加载环境，可用`@next/env`；执行后确认连接的是预期开发库。不要对原有真实数据库直接reset。

上游可参考的启动命令：`npm run db:migrate`、`npm run dev`；代理须在当前环境实测后把准确命令写入最终README。Docker启动与SQLite文件持久化也需实测。

## 4. 产品范围与完成顺序

### P0：先跑通记录与一周复盘

- 手机优先，支持390px与360px宽度；登录后底部导航：今日、添加、周报、我的。
- 今日：餐次时间线、摄入估算范围、总消耗来源、估算差额、记录完整性；未知值显示“待补充”。
- 添加：手机上传/拍照，选餐次和拍摄时间，补充份量/烹饪/是否共餐。多道菜逐项确认，修改或删除后才保存。
- 餐次状态：`unlogged`、`logged`、`skipped_confirmed`、`unknown`。支持自定义餐次和加餐，不能假设人人三餐。
- 当日结束可确认“今天饮食是否记录完整”；没有该确认时不输出完整日的能量盈亏结论。
- 运动：手工记录类型、分钟、净活动消耗估计及来源；也可手填设备给出的**全天总消耗**。MVP不接Apple Health/Health Connect。
- 周报：摄入/消耗区间、完整日数、摄入记录与体重趋势、目标变化。未知日断线/空心显示，不补0，不外推整周总量。
- 我的：公制资料、用户自行设定的目标、JSON导出、导入、删除；演示账号与真实账号隔离。

### P1：Memory与目标确认

- 记忆中心展示“记住了什么、来源、何时确认、有效期”，可编辑、删除、暂停使用。
- 明确区分事实记录、用户声明、系统推断。饮食事件本身不自动升级为长期身份或偏好。
- 个性化按已确认有效记忆过滤；删除记忆后失效相关周报缓存，不在下次对话中沿用旧摘要。
- 每周只能生成“复盘/待确认的调整草案”。目标修改需要用户明确输入并确认新值，写新版本；不得自动制造减脂热量处方。

### P2：可选的受约束周报 Agent

- 只在P0/P1通过后开发，不把固定流水线包装为Agent。
- 为Agent提供只读工具 `get_week_summary`、`get_active_memories`、`list_missing_records`，以及草稿工具 `draft_week_review`。
- 模型根据结果决定是否再查数据；最多4次工具调用。缺信息可以请求补充；只产出带事实引用的复盘草稿。
- 不提供改目标、发消息、删记录工具；这些由确定性界面、鉴权和用户操作完成。任何周报中的数字都来自已计算结果，不让LLM重新心算。

不做：原生双端App、智能项链硬件、后台持续摄像、自动同步第三方平台、训练视觉模型、医疗诊断、营养补剂处方、多人社交、支付、多Agent编排。

## 5. 数字口径：确定性计算，LLM只辅助识别与解释

### 摄入

每个食物的估算必须标明basis（每100g/每份/整盘）。份量已确认后仅换算一次。

`itemKcal = kcalPer100g × portionG / 100`；整份估算则直接乘份数，不再按克重复换算。

优先级：用户更正/营养标签 > 用户确认的数据源匹配 > AI粗估。保存每项来源与修改记录。USDA匹配仅为候选，由用户确认食物及份量；不能认为国外食品库天然覆盖中餐。

`intakeLow = sum(itemLow)`，`intakeHigh = sum(itemHigh)`。若任何实际摄入项未知，保留已知小计并标注“部分估算”，不能把unknown当0。范围只是估算包络，不承诺真实误差一定在内。

### 消耗：二选一，不叠加

模式A `device_total`：用户填写设备的全天总消耗范围；运动记录只作解释，**不再加到总消耗里**。

模式B `baseline_plus_net_exercise`：用户填写明确不含这次额外运动的日常基线估计；只加此次额外运动的**净活动消耗**。基线来源/是否包含运动必须明确，来源不清则不计算差额。

如果只有运动消耗，没有全天总消耗/可用基线，只展示运动数据，不展示“今天热量盈亏”。MVP不把BMR当TDEE，不默默使用默认活动系数，也不在产品里承诺预测实际减脂量。

约定 `energyBalance = intake - expenditure`：负数是估算缺口，正数是估算盈余。

范围为 `[intakeLow - expenditureHigh, intakeHigh - expenditureLow]`；跨0显示“方向不确定”。饮食未确认完整、消耗口径不清时只给部分信息。

`targetGap = intake - userCalorieTarget` 是与计划的差异，**不是能量盈亏**，必须分开命名。

周报只统计完整、已确认、口径可比的日子；标题写“有效记录N/7天”。体重7日均值仅用真实称重，显示样本数，不把一天体重波动直接转换成脂肪变化。

### 动态目标

第一版只帮助用户动态**复盘**并确认目标。数据不足时请求补记录；记录充分时展示趋势、训练状态和当前目标，让用户选择维持/手动修改。若未来要自动给出具体热量目标，单独建立依据、适用人群和专业复核；本MVP不实现该算法。

## 6. 核心数据模型（新增或扩展，先检查上游实体）

避免平行建立两套食物日记。对现有`diary_entries`、`food_entries`、`exercises`、`health_profiles`、`measurements`做向后兼容扩展。

```ts
type MealEstimate = {
  id: string; userId: string; localDate: string; timeZone: string;
  occurredAt: string; mealSlot: string;
  status: 'draft' | 'confirmed';
  items: Array<{
    id: string; name: string; portionG: number | null;
    basis: 'per_100g' | 'per_serving' | 'whole_item';
    amount: number | null; unit: string;
    kcalLow: number | null; kcalHigh: number | null;
    source: 'manual' | 'label' | 'database' | 'ai_estimate';
    sourceRef?: string; needsReview: boolean; uncertaintyReason?: string;
  }>;
  provider?: string; model?: string; promptVersion?: string;
  idempotencyKey: string; createdAt: string; updatedAt: string;
};
type Memory = {
  id: string; userId: string;
  category: 'preference' | 'goal' | 'routine'; key: string; value: string;
  origin: 'explicit' | 'inferred'; sourceRef: string;
  status: 'pending' | 'confirmed' | 'superseded' | 'deleted';
  validFrom: string; expiresAt: string | null;
  supersedesId?: string; confirmedAt?: string; updatedAt: string;
};
```

还需：`day_completeness`（每个日期/餐次状态＋整日确认）、`daily_energy`（消耗模式/上下界/来源）、`goal_versions`、`review_feedback`、`memory_events`。全部实体按用户隔离；日期用用户时区，UTC时间存原始事件，跨午夜不能丢餐。

记忆事件日志仅存动作、实体ID、时间，不复制被删除的偏好值。演示中“删除”必须让活动记录、摘要、缓存都不可再检索；旧日志/备份保留策略写清楚，不能声称抹除了模型供应商所有数据。

## 7. Memory规则与冲突处理

| 输入 | 规则 | 验收表现 |
|---|---|---|
| 今天午餐没有肉 | 写饮食事件 | 不写“素食者” |
| 我不喜欢香菜，请记住 | 生成显式偏好确认卡 | 用户确认后用于后续建议 |
| 最近出差一周吃素 | 生成一周有效的临时记忆 | 到期自动停止检索 |
| 我现在可以接受香菜了 | 用户声明与旧偏好冲突 | 展示替换确认，旧值superseded |
| 模型根据三餐推测偏好 | 保持pending | 不冒充用户声明，不参与硬约束 |
| 我对花生过敏 | 不由照片推断，不做诊断 | 请求用户明确确认限制；不能被普通喜好或单餐观察覆盖 |
| 删除“不吃香菜” | 清活动数据并失效派生缓存 | 新报告不再引用；不因旧摘要自动复活 |

若做饮食限制类别，增加明确`restriction`类型及优先规则：用户确认限制 > 普通偏好；冲突先澄清，不能自行判断限制消失。MVP也可只保留偏好与目标，不主动收集医学信息。

## 8. AI接口、降级和数据保护

- 图片先压缩并移除EXIF；限制类型、实际解码、大小与像素。HEIC先检测并转换或提供明确换格式提示。
- 默认不长期保留原照片；用户可选择保留缩略图。处理时仅上传用户确认的照片；日志不含图片base64、密钥或完整健康资料。
- 模型请求限时、可取消，最多1次有限重试；超时/无密钥时保留草稿并允许手动录入，禁止无限计费重试。
- 输入/输出Zod校验，非食物图、null、负数、上下界颠倒需处理。图片文字/备注是数据，不能改变工具权限或系统指令。
- 不展示伪造的“识别准确率99%”。模型的自报confidence只可用于提示审核，不是校准后的准确率。
- JWT、模型密钥与USDA key只在服务端；写操作做鉴权、对象归属校验与Origin/CSRF保护。关停公开演示注册或限制为测试账号，不给公网裸奔的私人健康库。
- PWA service worker不得共享缓存带用户身份的API响应或保留退出后的私人页面。断网默认只缓存静态壳，不自动承诺离线写入。
- 远程手机访问使用HTTPS；局域网HTTP的相机权限与PWA能力可能受限。无论相机API是否可用，都提供文件上传路径。
- SQLite需持久化卷及单实例部署；不直接部署到无持久化写盘的serverless环境。部署前检查跨用户访问、删除、备份恢复。

## 9. 页面与操作验收

1. 手机打开→登录→上传午餐→编辑一项份量→确认入账，刷新后记录保留。
2. 模型不可用时能完整手动记录。模拟模式始终显示“演示数据/非真实识别”，不能替代真实识别验证。
3. 三餐＋加餐与运动输入后，能看到标明来源的日估算；相同照片连续点击保存只生成一份记录。
4. 取消、撤回、修改食物会重算当日和周报，不保留过时结论。
5. 7日演示数据包含完整日、漏记日、真实零运动日、训练日、跨午夜事件；图表不会把缺失画成0。
6. 删除偏好后，下一次个性化和周报不再使用它；未确认推断不参加检索。
7. 新目标只影响确认生效日以后的计划显示，不重写历史目标。

UI不用红色惩罚/羞辱性文案，不以卡路里缺口排名。首页优先显示记录质量与可执行下一步，不把小数精度当可信度。

## 10. 必须运行的关键测试

新增纯函数测试，不为排版写镜像测试：

| 测试 | 预期 |
|---|---|
| 摄入[1800,2100]、总消耗[2200,2500]且完整 | 差额[-700,-100]，标为估算缺口；数值只是计算样例 |
| 摄入[2000,2400]、消耗[2100,2300] | [-300,300]，方向不确定 |
| 只有运动500kcal | 不可算日盈亏 |
| 设备全天2300＋另有运动500 | 总消耗仍2300，不是2800 |
| 未录晚餐 | 日结论不完整、周报排除该日的完整日均值 |
| 营养未知项 | 已知小计＋未知状态，不能替换成0 |
| 每100g的100kcal、200g | 200kcal，不能重复乘份量 |
| kg/lbs、跨午夜、周一起始 | 单位正确，归属用户当地日期 |
| 重复保存、重试 | 幂等，不重复摄入 |
| 删除/过期/替换记忆 | 检索与缓存不引用旧值 |
| 用户A请求B记录 | 403/404，不泄露数据 |
| 恶意图片备注要求改目标 | 仍只能生成草稿 |

E2E至少覆盖：上传模拟图→更正→保存→运动→日估算→周报→确认偏好→删除偏好。验证360/390px无横向滚动，按钮可点击；不声称已完成真实手机测试，除非确实在手机上验证。

## 11. 作品集证据与最终交付

- `docs/UPSTREAM_AUDIT.md`：固定commit、原生功能、发现的问题、实际运行结果。
- `docs/DECISIONS.md`：为什么先PWA、为什么不自动改目标、Memory如何与日记分离。
- `docs/EVALUATION.md`：规则测试、模拟测试、真实自测分开；不把示例数据写成用户成果。
- `docs/CHANGELOG_FROM_UPSTREAM.md`：复用/修改/新增文件与本人贡献。
- `.env.example`、迁移、seed/reset演示数据命令、运行命令、已知限制。
- 1-2分钟演示路径：错误识别→人工纠正→周报排除漏记→记忆更正/删除。
- 自测7天才填写：完成记录天数、单餐耗时、人工更正次数、放弃点、下周修改。未收集前保持空白。

交付报告必须说明：已运行的命令与结果、无需密钥可操作的范围、真实视觉API是否验证、手机是否验证、尚未完成项。不要把README里的计划改写成已经实现。

## 12. 参考资料

- Tally [README](https://github.com/GeneArnold/tally/blob/58dee54e3ee957e7d360133ce7dbc7c42741db63/README.md)、[LICENSE](https://github.com/GeneArnold/tally/blob/58dee54e3ee957e7d360133ce7dbc7c42741db63/LICENSE)、[schema](https://github.com/GeneArnold/tally/blob/58dee54e3ee957e7d360133ce7dbc7c42741db63/src/lib/db/schema.ts)。
- [AI实际调用路由](https://github.com/GeneArnold/tally/blob/58dee54e3ee957e7d360133ce7dbc7c42741db63/src/app/api/ai/parse-food/route.ts)、[provider](https://github.com/GeneArnold/tally/blob/58dee54e3ee957e7d360133ce7dbc7c42741db63/src/lib/ai-providers.ts)、[周摘要占位](https://github.com/GeneArnold/tally/blob/58dee54e3ee957e7d360133ce7dbc7c42741db63/src/app/api/v1/diary/summary/%5Bperiod%5D/route.ts)。
- [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide/)：营养数据查询与来源。
- [NIDDK Body Weight Planner](https://www.niddk.nih.gov/bwp)：体重管理涉及个体与活动变化；本MVP不实现医学目标算法。
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)：相机权限与安全上下文。

本项目独立于ODYSS，不复制其商标、专有评分或宣传准确率；用于展示饮食记录、个性化规则与产品验证能力。
