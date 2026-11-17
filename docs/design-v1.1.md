# HanTools 设计文档 v1.1（差异与决策记录）

> 本文是 `HanTools_项目设计文档_v1.0.docx` 的修订说明，不重复 v1.0 已明确的产品定位与页面设计。
> 阅读顺序建议：先看「一、结论」，再看「二、决策记录」与「五、风险」。

---

## 一、可行性结论

| 维度 | 结论 | 依据 |
|---|---|---|
| 技术可行性 | ✅ | 14 个工具全部纯前端实现，无后端依赖；单测 60 条全绿；构建产物首屏 JS 16.69 KB（gzip） |
| 部署可行性 | ✅ | `tools.hanbaobo.cn` 的 NS 在 Cloudflare；Workers Static Assets 静态请求免费不限量；`wrangler deploy --dry-run` 通过（66 个资产） |
| 离线可行性 | ✅ | PWA 运行时缓存 + 构建期产出单文件 `hantools-offline.html`（118.5 KiB，双击可用） |
| 主要风险 | ⚠️ | ①中国大陆访问质量 ②正则灾难性回溯 ③大数分解性能上限 ④.cn 实名/备案要求 |

---

## 二、决策记录（ADR）

### ADR-01 托管平台：Workers Static Assets（替代 Pages）

- **背景**：Cloudflare Pages 文档首页（2026-08-25 更新）明确提示"新项目请使用 Workers"。
- **决策**：使用 Workers Static Assets，`not_found_handling = "single-page-application"`。
- **理由**：静态请求免费且不限量；无需 Worker 脚本即可满足 SPA 回退；未来加 `/api` 零迁移；Pages 免费版 500 builds/月对 CI 频繁推送是隐性约束。
- **代价**：需要 `wrangler` 与 `wrangler.jsonc`；preview 部署习惯需从 Pages 控制台切到 Workers。

### ADR-02 前端形态：Vite + TypeScript，不引入框架

- **决策**：原生 DOM + 轻量 `h()` 构建器 + 通用 `ToolPanel`。
- **理由**：工具页结构高度同构（输入 → 动作 → 输出），框架收益低；首屏可控制在 ~17 KB gzip；避免框架升级/生命周期心智负担。
- **代价**：复杂交互（如多步流水线）需要自建状态管理；后续如需引入 Preact（~4 KB gzip）可平滑替换渲染层。

### ADR-03 路由：`/tools/:slug` + 短别名，拒绝根级 slug

- **背景**：v1.0 设计为 `/:toolSlug`，与 `/about`、`/privacy`、`/tools`、`/category/:slug` 直接冲突。
- **决策**：规范路径 `/tools/<slug>`；高频工具提供 `/b64`、`/md5`、`/mojibake` 等别名（301 → 规范路径，`replaceState`）。
- **配套**：`RESERVED_PATHS` 白名单在构建期校验，slug/别名冲突直接报错（见 `src/app/registry.ts`）。
- **理由**：URL 是公开契约，必须在第一版定型。

### ADR-04 i18n 与元数据：单一 JSON 数据源

- **决策**：`src/data/tools.json` 同时被 Vite（运行期）与 Node 构建脚本（预渲染/sitemap）读取；名称/描述采用 `{ "zh-CN": "...", "en": "..." }` 结构。
- **理由**：避免"预留 i18n"停留在口号；构建脚本无需转译 TS。
- **代价**：JSON 手写较冗长，后续可用脚本从 TS 生成。

### ADR-05 离线策略：PWA + 单文件双轨

- **决策**：
  1) Service Worker 运行时缓存（同源 GET；`/assets/` cache-first；导航 network-first → 回退 `index.html`）；
  2) `npm run build:offline` 用 `inlineDynamicImports` 打成单 chunk 并内联为单个 HTML。
- **理由**：CTF 赛场常为内网/断网；单文件版可 U 盘拷贝、双击即用。
- **限制**：PWA 只缓存"访问过"的页面；单文件版是快照，不会自动更新。

### ADR-06 安全基线：CSP 即隐私承诺

- **决策**：`public/_headers` 下发 `default-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`；不引入第三方字体/统计。
- **理由**：把"不上传输入"从文案承诺变成浏览器强制约束，可在 DevTools Network 面板自证。

### ADR-07 预渲染：构建期为每个工具生成静态壳

- **决策**：`scripts/prerender.mjs` 读取 `tools.json`，为 14 个工具与 4 个分类生成带独立 title/description/canonical/OG 的 `index.html`，并输出 `sitemap.xml`。
- **理由**：纯 CSR 时分享卡片与搜索引擎抓不到工具级元信息；预渲染零运行时成本。

### ADR-08 测试与门禁

- **决策**：Vitest（纯函数，60 条用例）；CI 顺序 typecheck → test → build → build:offline → `scripts/check-size.mjs`（首屏 JS ≤120 KiB gzip、CSS ≤25 KiB、离线文件 ≤250 KiB）。
- **理由**：体积是这类工具站最容易失控的指标（prettier 解包 ~10 MB 即为例证）。

---

## 三、CTF 工具矩阵（v1.1 实装范围）

| 方向 | 已实装 | 下一步（0.3） |
|---|---|---|
| 编码 / Misc | Base64/32/16、Hex、Hexdump、URL/HTML/Unicode、乱码修复、**编码链识别**、**文件魔数 + strings**、**零宽字符** | 二维码、ZIP 伪加密检测 |
| 密码学 | MD5/SHA/SHA3/Keccak/RIPEMD/CRC32 + 字典爆破、XOR 爆破 + crib、古典密码、RSA（小指数/试除/p-q）、JWT 验签、**AES/DES/3DES/RC4** | 共模攻击、Pollard rho |
| Web | URL 转义、JWT、正则测试 | Cookie 解析、HTTP 状态码 |
| 取证 | — | LSB 位平面、EXIF、ZIP 伪加密 |
| 明确不做 | 端口扫描、目录爆破、漏洞利用、自动拿 flag | 同左（长期） |

---

## 四、性能与体积实测

| 指标 | 实测 | 预算 |
|---|---|---|
| 入口 JS | 43.9 KB 原始 / **16.7 KB gzip** | ≤120 KiB gzip |
| CSS | 11.7 KB / 3.2 KB gzip | ≤25 KiB gzip |
| 单工具 chunk | 1.2–5.9 KB gzip（hash 最大） | ≤200 KB |
| 离线单文件 | 118.5 KiB | ≤250 KiB |

> 结论：即使在大陆弱网下，首屏也可在 1–2 秒内交互；离线包适合拷贝分发。

---

## 五、风险登记

| 风险 | 等级 | 应对 |
|---|---|---|
| 中国大陆访问延迟/抖动（Cloudflare 无大陆节点） | 中 | 强缓存 + 预渲染 + PWA 离线；若流量增长，再评估"国内 OSS/CDN 镜像"（需 ICP 备案） |
| `.cn` 域名实名/备案 | 中 | 确认注册商实名状态；境外托管无需备案，境内托管必须备案；上线前核对 DNS 无悬空记录 |
| 正则灾难性回溯导致页面卡死 | 中 | 已限制正则 500 字符、文本 200k 字符、匹配 500 条；0.3 迁移到 Web Worker + 超时 |
| RSA 大数分解耗时 | 低 | 试除上限 100 万，界面明确提示改用 yafu/RsaCtfTool |
| 哈希爆破字典过小 | 低 | 内置约 130 条常见弱口令 + 支持粘贴自定义字典；不联网查询（隐私优先） |
| 依赖许可变化 | 低 | `NOTICE.md` 登记；只接受 MIT/BSD/Apache/MPL 兼容许可 |
| 站点单点故障 | 中 | `*.workers.dev` 备用域 + PWA + 离线单文件三层兜底 |

---

## 六、里程碑（对照 v1.0）

| 版本 | v1.0 计划 | v1.1 实际 |
|---|---|---|
| 0.1 | Vite 骨架、路由、注册机制 | ✅ 完成（含 Workers 部署打样配置） |
| 0.2 | JSON / Base64 / JWT 三个 P0 | ✅ 超额：14 个工具 + 搜索/分类/收藏/最近 + PWA + 离线单文件 + 预渲染 |
| 0.3 | 搜索、分类、推荐、独立链接 | ✅ 已并入 0.2；0.3 改为 Worker 化与对称加密 |
| 0.4 | 移动适配、隐私页、测试、部署 | ✅ 已并入 0.2（隐私页 + 60 条单测 + 部署配置） |
| 1.0 | 公开上线 | 待：绑定自定义域、CI 接入、README/许可证（已完成） |

---

## 七、待决事项

1. 是否把正则 / 大字典爆破迁移到 Web Worker（0.3 建议做）。
2. 是否引入 `@noble/ciphers` 以支持 AES-GCM/CTR（约 3 KB gzip，MIT）。
3. `hantools-offline.html` 是否需要版本号与构建时间水印（便于用户判断快照新旧）。
4. 是否需要 `/api` 做"反馈 / 工具建议"（会打破纯静态模型，需重新评估隐私说明）。

---

## 八、上线记录（2026-11-08）

| 项目 | 实际值 |
|---|---|
| Worker 名 | `hantools` |
| 生产入口 | <https://tools.hanbaobo.cn>（Custom Domain，Proxied CNAME 由控制台自动创建） |
| 备用入口 | <https://hantools.hanbaobo.workers.dev>（`workers_dev: true` 显式保留） |
| 账户级 workers.dev 子域 | `hanbaobo` |
| 部署资产 | 83 个文件（含 14 个工具页 + 4 个分类页的预渲染壳） |
| 入口 JS / CSS | 16.23 KiB gzip / 3.10 KiB gzip |
| 离线单文件 | 118.46 KiB |

**线上验收（2026-11-08）**

- 两个域名对 `/`、`/tools/base64`、`/b64`、`/no-such-page` 均返回 200；
- 工具页返回预渲染壳（title = 工具名），canonical = `https://tools.hanbaobo.cn/tools/base64`；
- 响应头含 CSP / `x-content-type-options` / `referrer-policy` / `permissions-policy`；
- `/assets/*` 返回 `cache-control: public, max-age=31536000, immutable`；
- `index.html` 返回 `public, max-age=0, must-revalidate`；
- `/hantools-offline`（无扩展名，`.html` 会被 307 到它）返回 `Content-Disposition: attachment`，下载内容与构建产物 SHA-256 一致。

**踩坑记录（供后续项目复用）**

1. **`routes` 会隐式关闭 `workers_dev`**：Cloudflare 的推断规则要求在配置里显式写 `workers_dev: true`，否则下次部署会关掉 `*.workers.dev` 备用域。
2. **自定义域输入框容易多带后缀**：本次曾误输入 `tools.hanbaobo.cn.hanbaobo.cn`（控制台校验通过，因为仍是本 Zone 的子域），需在列表中手动删除。
3. **NXDOMAIN 负缓存 30 分钟**：绑定后本机可能仍解析失败，需 `ipconfig /flushdns` 或用 `1.1.1.1` 直接验证。
4. **PowerShell 5.1 的 `Invoke-WebRequest` 默认不启用 TLS 1.2**，排障时改用 `curl.exe`。
5. **`html_handling=auto-trailing-slash` 会把 `/xxx.html` 307 到 `/xxx`**：离线包下载链接必须用无扩展名路径（`/hantools-offline`），否则用户拿到的是首页壳或被重定向；`_headers` 里的附件头也要配在无扩展名路径上。
6. **构建脚本曾漏产出离线包**：`npm run build` 会清空 `dist`，旧脚本只跑 `build:site`，导致部署后 `/hantools-offline.html` 变成 SPA 回退的 1.6 KB 首页。现已把离线构建并入 `npm run build`，并在 `scripts/check-size.mjs` 中把离线包设为必需项（缺失即失败）。
7. **Cloudflare 会按 UA 注入 Web Analytics**：使用浏览器 UA 请求时，边缘会在 HTML 末尾插入 `static.cloudflareinsights.com/beacon.min.js`（curl 默认 UA 不会）。本站 CSP 已拦截（实测 `transferSize=0`，无数据外发），但控制台会出现 CSP 报错；彻底解决需在控制台关闭 Web Analytics 自动注入，或后续引入极简 Worker 用 `HTMLRewriter` 剥离该标签。
8. **标题后缀重复**：`setPageMeta('HanTools · CTF …')` 曾被无条件追加 ` · HanTools`，现改为"已以站名开头则不再追加"。
9. **离线单文件必须用 `<script type="module">` 内联**：离线构建产物是 ES module（含 `import.meta`），若内联进普通 `<script>` 会抛出 `SyntaxError: Cannot use 'import.meta' outside a module`，表现为整站白屏（首页 0 张卡片）。
10. **`file://` 下 `history.pushState` 会抛 SecurityError**（origin 为 null），因此离线版自动切换 hash 路由（`#/tools/regex`）；`navigateTo()` / `replaceUrl()` 对非 file 环境仍用 History API。

**上线后待办**

- ✅ 已开启 "Always Use HTTPS"（2026-11-08）：`http://` 全部 301 到 https，且深链路径保留（`/tools/base64` 不变）；
- ⬜ 控制台删除错拼的自定义域条目（`tools.hanbaobo.cn.hanbaobo.cn`）；
- ⬜ HSTS 建议稳定运行一周后再加（注意 `includeSubDomains` 会影响 blog / lab / www 等全部子域，不要勾 `preload`）；
- ⬜ 真机验收：PWA 安装 → 断网 → 打开 `/tools/hash`；下载离线单文件双击打开。

---

## 九、视觉规范（v1.1 追加）

采用 **深空蓝 Deep Space Blue v1.0**，规范原文存档于 `docs/deepspace-blue-spec.md`。

| 关键决策 | 说明 |
|---|---|
| 暗色单主题 | 规范要求 `color-scheme: dark`、不用纯白卡片；因此移除浅色主题与顶部切换按钮（`storageKeys.theme` 一并删除） |
| 单一强调色 | 全站唯一强调色 `#56A8FF`；状态色只保留错误红 `#EF4444`，`--ok` 映射为亮蓝、`--warn` 映射为冷白 |
| 玻璃三件套 | 卡片 / 面板 = `rgba(140,180,255,.05)` + `1px rgba(150,190,255,.14)` + `backdrop-filter: blur(22px)` |
| 景深 | `body::before` 三团径向光晕（蓝 .34 / 青 .18 / 蓝 .22）+ `body::after` 26px 点阵，内容层 `#app { z-index: 1 }` |
| 布局骨架 | 容器 1180px；顶栏 64px sticky 玻璃，含全局搜索（36px，回车走 SPA 跳 `/tools?q=`）；网格 `auto-fill minmax(250px,1fr)`，间距 16px |
| 卡片 | 18px 圆角 / 18px 内边距 / 最小高 148px；hover `translateY(-3px)` + 描边变亮 + 右上角 `→`；`focus-visible` 2px 蓝描边 |
| 字体层级 | 42 / 15 / 13 / 12.5 / 12px，无低于 12px 的文本；标题字距 `-0.03em` |
| 响应式 | ≤760px 顶栏换行 + 网格两列 + 卡片 14px 内边距；≤460px 单列 |
| 可访问性 | 全站 `:focus-visible`、`prefers-reduced-motion`、装饰元素 `aria-hidden` |
| 图标 | 内联线性 SVG（`stroke: currentColor`、线宽 1.7）；不用 emoji，避免多色破坏单一强调色 |
| 细节修复 | `[hidden]{display:none!important}`（否则 `.btn{display:inline-flex}` 会让"取消"按钮常驻）；移动端顶栏 `padding:10px 24px` 避免覆盖 `.container` 的横向内边距 |

验收对照（规范第 12 节）：

- [x] 底色 `#04060F`（非纯黑）
- [x] 只有一个强调色 `#56A8FF`
- [x] 卡片可透出光晕 / 点阵
- [x] hover 上浮 3px + 描边变亮 + 右上角箭头
- [x] Tab 可走通全部可点元素
- [x] 375px 无横向滚动（`overflow-x: hidden` + 单列）
- [x] `prefers-reduced-motion` 关闭过渡
- [x] 无低于 12px 的文字

---

## 十、0.3 增量：Worker 化与文件分析

| 能力 | 实现 | 线上验证（CDP 真实浏览器） |
|---|---|---|
| 正则 Worker | `src/workers/regex.worker.ts` + `?worker&inline`；1.5s 超时后 `terminate()` | `^(a+)+$` + 30 个 `a`：**1591ms 中止**，主线程 ping 6ms（未冻结） |
| 字典爆破 Worker | `crack.worker.ts` + `AbortController`；每 200 候选上报进度，可取消 | md5(`flag`) 在 `["admin","flag"]` 中**第 2 个命中** |
| 文件魔数 + strings | `fileinfo` 工具：40+ 签名、ASCII/UTF-16LE strings、hex 预览、SHA-256 | 32 B PNG 上传：识别 PNG + `flag{file_magic_ok}`（offset 8） |
| 拖拽上传 | `ToolPanel` 的 `file` 字段改为 dropzone（`DataTransfer` 回填 input） | 隐藏 input 仍可被 `DOM.setFileInputFiles` 驱动，分析/strings 均正常 |
| 纯逻辑拆分 | `tools/*/logic.ts`：主线程与 Worker 共用，避免「入口 → Worker 客户端 → Worker → 入口」循环 | 75/75 单测通过 |
| 构建形态 | inline worker（blob URL），CSP `worker-src 'self' blob:` | 离线单文件 159 KiB，仍可双击运行 |
| 离线路由 | `file://` 自动切换 hash 路由；`<script type="module">` 内联 ESM 产物 | 离线版：28 张卡片、`#/tools/regex` 可直达、Worker 正则返回「共 2 处匹配」 |

> 失败回退策略：Worker 创建失败（极老浏览器 / 隔离策略）时，正则与爆破会自动回退主线程；但 **正则超时不会回退**——那说明确实存在灾难性回溯，回退只会冻结页面。

### 0.4 追加（P0 第一批）

| 能力 | 实现 | 实测 |
|---|---|---|
| AES / DES / 3DES / RC4 | `crypto-js@4.2.0`（MIT，按需加载），补齐 hex/base64/文本密钥、CBC/ECB/CTR/CFB/OFB、五种填充与密钥/IV 长度校验 | 浏览器内 AES-128-ECB 得到 FIPS-197 向量 `69c4e0d8…`；解密还原；RC4 对齐 `bbf316e8d940af0ad3` |
| 零宽字符隐写 | 三种映射（200B/200C、200B/200D、2060/FEFF）+ 自动识别 + 不可见字符统计 | `flag{zw}` → 64 个零宽字符 → 解码还原 |
| ASCII / 字符码 | 文本 ↔ 十进制/十六进制/二进制/八进制码点，自动识别码制，附 ASCII 表 | `Hi` → `72 105`；`0x48 0x69` → `Hi`；`20320 22909` → `你好` |
| 二维码 | `qrcode`（MIT）+ `jsQR`（Apache-2.0）；生成 L/M/Q/H、128–1024px，识别支持反色与拖拽上传 | 生成后「识别预览」可还原；下载 PNG 可用 |
| 体积影响 | crypto-js 进入对称加密懒加载 chunk；离线单文件 238 KiB（预算 250） | 入口 JS 仍为 17.99 KiB gzip |
