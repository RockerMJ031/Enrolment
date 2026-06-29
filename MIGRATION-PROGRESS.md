# Course Enrolment — 迁移进度 & 续接文档

> 目标:把这个新报名设计(本仓库 `RockerMJ031/Enrolment`,live `rockermj031.github.io/Enrolment/`)迁进 **Wix 生产** 的 course-enrolment。
> 本文是给下次会话的续接锚点。最后更新:2026-06(P1 后端接线完成,嵌入架构待最终拍板)。

## 0. 仓库 & 角色
- **前端 app** = 本仓库(Enrolment),单文件 `index.html`(~3400 行,vanilla,自带 CSS/JS)+ `lib/` + `mock/`。
- **后端 + Velo** = `/Users/mjquan/purple-ruler`(本 agent 现在是唯一 dev,可改;另一 agent 已停)。
- **分析 worktree** = `/Users/mjquan/Antigravity/02.Purple Ruler.com/analyze-refactor`(.env 带 WIX_API_KEY;siteId `a85ae591-0f7a-44c0-8fe4-3aa7aca4899e`)。

## 1. ✅ 已完成(P1,已 push 到 Enrolment main,最新 `8ea0c45`)
前端从 mock 改成**接生产后端协议 + CMS 驱动**:
- `lib/bridge.js`(postMessage 桥 + `?mock`/无 parent 自动 mock)、`lib/api.js`、`lib/stripe.js`(Payment Element)——**从 `purple-ruler/src/public/course-enrolment-v01/lib/` 复制**。
- `mock/products.json` + `mock/addons.json` = **线上 CMS 快照**(真实 configV2 shape),供 `?mock` 离线跑。
- `index.html`:`<script>` → `type="module"`;boot 拉 `getMemberContext + listProducts + listAddons`;产品/价格/addons/营销文案**全从 CMS**(adapter `__adaptProduct`:configV2 → 内部 shape;旧写死占位价已弃)。
- 提交:state → `submitEnrolment` payload(`productId` / `paymentPath` pay_stripe·po_invoice / students 带**派生 weeks** + 真实 addonIds / groups)→ Submitted 显真 requestId;Stripe 经 clientSecret;PO 路径。
- 定价:client 预览内联了 **5% card 预付折扣** → 与后端 `calcQuoteV2` 对齐 ⇒ **显示==实扣**(实测 2×Academy Core:card £2,852.28 / PO £3,002.40)。
- 验证(mock,Playwright,脚本在 scratchpad,未入仓):CMS 渲染 6/6、提交 e2e 5/5、定价 7/7,无 JS 报错。
- 早先已完成并 push:C1–C7(Remove all / Weeks→End Date / 删 Hours(Academy)/ Compass 时间范围 / SEND 多选 / EHCP 上传占位 / Student brief / 财务字段)+ 步骤换序 + A/C「默认先行」。

## 2. 后端(purple-ruler,复用,未改)
- `src/backend/courseEnrolment.web.js`:`listProducts / listAddons / getMemberContext / submitEnrolment(内建 Stripe PaymentIntent + notifyLark)/ getRequestStatus / getStripePublishableKey`。
- `src/backend/lib/courseEnrolment/pricingV2.js` = `calcQuoteV2`,注释"matches reference prototype"——**前后端定价天生对齐**;5% stripe 折扣在这里(`STRIPE_PREPAYMENT_DISCOUNT=0.05`)。
- 现有 `src/pages/Course Enrolment.p913v.js` = **iframe + postMessage bridge wrapper**(`#enrolmentIframe`,handlers `api:*` + `auth:member`)。**这页据 owner 说没真用过,可直接改。**
- 旧前端在 `src/public/course-enrolment-v01/`(被本新前端取代)。

## 3. CMS 真实目录(后端按它扣钱;owner 拍板:**CMS 为准**)
| 产品 | 价 | 模式 |
|---|---|---|
| academy | Core £139/周 + Full £169/周 | student |
| compass | £37.50/时 | student |
| blueprint | £29.17/时,+£200 setup,+20% 自定义时间 | group |
| distinction | £37.50/时,+20% 自定义,<200h 加 30%(上限 £7500) | group |
- 13 个 addons(真实 id/单位):academy exam_centre £650/series·parent_liaison £150/月·monthly_progress £60/月;compass ehcp £650/份·send_badge £5/时·attendance £100/月·parent_comm £100/月;blueprint regrouping £50/月·reintegration £100/月·mock_analysis £220/mock;distinction exam_centre £650·enhanced_marking £140/paper·diagnostic £98/月。
- `configV2.marketing` 很全:`cat / subtitle / badge / baseService / bestFor[] / included[] / notSuitable[] / additionalCharges[] / priceDisplay / rateLabel / priceUnit`。

## 4. 🔴 待最终拍板:嵌入架构(下次第一件事)
"全 CE 方向"是 owner 的总方向(见 memory),但这页是带 Stripe 的复杂支付 app + 生产已有 iframe 设施。三选一:
1. **纯 iframe(本 agent 强烈推荐)**:零串扰、Stripe 友好、复用全部后端、已验证;P1 已是 iframe。代价=高度握手(本项目有先例)+ 它叫"HTML 嵌入"非"CE"。
2. **CE(light 或 shadow)**:与方向一致。light DOM 有 **CSS/全局事件/id 与 Wix 站串扰** + Wix 对 light DOM 支持/自动长高未验证;shadow 要把满地 `document.*` 重写 + Stripe-in-shadow 有坑。
3. **混合(owner 最新倾向)**:**向导做 CE,到 Stripe 时 CE 发事件→Velo `wixWindow.openLightbox('Payment',{clientSecret})`→lightbox 里 iframe 挂 Stripe**。✅ 绕过 Stripe-in-shadow;⚠️ 但向导-CE 的 shadow-重写/light-串扰代价仍在,且多一层 clientSecret 传递。最复杂,仅当"向导必须 CE"才值。

**关键洞察**:无论哪条,Stripe 在 iframe 里没问题、在 shadow 里有坑;CE 的真痛点是向导主体(document.* + 隔离),不是 Stripe。

## 5. 下一步(按架构决策分支)
- **若 iframe**:把现有 `Course Enrolment.p913v.js` 的 `iframe.src` 用代码指向 `rockermj031.github.io/Enrolment/`(Sessions 先例:Velo 设 iframe.src)+ 加 `ui:height` 握手(前端 ResizeObserver postMessage 高度 → Velo `iframe.height=clamp`)+ 受控 publish + Stripe test mode 验。入口可用 button→该页 或 button→lightbox(iframe)。
- **若 CE / 混合**:把 index.html 重打包成 CE(建议 light DOM 保住 document.*)+ `bridge.js` 传输层改 CustomEvent(出)/attribute(进)+ 新 Velo wrapper(setAttribute/事件);混合再加 Stripe lightbox。api.js 抽象保留 → app 逻辑基本不动。
- **P2(两条都要,尚未做)**:EHCP 文件上传后端(CE/iframe 都存不了文件 → Wix Media / http-function)+ PO 财务字段(name/email/phone/dept)→ 存 CMS + http 打 Lark webhook(Lark 自动化发邮件)+ 财务点确认回写状态、enrolment 在确认前 pending。
- **owner 的 Editor 活**(我无法 GUI):按选定方案建页/lightbox/Custom Element 元件 + 给我 element ID/tag/lightbox 名 + Publish 时可能点 Continue。

## 6. 部署注意
- `wix publish` = **整站重发**;走受控清单(uiVersion 同步、DEBUG off、发布后回归现有关键页)。
- purple-ruler `main` 当前有别的未提交改动(`Teacher Allocation.cszo8.js`、`wix.config.json`、`Clever-Launch...`)——publish/commit 前先理清,别误带。
- uiVersion 本地 6228;publish 前确认与云端同步(`wix dev` 点 Continue),否则回滚线上 UI。
