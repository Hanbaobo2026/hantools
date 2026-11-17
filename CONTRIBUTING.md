# 贡献指南

感谢你考虑为 HanTools 贡献工具。这个项目刻意保持"小而可靠"：**宁可少而准，不要多而杂**。

## 新增工具 Checklist

1. **目录与实现**：`src/tools/<key>/index.ts`，导出 `mount(root: HTMLElement)`。
   - 纯计算逻辑必须导出为函数（可被 Vitest 直接导入测试），不要写在 `mount` 内部。
   - 不得发起任何网络请求（`fetch` / `XMLHttpRequest` / WebSocket / 动态 `<script>`）。
   - 大计算量任务必须支持 `AbortSignal` 并周期性 `await yieldToUi()`，避免卡死主线程。
2. **元数据**：在 `src/data/tools.json` 的 `tools` 数组追加一项。
   - `key` 必须与目录名完全一致。
   - `slug` 只能是小写字母/数字/连字符；`aliases` 可含中文。
   - 不得与 `RESERVED_PATHS`（`tools`、`about`、`privacy`、`category` 等）冲突——构建期会直接报错。
   - `privacy` 填 `local`；`offline` 填 `true`。
3. **测试**：在 `src/tests/*.test.ts` 增加至少 4 组断言：正常输入、边界输入、错误输入、往返一致性。
4. **本地验证**：
   ```bash
   npm run typecheck && npm test && npm run build
   ```
5. **隐私与合规**：不得提供针对第三方目标的扫描/爆破/利用能力；不得提供自动获取 flag 的功能。

## 代码风格

- TypeScript strict；不使用 `any`（必要时用 `unknown` + 收窄）。
- DOM 一律通过 `src/utils/dom.ts` 的 `h()` 构建；用户输入**只能**走 `text`，禁止拼 `innerHTML`。
- 中文文案统一使用全角标点；工具说明避免夸大（例如 CRC32 不能称为"加密"）。
- 新样式优先复用 `src/styles/` 中的类，避免在工具内写内联样式。

## 提交与 PR

- 一个 PR 只做一件事（新增一个工具 / 修一个 bug）。
- PR 描述包含：工具用途、输入输出示例、隐私说明、测试结果截图（如有 UI 变更）。
- CI 必须全绿：typecheck → test → build。

## 报告问题

请附带：浏览器与版本、复现步骤、期望结果、实际结果；若涉及算法结果，请给出输入与期望输出（不要贴真实 flag 或生产 Token）。
