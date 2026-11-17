import { setPageMeta } from '../app/meta';
import { h } from '../utils/dom';

/**
 * 离线使用页。
 * 提供两种离线方式：
 *  1) PWA：安装后离线打开已访问过的页面（Service Worker 运行时缓存）
 *  2) 单文件离线版：下载 hantools-offline.html，双击即可用（适合断网赛场）
 */

export function renderOffline(view: HTMLElement): void {
  setPageMeta('离线使用', '安装为 PWA 或下载单文件离线版，在断网 / 内网环境中继续使用 HanTools。', '/offline');

  const installState = h('p', { class: 'panel__status', attrs: { 'aria-live': 'polite' } });

  const installButton = h('button', {
    class: 'btn btn--primary',
    attrs: { type: 'button' },
    text: '安装 / 添加到主屏幕',
    on: {
      click: () => {
        void (async () => {
          const anyWindow = window as unknown as { __hantoolsInstall?: (() => Promise<void>) | null };
          if (anyWindow.__hantoolsInstall) {
            try {
              await anyWindow.__hantoolsInstall();
              installState.textContent = '已触发安装流程';
            } catch {
              installState.textContent = '安装被取消';
            }
            return;
          }
          installState.textContent =
            '当前浏览器未提供安装入口：Chrome/Edge 可在地址栏右侧选择“安装”，iOS Safari 使用“分享 → 添加到主屏幕”。';
        })();
      },
    },
  });

  const swState = h('p', { class: 'panel__status' });

  view.append(
    h('h1', { text: '离线使用' }),
    h('p', {
      class: 'hero__lead',
      text: '比赛现场经常是内网或弱网环境。HanTools 提供两条离线路径：安装为应用（PWA），或直接下载单文件离线版。',
    }),

    h('h2', { text: '方式一：安装为 PWA（推荐）' }),
    h('ul', { class: 'prose' },
      h('li', null, 'Chrome / Edge：地址栏右侧出现安装图标，或菜单 → “安装 HanTools”。'),
      h('li', null, 'Android Chrome：菜单 → “添加到主屏幕”。'),
      h('li', null, 'iOS Safari：分享 → “添加到主屏幕”。'),
      h('li', null, '安装后首次访问过的页面会被缓存，之后即使断网也能打开。'),
    ),
    h('div', { class: 'panel__actions' }, installButton, swState),
    installState,

    h('h2', { text: '方式二：单文件离线版' }),
    h('p', {
      class: 'prose',
      text: '构建会额外产出一个把所有脚本与样式内联的 HTML 文件。下载后双击即可在任意浏览器中使用，不依赖网络，也不需要本地服务器。',
    }),
    h(
      'p',
      { class: 'panel__actions' },
      h('a', {
        class: 'btn btn--primary',
        attrs: { href: '/hantools-offline', download: 'hantools-offline.html' },
        text: '下载 hantools-offline.html',
      }),
    ),
    h('div', {
      class: 'callout callout--warn',
      text: '注意：离线版是构建产物快照，不会自动更新；新增工具后请重新下载。开发模式（npm run dev）下该文件不存在，需先执行 npm run build（会同时生成并复制到 dist）。离线版在 file:// 下使用 hash 路由（如 #/tools/base64），刷新不会丢失当前工具。',
    }),

    h('h2', { text: '离线能力边界' }),
    h('ul', { class: 'prose' },
      h('li', null, '所有工具均为纯前端计算，因此离线状态下功能完整（含哈希爆破、RSA、正则）。'),
      h('li', null, 'PWA 缓存需要“先访问过”；未访问过的工具页在离线时可能打不开。'),
      h('li', null, '单文件离线版包含全部工具，体积略大于按需加载的在线版本。'),
    ),
  );

  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistration().then((registration) => {
      swState.textContent = registration
        ? 'Service Worker 已注册：已访问页面支持离线打开。'
        : 'Service Worker 未注册（开发模式或浏览器限制）。构建产物部署后会自动注册。';
    });
  } else {
    swState.textContent = '当前浏览器不支持 Service Worker，请使用单文件离线版。';
  }
}
