# 工具箱 · 深空蓝（Deep Space Blue）界面规范 v1.0

> 这份文档是给 AI 读的：照着它就能把任意一个「工具集合类网页」改成同样的长相。
> 参考实现：同目录 `toolbox-skins.html`（单文件，纯 HTML/CSS/JS，零依赖）。
> 参考效果图：`_scratch/blue.png`

---

## 1. 一句话定义

**近黑的深海军蓝底 + 三团蓝紫光晕 + 半透明玻璃卡片 + 冷蓝高亮（#56A8FF）+ 细描边。**
气质关键词：深夜、科技、克制、有景深。不是霓虹赛博，不是纯黑极简，也不是玻璃糖果。

---

## 2. 五条硬性原则（违反就变味）

1. **底色不许用纯黑** `#000`，必须是带蓝的深色 `#04060F`，否则光晕会脏。
2. **只用一个高亮色**（亮蓝 `#56A8FF`）。其他颜色只能出现在背景光晕里，且饱和度很低。
3. **不许用大色块填充**。蓝色只出现在：小图标、选中态、描边、发光阴影、极少数按钮。
4. **玻璃感来自「低透明面板 + 1px 冷色描边 + 背景模糊」三件套**，不靠大面积渐变。
5. **阴影必须带蓝**，不许用黑色阴影（黑阴影会让画面发灰）。

---

## 3. 设计令牌（可直接复制）

```css
:root{
  --bg:            #04060F;              /* 页面底色 */
  --panel:         rgba(140,180,255,.05);/* 玻璃面板 */
  --panel-solid:   #080D18;              /* 不透明面板（抽屉/弹窗） */
  --line:          rgba(150,190,255,.14);/* 默认描边 */
  --line-strong:   rgba(120,180,255,.32);/* hover 描边 */
  --text:          #EEF3FF;              /* 主文字 */
  --muted:         #93A4C4;              /* 次要文字 */
  --accent:        #56A8FF;              /* 主高亮（唯一强调色） */
  --accent-ink:    #05101F;              /* 高亮色上的文字/图标 */
  --accent-soft:   rgba(86,168,255,.15); /* 高亮底色块（图标容器） */
  --topbar-bg:     rgba(5,8,17,.55);     /* 顶栏玻璃 */
  --chip-bg:       rgba(140,180,255,.07);
  --code-bg:       rgba(2,6,16,.50);

  --radius:        18px;                 /* 卡片圆角 */
  --radius-sm:     9px;                  /* 输入框/小控件 */
  --gap:           16px;                 /* 卡片间距 */
  --blur:          22px;                 /* 玻璃模糊半径 */

  --shadow:        0 0 0 1px rgba(140,190,255,.05), 0 20px 50px -30px rgba(37,119,255,.85);
  --shadow-hover:  0 0 0 1px rgba(86,168,255,.30),  0 26px 62px -28px rgba(37,119,255,.95);

  --ease:          cubic-bezier(.32,.72,0,1);
  --font: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
          "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace;

  color-scheme: dark;
}
```

功能色（只在报错时出现，别滥用）：`#EF4444`（错误描边/文字）。

---

## 4. 背景：三层光晕 + 点阵

页面背后有 **3 团径向渐变**，定位是「左上一团大的、右上一团青的、底部中间一团中的」，全部用 `transparent 60%~66%` 收边，形成景深而不是色块：

```css
body::before{
  content:""; position:fixed; inset:-20% -10% auto -10%; height:130%;
  background:
    radial-gradient(920px 520px at 10% -14%, rgba(37,119,255,.34), transparent 62%),
    radial-gradient(820px 470px at 90%   2%, rgba(34,211,238,.18), transparent 60%),
    radial-gradient(760px 430px at 50% 112%, rgba(59,130,246,.22), transparent 66%);
  pointer-events:none; z-index:0;
}
```

点阵纹理（可选，很加分）：26px 一格、1px 圆点 `rgba(150,195,255,.07)`，并用遮罩让它在页面顶部最清楚、往下淡出：

```css
body::after{
  content:""; position:fixed; inset:0; z-index:0; pointer-events:none;
  background-image: radial-gradient(rgba(150,195,255,.07) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: radial-gradient(1000px 700px at 50% 0%, #000 20%, transparent 78%);
}
```

内容层必须 `position:relative; z-index:1`，否则会被压在背景下面。

---

## 5. 布局骨架

| 区块 | 规格 |
|---|---|
| 容器 | `max-width: 1180px`，左右 `24px` 内边距，居中 |
| 顶栏 | `position: sticky; top: 0`，高 `64px`，`backdrop-filter: blur(22px) saturate(160%)`，下边 1px 描边 |
| 搜索框 | 靠右，高 `36px`，`flex: 0 1 300px`，圆角 `calc(18px - 2px)` |
| 风格切换 | 胶囊分段控件，靠最右 |
| 标题区 | 上 `56px` 下 `26px`，标题 `clamp(28px, 4.4vw, 42px)` / 字重 700 / 字距 `-0.03em` |
| 分类条 | 上方 `30px` 下方 `18px`，胶囊按钮，间距 `8px` |
| 卡片网格 | `grid-template-columns: repeat(auto-fill, minmax(250px, 1fr))`，间距 `16px`，底部留 `72px` |

---

## 6. 组件规格

### 6.1 工具卡片（核心元件）

- 内边距 `18px`，最小高度 `148px`，`flex` 竖排，内部间距 `12px`
- 背景 `var(--panel)`，边框 `1px solid var(--line)`，圆角 `18px`
- `backdrop-filter: blur(22px)`（玻璃感的关键）
- 阴影用 `var(--shadow)`（自带 1px 冷光描边 + 蓝色外发光）
- **hover**：`translateY(-3px)`，描边转 `--line-strong`，阴影切 `--shadow-hover`，右上角浮现一个 `→`（从 `translateX(-4px)` 滑到 0，透明度 0 → 0.9）
- **focus-visible**：`outline: 2px solid var(--accent); outline-offset: 3px`
- 过渡：`transform .22s var(--ease), box-shadow .22s, border-color .22s`

卡内结构（自上而下）：
1. 图标容器 `38×38`，圆角 `10px`，底色 `--accent-soft`，描边 `1px solid color-mix(in oklab, var(--accent) 22%, transparent)`，图标 `19px`、线宽 `1.7`、`currentColor`（=高亮蓝）
2. 标题 `14.5px` / 640 / 字距 `-0.01em`
3. 描述 `12.5px` / 行高 `1.55` / `--muted`，最多两行
4. 底部元信息 `11px` / 600 / 大写 / `--muted`，前面一个 `5px` 的蓝色圆点

### 6.2 胶囊分类按钮

- 常态：透明底 + `1px` 描边、字号 `13px`、字重 `550`、内边距 `7px 14px`
- hover：文字转主色、描边转 `--line-strong`、`translateY(-1px)`
- 选中：实心 `--accent` + 文字 `--accent-ink`，外加 `0 6px 18px -10px` 的蓝色光

### 6.3 按钮

- 圆角 `999px`（胶囊），字号 `13px` / 600，内边距 `8px 15px`
- 常态：`--chip-bg` 底 + `--line` 描边
- 主按钮：`--accent` 底 + `--accent-ink` 字，带 `0 8px 20px -12px` 蓝色投影
- 幽灵按钮：透明底，只有文字

### 6.4 右侧抽屉（工具详情面板）

- 宽度 `min(560px, 100%)`，贴右，全高，背景 `--panel-solid`（必须不透明，玻璃会花）
- 左侧 1px 描边 + `-30px 0 70px -40px rgba(0,0,0,.6)` 投影
- 进出场：`translateX(102%) → 0`，`.38s var(--ease)`
- 遮罩：`rgba(6,6,12,.42)` + `blur(3px)`，点击关闭，`Esc` 关闭

### 6.5 输入框 / 结果框

- `font-family: var(--mono)`，`12.5px` / 行高 `1.7`
- 底 `--code-bg`，`1px solid var(--line)`，圆角 `9px`，内边距 `12px 14px`
- 聚焦：描边转 `--accent` + `box-shadow: 0 0 0 3px accent 16%`
- 报错态：描边和文字转 `#EF4444`

### 6.6 轻提示（Toast）

黑底白字（底色用 `--text`、文字用 `--bg`，天然高对比），胶囊形，居中偏下 `30px`，文字 `13px / 550`，进出用 `opacity + translateY(16px)`。

---

## 7. 字体与排版

- 正文一律用 `--font`（优先 Inter，中文落 PingFang / 微软雅黑）
- 代码、JSON、输入输出用 `--mono`
- 标题字距收紧到 `-0.03em`，正文 `-0.01em`，这是"贵"的来源
- 行高：标题 `1.12`，正文 `1.55~1.65`
- 层级只有 4 档：42 / 15 / 13 / 12.5 px，不要更多

---

## 8. 响应式

| 断点 | 变化 |
|---|---|
| `≤ 760px` | 顶栏允许换行（搜索框占满一行），网格 `1fr 1fr`，卡片内边距降到 `14px`，标题区上边距 `34px` |
| `≤ 460px` | 网格单列 |

---

## 9. 可访问性（别省）

- 主文字 `#EEF3FF` 对 `#04060F` 对比度 ≈ 18:1；次要文字 `#93A4C4` ≈ 8:1，都过 AA
- 高亮蓝 `#56A8FF` 对深底 ≈ 8:1，可当文字色用
- 所有可点元素带 `:focus-visible` 描边，不许 `outline: none`
- `@media (prefers-reduced-motion: reduce)` 里关掉所有过渡
- 抽屉有 `role="dialog"` / `aria-modal` / `aria-hidden` 切换

---

## 10. 禁止事项清单

- ❌ 紫色主调（那是另一套皮肤，这套只用蓝）
- ❌ 纯黑背景、纯白卡片
- ❌ 彩色渐变按钮、大面积饱和色块
- ❌ 黑色投影、硬阴影、`box-shadow: 0 2px 4px #000`
- ❌ 卡片使用不透明背景（会失去景深）
- ❌ 多个强调色同时出现

---

## 11. 把现有项目改成这套外观：操作顺序

给 AI 的移植步骤（按序执行，逐步验证）：

1. **抽变量**：把文档第 3 节整块塞进全局 CSS（`:root`），先只改颜色，不动布局。
2. **铺背景**：加 `body::before`（光晕）和 `body::after`（点阵），内容层提 `z-index`。
3. **换容器**：页面宽度 `1180px`，顶栏 sticky + 玻璃。
4. **改卡片**：套第 6.1 节（玻璃底 + 1px 冷描边 + 蓝色发光阴影 + 上浮 hover）。
5. **统一圆角与间距**：18px / 16px，全站一致，不许出现第二种圆角体系。
6. **收强调色**：搜一遍代码里所有非蓝的高亮色，全部替换为 `--accent`。
7. **补状态**：hover / focus-visible / active / 禁用 四态补齐。
8. **跑验收清单**（第 12 节）。

---

## 12. 验收清单

- [ ] 截图取色，平均值应落在 `(10, 14, 27)` 附近（深蓝而非纯黑）
- [ ] 页面上只有一个高亮色，且是 `#56A8FF` 系列
- [ ] 卡片背后能隐约看到光晕/点阵（不是死板的一块深色）
- [ ] 鼠标移上卡片会浮起 3px、描边变亮、右上角出现箭头
- [ ] Tab 键能走通所有可点元素，且看得见焦点框
- [ ] 宽度 375px 时不出现横向滚动条
- [ ] 关掉动画偏好后，页面没有任何过渡
- [ ] 文字没有低于 12px 的地方

---

## 13. 与开源项目的关系

这套外观的骨架参考了下面三个方向，不是某个项目的直接拷贝：

- **shadcn/ui**（127k⭐，https://github.com/shadcn-ui/ui ）—— 变量驱动、细描边、克制的层级
- **Magic UI**（23k⭐，https://github.com/magicuidesign/magicui ）—— 光晕、模糊、发光阴影的做法
- **Aceternity UI** 风格的深色落地页 —— 顶栏玻璃 + 大标题 + 卡片网格的节奏

如果要换成成熟实现而不是自写 CSS，最接近的是 **shadcn-admin**（17k⭐，https://github.com/satnaing/shadcn-admin ），把它默认主题的 `--primary` 换成 `#56A8FF`、背景换成 `#04060F` 即可得到 90% 相同的观感。

---

## 14. 给 AI 的提示词（可直接复制）

```
把这个工具箱页面改成「深空蓝」风格。严格要求：
1. 背景 #04060F（不要纯黑），背后加三团径向光晕（蓝紫 .34 / 青 .18 / 蓝 .22），
   再叠一层 26px 的点阵纹理，顶部清楚、往下淡出。
2. 卡片用 rgba(140,180,255,.05) 玻璃底 + 1px rgba(150,190,255,.14) 描边 +
   backdrop-filter: blur(22px)，圆角 18px，间距 16px，阴影必须带蓝色发光。
3. 全局只有一个强调色 #56A8FF，用于图标、选中态、描边和发光，不许出现紫色或其他彩色。
4. 文字 #EEF3FF，次要文字 #93A4C4，标题字距 -0.03em。
5. hover 时卡片上浮 3px，描边变亮，右上角浮现箭头；所有可点元素要有 focus-visible。
6. 布局：容器 1180px，sticky 玻璃顶栏 64px，卡片网格 auto-fill minmax(250px,1fr)。
7. 不要引入任何 UI 框架，纯 CSS 变量实现；改完按下面的验收清单自查：
   只有一个强调色 / 卡片能透出光晕 / 375px 无横向滚动 / 文字不低于 12px / 支持 reduced-motion。
```

---

*文档版本 v1.0 · 对应实现 `toolbox-skins.html` 中的 `data-skin="neon"` 皮肤*
