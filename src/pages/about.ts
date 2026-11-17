import { setPageMeta } from '../app/meta';
import { catalog } from '../app/registry';
import { destroyAllPanels } from '../components/ToolPanel';
import { h } from '../utils/dom';
import { clearUserData } from '../utils/storage';

/** 关于页与隐私页（静态内容，用 h() 构建，避免任何 innerHTML 注入风险） */

function prose(...children: Array<Node | string>): HTMLElement {
  return h('div', { class: 'prose' }, ...children);
}

export function renderAbout(view: HTMLElement): void {
  setPageMeta('关于', 'HanTools 的定位、原则、技术栈与免责声明。', '/about');
  view.append(
    h('h1', { text: '关于 HanTools' }),
    prose(
      h('p', {
        text: 'HanTools 是一个纯前端的工具站，主要给 CTF 和日常 Web 开发用。打开就能用，不需要注册；所有计算都在浏览器里完成。',
      }),
      h('h2', { text: '设计原则' }),
      h('ul', null,
        h('li', null, h('strong', { text: '本地优先：' }), '纯计算工具不发起任何网络请求，输入不出浏览器。'),
        h('li', null, h('strong', { text: '离线可用：' }), 'PWA 会缓存已访问页面，另提供单文件离线版（一个 HTML 即可运行）。'),
        h('li', null, h('strong', { text: '可分享：' }), '每个工具有独立 URL，例如 /tools/base64；同时支持短别名 /b64。'),
        h('li', null, h('strong', { text: '不夸大能力：' }), '解析 JWT 不等于验签；CRC32 不是密码学哈希；试除分解有明确上限。'),
      ),
      h('h2', { text: '技术栈' }),
      h('ul', null,
        h('li', null, 'Vite 8 + TypeScript（严格模式），无前端框架，首屏体积可控。'),
        h('li', null, 'Cloudflare Workers Static Assets 托管：静态请求免费且不限量。'),
        h('li', null, '哈希实现使用 @noble/hashes（MIT，已审计）；RSA 使用原生 BigInt。'),
        h('li', null, 'PWA：Service Worker 运行时缓存 + 预缓存应用外壳。'),
      ),
      h('h2', { text: '工具范围与边界' }),
      h('p', {
        text: `当前共 ${catalog.tools.length} 个工具，覆盖编码与杂项、密码学、Web 与开发辅助。我们不提供端口扫描、目录爆破、漏洞利用等针对第三方目标的主动探测功能，也不提供“自动拿 flag”能力——工具应当帮助理解题目，而不是替代思考。`,
      }),
      h('h2', { text: '免责声明' }),
      h('p', {
        text: '本工具仅用于 CTF 比赛、学习与获得授权的安全测试。请在合法授权范围内使用；因不当使用造成的后果由使用者自行承担。',
      }),
      h('h2', { text: '开源与许可' }),
      h('p', {
        text: '项目代码采用 MIT License。第三方依赖许可：@noble/hashes（MIT）。完整清单见仓库中的 NOTICE.md。',
      }),
    ),
  );
}

export function renderPrivacy(view: HTMLElement): void {
  setPageMeta('隐私说明', 'HanTools 如何处理你的数据：本地计算、CSP 约束、localStorage 与离线缓存。', '/privacy');

  const clearButton = h('button', {
    class: 'btn btn--small',
    attrs: { type: 'button' },
    text: '清除本机数据',
    on: {
      click: () => {
        clearUserData();
        destroyAllPanels();
        clearButton.textContent = '已清除';
        clearButton.setAttribute('disabled', '');
      },
    },
  });

  view.append(
    h('h1', { text: '隐私说明' }),
    prose(
      h('p', { text: '结论先行：HanTools 不会收集、上传或分析你的输入内容。页面不加载任何第三方脚本、字体或统计代码。' }),

      h('h2', { text: '1. 输入在哪里处理' }),
      h('p', {
        text: '编码解码、哈希、XOR、RSA、正则等全部在浏览器内通过 JavaScript 完成。工具页面没有上传接口，也从未调用 fetch / XMLHttpRequest 发送输入。',
      }),

      h('h2', { text: '2. 技术层面的保证（CSP）' }),
      h('p', {
        text: '站点通过 Content-Security-Policy 限制只能加载同源资源：connect-src 为 \'self\'，script-src 为 \'self\'，object-src 为 \'none\'。这意味着即使代码出现意外，浏览器也会阻止向第三方发送数据。你可以在开发者工具的 Network 面板中验证：使用本地工具时没有任何外部请求。',
      }),

      h('h2', { text: '3. 本地存储了什么' }),
      h('ul', null,
        h('li', null, '主题偏好（浅色 / 深色）'),
        h('li', null, '收藏的工具 slug'),
        h('li', null, '最近使用的工具 slug（最多 20 条，只记录工具，不记录输入）'),
      ),
      h('p', { text: '以上数据仅保存在你的浏览器 localStorage 中，键名以 hantools:v1: 开头，不会同步到任何服务器。' }),

      h('h2', { text: '4. 离线缓存' }),
      h('p', {
        text: 'Service Worker 只缓存同源 GET 请求（页面、脚本、样式），跨域请求一律直连且不写缓存。清除浏览器站点数据即可移除缓存。',
      }),

      h('h2', { text: '5. 敏感内容提醒' }),
      h('p', {
        text: '尽管工具不上传数据，仍建议不要在生产环境粘贴真实 Token、私钥或口令：请使用测试数据或在比赛环境中使用。JWT 页面的 Payload 是明文编码，任何人都能读取。',
      }),

      h('h2', { text: '6. 清除数据' }),
      h('p', null, clearButton),
    ),
  );
}
