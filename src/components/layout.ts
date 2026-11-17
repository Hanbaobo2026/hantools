import { h } from '../utils/dom';
import { navigateTo } from '../app/navigation';

/**
 * 站点外壳：玻璃顶栏（品牌 / 导航 / 全局搜索）+ 页脚。
 * 深空蓝规范为暗色单主题，不再提供浅色切换。
 */

export interface LayoutOptions {
  site: { name: string; version: string; origin: string };
}

export interface Layout {
  view: HTMLElement;
  setActive(path: string): void;
  setMeta(title: string, description?: string): void;
}

const NAV_ITEMS = [
  { href: '/tools', label: '全部工具' },
  { href: '/offline', label: '离线使用' },
  { href: '/about', label: '关于' },
  { href: '/privacy', label: '隐私' },
];

export function renderLayout(app: HTMLElement, options: LayoutOptions): Layout {
  app.replaceChildren();

  const navLinks = NAV_ITEMS.map((item) =>
    h('a', { class: 'site-nav__link', attrs: { href: item.href }, text: item.label }),
  );

  const searchInput = h('input', {
    class: 'topsearch__input',
    attrs: {
      type: 'search',
      name: 'q',
      placeholder: '搜索工具…',
      'aria-label': '搜索工具',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });

  const topSearch = h(
    'form',
    {
      class: 'topsearch',
      attrs: { role: 'search', action: '/tools', method: 'get' },
      on: {
        submit: (event) => {
          event.preventDefault();
          const keyword = searchInput.value.trim();
          navigateTo(keyword ? `/tools?q=${encodeURIComponent(keyword)}` : '/tools');
          searchInput.blur();
        },
      },
    },
    searchInput,
  );

  const header = h(
    'header',
    { class: 'site-header' },
    h(
      'div',
      { class: 'container site-header__inner' },
      h(
        'a',
        { class: 'brand', attrs: { href: '/', 'aria-label': 'HanTools 首页' } },
        h('span', { class: 'brand__mark', text: '</>' }),
        h('span', { class: 'brand__name', text: options.site.name }),
        h('span', { class: 'brand__tag', text: 'CTF 工具箱' }),
      ),
      h('nav', { class: 'site-nav', attrs: { 'aria-label': '主导航' } }, ...navLinks),
      topSearch,
    ),
  );

  const view = h('main', { class: 'container view', attrs: { id: 'view', tabindex: '-1' } });

  const footer = h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'container site-footer__inner' },
      h(
        'div',
        { class: 'site-footer__brand' },
        h('strong', { text: options.site.name }),
        h('p', { class: 'site-footer__note', text: '所有计算在浏览器本地完成，不上传、不追踪。' }),
      ),
      h(
        'nav',
        { class: 'site-footer__links', attrs: { 'aria-label': '页脚导航' } },
        ...NAV_ITEMS.map((item) => h('a', { attrs: { href: item.href }, text: item.label })),
        h('a', { attrs: { href: '/tools' }, text: '工具列表' }),
      ),
      h(
        'p',
        { class: 'site-footer__meta' },
        `v${options.site.version} · MIT License · `,
        h('a', { attrs: { href: options.site.origin }, text: 'tools.hanbaobo.cn' }),
      ),
    ),
  );

  const skipLink = h('a', { class: 'skip-link', attrs: { href: '#view' }, text: '跳到主内容' });

  app.append(skipLink, header, view, footer);

  return {
    view,
    setActive(path: string) {
      const normalized = path.replace(/\/+$/, '') || '/';
      for (const link of navLinks) {
        const href = link.getAttribute('href') ?? '';
        const isActive = href === '/tools' ? normalized === '/tools' || normalized.startsWith('/tools/') || normalized.startsWith('/category/') : href === normalized;
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    },
    setMeta(title: string, description?: string) {
      document.title = title === options.site.name ? title : `${title} · ${options.site.name}`;
      if (description) {
        const meta = document.querySelector('meta[name="description"]');
        meta?.setAttribute('content', description);
      }
    },
  };
}
