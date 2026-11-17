# HanTools · CTF 与开发在线工具集

面向 CTF 选手、学生与开发者的中文在线工具集。所有工具都在**浏览器本地**完成计算，不上传输入、不加载第三方脚本；同时支持 **PWA 离线**与**单文件离线版**，适合断网/内网赛场。

- 线上地址：<https://tools.hanbaobo.cn>
- 工具数量：19 个（编码与杂项、密码学、Web、开发辅助）
- 许可：MIT

---

## 功能一览

| 分类 | 工具 | 路径 | 要点 |
|---|---|---|---|
| 编码与杂项 | Base64 / Base32 / Base16 | `/tools/base64` | 标准 + URL-safe、自动识别变体、容错解码 |
| 编码与杂项 | 编码链自动识别 | `/tools/magic` | BFS 多层解码（≤6 层）+ 评分排序，识别 `flag{}` |
| 编码与杂项 | Hex / Hexdump | `/tools/hex` | 文本↔hex、生成/解析 xxd 风格 |
| 编码与杂项 | 乱码修复 | `/tools/mojibake` | Latin-1 / GBK 错配还原（运行时构建 GBK 反查表） |
| 编码与杂项 | 零宽字符隐写 | `/tools/zero-width` | 三种零宽映射编解码、自动识别、不可见字符统计 |
| 编码与杂项 | ASCII / 字符码转换 | `/tools/ascii` | 文本 ↔ 十进制/十六进制/二进制/八进制码值，含 ASCII 表 |
| 编码与杂项 | 二维码生成与识别 | `/tools/qr` | 生成可扫二维码（L/M/Q/H、128–1024px）、从图片解码、下载 PNG |
| 编码与杂项 | 文件魔数识别与 strings | `/tools/file` | 40+ 种文件头识别、ASCII/UTF-16LE strings、头部 hex、SHA-256 |
| 密码学 | 哈希计算与识别 | `/tools/hash` | MD5/SHA-1/SHA-2/SHA-3/Keccak/RIPEMD-160/CRC32 + **Worker 字典爆破**（可取消） |
| 密码学 | XOR 加解密与爆破 | `/tools/xor` | 单字节 256 键爆破、crib 反推重复密钥 |
| 密码学 | 古典密码 | `/tools/cipher` | 凯撒（26 位移枚举）/ ROT13 / Atbash / 维吉尼亚 / 摩斯 |
| 密码学 | AES / DES / RC4 加解密 | `/tools/symmetric` | AES 五种模式、DES/3DES、RC4；hex/base64/文本密钥，五种填充 |
| 密码学 | RSA 工具箱 | `/tools/rsa` | 小指数开方、试除分解、已知 p/q 解密（BigInt） |
| Web | URL / HTML / Unicode 转义 | `/tools/url` | 8 种模式，解码严格校验 |
| Web | JWT 解析与校验 | `/tools/jwt` | 解码 + HS256/384/512 验签 + `alg=none` 告警 |
| 开发辅助 | JSON 格式化与校验 | `/tools/json` | 格式化/压缩/键排序/行列错误定位 |
| 开发辅助 | 进制转换与位运算 | `/tools/radix` | BigInt 任意精度，AND/OR/XOR/NOT/移位 |
| 开发辅助 | 正则表达式测试 | `/tools/regex` | 匹配高亮、分组、替换预览；**Worker 内执行 + 1.5s 超时**，防 ReDoS |
| 开发辅助 | 时间戳转换 | `/tools/timestamp` | 秒/毫秒自动识别、UTC/本地/ISO/相对时间 |

短别名：`/b64` → `/tools/base64`、`/md5` → `/tools/hash`、`/mojibake`、`/正则` 等（见 `src/data/tools.json`）。

---

## 视觉规范

**深空蓝 Deep Space Blue v1.0**，规范原文见 [`docs/deepspace-blue-spec.md`](docs/deepspace-blue-spec.md)。

| 约束 | 实现 |
|---|---|
| 底色不用纯黑 | `--bg: #04060F` |
| 只有一个强调色 | `--accent: #56A8FF`（图标 / 选中态 / 描边 / 发光） |
| 玻璃三件套 | `rgba(140,180,255,.05)` + `1px rgba(150,190,255,.14)` + `backdrop-filter: blur(22px)` |
| 阴影必须带蓝 | `--shadow` / `--shadow-hover` 使用蓝色外发光，不用黑阴影 |
| 景深 | `body::before` 三团径向光晕 + `body::after` 26px 点阵（顶部清晰、向下淡出） |
| 暗色单主题 | 已移除浅色切换（换肤会破坏"唯一强调色"约束） |

卡片：18px 圆角 / 18px 内边距 / 最小高 148px；hover 上浮 3px + 描边变亮 + 右上角 `→` 浮现；`focus-visible` 统一 2px 蓝色描边。

图标使用**内联线性 SVG**（`stroke: currentColor`、线宽 1.7），不使用 emoji——emoji 自带多色会破坏"单一强调色"约束。

验收截图：`docs/screenshots/`（桌面首页 / 375px 首页 / 工具页 / 分类页 / 目录页）。

---

## 技术栈

| 层 | 选择 | 说明 |
|---|---|---|
| 构建 | Vite 8 + TypeScript（strict） | 无前端框架，首屏 JS ≈ 17 KB gzip |
| 路由 | 自研 History API 路由（`src/app/router.ts`） | 支持 `/tools/:slug`、短别名、SPA 回退 |
| 工具模块 | 目录约定 + `import.meta.glob` 懒加载 | 新增工具只加一个目录 + 一条元数据 |
| 哈希 | `@noble/hashes`（MIT，已审计） | 不依赖 Web Crypto 算法白名单 |
| 部署 | Cloudflare Workers Static Assets | 静态请求免费且不限量 |
| 离线 | PWA（运行时缓存）+ 单文件 HTML（下载入口 `/hantools-offline`，无扩展名） | 断网可用 |
| 测试 | Vitest 5 | 60 个断言级用例覆盖纯函数 |

---

## 本地开发

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build         # typecheck + 站点 + 预渲染 + 离线单文件（一条命令产出全部部署资产）
npm run build:site    # 只构建站点（不含离线包，调试用）
npm run build:offline # 单独重建离线单文件
```

要求 Node ≥ 22.12（Vite 8 的 engines 约束）。仓库含 `.nvmrc`。

---

## 部署到 Cloudflare Workers

```bash
npm run build
npx wrangler deploy
```

`wrangler.jsonc` 关键配置：

```jsonc
{
  "name": "hantools",
  "workers_dev": true,
  "routes": [{ "pattern": "tools.hanbaobo.cn", "custom_domain": true }],
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
    "html_handling": "auto-trailing-slash"
  }
}
```

> **为什么必须写 `workers_dev: true`**：Cloudflare 的规则是「配置里出现 `routes` 但未显式声明 `workers_dev` 时，下次部署会把 `workers_dev` 推断为 `false`」。
> 那会关闭 `hantools.hanbaobo.workers.dev` 这个备用入口——CTF 期间自定义域异常时它是最后一道兜底。

上线检查清单：

1. `npm run build && npx wrangler deploy`；控制台应输出 `https://hantools.hanbaobo.workers.dev`。
2. 先在 `*.workers.dev` 验证深链刷新：`/tools/base64`（应为预渲染标题）、`/b64`（别名跳转）、`/no-such-page`（站点内 404）。
3. 绑定自定义域：Dashboard → Workers & Pages → hantools → Settings → Domains & Routes → **添加域名** → `tools.hanbaobo.cn`。
   - Cloudflare 自动创建 Proxied CNAME（`tools` → `hantools.hanbaobo.workers.dev`），无需手填记录；
   - 不要用「添加路由」代替，也不要手建 A 记录指向任意 IP。
4. 核对 DNS 无悬空记录；若该子域之前查询过 NXDOMAIN，递归 DNS 会负缓存最多 30 分钟（SOA minimum 1800），必要时 `ipconfig /flushdns` 或用 `-Server 1.1.1.1` 验证。
5. 用 DevTools Network 面板确认：使用工具时**零外部请求**（CSP 已强制 `connect-src 'self'`）。
6. 检查响应头含 `content-security-policy` / `x-content-type-options` / `referrer-policy`（来自 `public/_headers`），静态资源含 `cache-control: max-age=31536000, immutable`。
7. 开启 `SSL/TLS → 边缘证书 → Always Use HTTPS`，并验证跳转（深链路径必须保留，不能只跳到首页）：
   ```powershell
   curl.exe -sS -I http://tools.hanbaobo.cn/tools/base64
   # 期望：HTTP/1.1 301 + Location: https://tools.hanbaobo.cn/tools/base64
   ```

> `.cn` 域名提醒：域名需完成实名认证；托管在 Cloudflare（境外）**不需要 ICP 备案**，但若将来改用国内 OSS/CDN 就必须备案。

---

## 目录结构

```
hantools/
├── public/                  # 静态资源与安全头（_headers、sw.js、manifest）
├── scripts/
│   ├── prerender.mjs        # 每个工具/分类生成独立 meta 的 HTML 壳 + sitemap
│   └── inline-offline.mjs   # 单文件离线版内联
├── src/
│   ├── app/                 # router / registry / search / meta
│   ├── components/          # layout / ToolPanel / 搜索框 / 卡片
│   ├── data/tools.json      # 唯一工具元数据来源（构建脚本也读它）
│   ├── pages/               # 首页 / 目录 / 分类 / 工具 / 关于 / 隐私 / 离线 / 404
│   ├── styles/              # tokens / components / panel
│   ├── tests/               # Vitest 用例
│   ├── tools/<key>/index.ts # 工具实现：纯函数 + mount()
│   ├── types.ts
│   └── main.ts
├── index.html
├── vite.config.ts
├── vite.config.offline.ts
└── wrangler.jsonc
```

---

## 新增一个工具

1. 在 `src/tools/<key>/index.ts` 导出 `mount(root: HTMLElement)`，逻辑写成可单测的纯函数。
2. 在 `src/data/tools.json` 增加元数据：`key` 必须与目录名一致，`slug` / `aliases` 不得与保留路径冲突（构建期会报错）。
3. 在 `src/tests/` 增加至少 4 个断言：正常、边界、错误、往返。
4. `npm run typecheck && npm test && npm run build` 全绿后提交。

详细规范见 `CONTRIBUTING.md`。

---

## 隐私与安全

- **本地计算**：工具模块不发起网络请求；`connect-src 'self'` 由 CSP 强制。
- **CSP**：`default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'`。
- **本地存储**：仅主题、收藏、最近使用（工具 slug），键名前缀 `hantools:v1:`。
- **敏感内容**：JWT Payload 是明文编码；请勿粘贴生产 Token。
- **边界**：不提供端口扫描、目录爆破、漏洞利用等针对第三方目标的主动探测，也不提供自动获取 flag 的功能。仅限 CTF 与授权测试。
- **Cloudflare 边缘注入**：若 Zone 开启了 Web Analytics，Cloudflare 会向 HTML 注入 `static.cloudflareinsights.com/beacon.min.js`。本站 CSP（`script-src 'self'`）会**拦截**它（实测 `transferSize = 0`，没有数据外发），但控制台会出现一条 CSP 报错。要彻底消除，请在控制台关闭 Web Analytics 自动注入（分析 → Web Analytics → 管理站点 → 删除/关闭）。

---

## 路线图

| 版本 | 内容 | 状态 |
|---|---|---|
| 0.2 | 骨架 + 14 个工具 + 搜索/分类/收藏 + PWA + 离线单文件 | ✅ 已完成 |
| 0.3 | 文件魔数/strings、正则与爆破 Worker 化（15 个工具）；后续：AES/DES、拖拽已支持 | 🚧 进行中 |
| 0.4 | 对称加密（AES/DES/RC4）、零宽字符、ASCII 码、二维码（19 个工具）；待做：ZIP、LSB | 🚧 进行中 |
| 1.0 | 文档站、贡献流程、自动化部署流水线 | 计划中 |

设计文档（v1.0 → v1.1 差异）见 `docs/design-v1.1.md`。

---

## License

MIT。第三方依赖许可见 `NOTICE.md`。
