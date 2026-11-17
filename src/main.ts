import './styles/tokens.css';
import './styles/components.css';
import './styles/panel.css';

import { catalog, findTool, toolPath } from './app/registry';
import { createRouter } from './app/router';
import { renderLayout } from './components/layout';
import { renderAbout, renderPrivacy } from './pages/about';
import { renderCatalog } from './pages/catalog';
import { renderCategory } from './pages/category';
import { renderHome } from './pages/home';
import { renderNotFound } from './pages/notFound';
import { renderOffline } from './pages/offline';
import { disposeToolPage, renderTool } from './pages/tool';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('缺少 #app 挂载点');

const layout = renderLayout(container, { site: catalog.site });

const router = createRouter({
  routes: [
    { pattern: '/', handler: () => renderHome(layout.view) },
    { pattern: '/tools', handler: (_params, query) => renderCatalog(layout.view, query) },
    { pattern: '/category/:slug', handler: (params) => renderCategory(layout.view, params.slug) },
    { pattern: '/tools/:slug', handler: async (params) => renderTool(layout.view, params.slug) },
    { pattern: '/about', handler: () => renderAbout(layout.view) },
    { pattern: '/privacy', handler: () => renderPrivacy(layout.view) },
    { pattern: '/offline', handler: () => renderOffline(layout.view) },
    {
      pattern: '/:alias',
      handler: (params) => {
        const tool = findTool(params.alias);
        if (tool) {
          router.navigate(toolPath(tool), true);
          return;
        }
        renderNotFound(layout.view, `路径 /${params.alias} 没有对应的工具`);
      },
    },
  ],
  notFound: () => renderNotFound(layout.view),
  onBeforeNavigate: () => {
    disposeToolPage();
    layout.view.replaceChildren();
  },
  onNavigate: (path) => {
    layout.setActive(path);
  },
});

router.start();

// 键盘快捷键：/ 聚焦搜索框（不在输入框内时）
document.addEventListener('keydown', (event) => {
  if (event.key !== '/') return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
  const input = document.querySelector<HTMLInputElement>('.topsearch__input, .search__input');
  if (input) {
    event.preventDefault();
    input.focus();
  }
});

// PWA：仅在构建产物中注册，避免开发模式下的缓存干扰 HMR
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

// 供离线页调用（beforeinstallprompt 事件）
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const installHost = window as unknown as { __hantoolsInstall?: (() => Promise<void>) | null };
installHost.__hantoolsInstall = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  const prompt = event as InstallPromptEvent;
  installHost.__hantoolsInstall = async () => {
    await prompt.prompt();
    await prompt.userChoice;
    installHost.__hantoolsInstall = null;
  };
});
