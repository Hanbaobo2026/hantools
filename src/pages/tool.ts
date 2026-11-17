import { setPageMeta } from '../app/meta';
import { categoryOf, findTool, loadToolModule, relatedTools, toolPath } from '../app/registry';
import { destroyAllPanels } from '../components/ToolPanel';
import { toolGrid } from '../components/toolCard';
import { copyText } from '../utils/clipboard';
import { h } from '../utils/dom';
import { isFavorite, pushRecent, toggleFavorite } from '../utils/storage';
import { renderNotFound } from './notFound';

/**
 * 工具详情页：卸载 / 中断由 disposeToolPage 统一负责，路由每次导航前调用。
 */

let cleanup: (() => void) | null = null;

export function disposeToolPage(): void {
  cleanup?.();
  cleanup = null;
  destroyAllPanels();
}

const WARNINGS: Record<string, string> = {
  jwt: '解析不等于验签：Payload 只是 Base64URL 编码，任何人都能读取。请勿粘贴生产环境的真实 Token。',
  hash: '字典爆破仅在本机运行，使用你提供的候选或内置小字典；不会联网查询。',
  rsa: '大数分解很耗算力：试除上限为 100 万，超大 n 请使用专用工具（如 yafu / RsaCtfTool）。',
};

export async function renderTool(view: HTMLElement, slug: string): Promise<void> {
  const tool = findTool(slug);
  if (!tool) {
    renderNotFound(view, `工具 “${slug}” 不存在，可能已改名。`);
    return;
  }

  const category = categoryOf(tool.category);
  setPageMeta(tool.name['zh-CN'], tool.description['zh-CN'], toolPath(tool));

  const feedback = h('p', { class: 'panel__status', attrs: { 'aria-live': 'polite', role: 'status' } });

  const favoriteButton = h('button', {
    class: 'btn btn--small',
    attrs: { type: 'button', 'aria-pressed': String(isFavorite(tool.slug)) },
    text: isFavorite(tool.slug) ? '★ 已收藏' : '☆ 收藏',
    on: {
      click: () => {
        const added = toggleFavorite(tool.slug);
        favoriteButton.textContent = added ? '★ 已收藏' : '☆ 收藏';
        favoriteButton.setAttribute('aria-pressed', String(added));
        feedback.textContent = added ? '已加入收藏（保存在本机）' : '已取消收藏';
      },
    },
  });

  const copyButton = h('button', {
    class: 'btn btn--small btn--ghost',
    attrs: { type: 'button' },
    text: '复制链接',
    on: {
      click: () => {
        void copyText(`${window.location.origin}${toolPath(tool)}`).then((ok) => {
          feedback.textContent = ok ? '工具链接已复制' : '复制失败，请手动复制地址栏链接';
        });
      },
    },
  });

  const panelHost = h('div', { class: 'panel', attrs: { id: 'tool-panel' } });

  view.append(
    h(
      'nav',
      { class: 'breadcrumbs', attrs: { 'aria-label': '面包屑' } },
      h('a', { attrs: { href: '/' }, text: '首页' }),
      h('span', { class: 'breadcrumbs__sep', text: '/' }),
      category
        ? h('a', { attrs: { href: `/category/${category.slug}` }, text: category.name['zh-CN'] })
        : h('a', { attrs: { href: '/tools' }, text: '全部工具' }),
      h('span', { class: 'breadcrumbs__sep', text: '/' }),
      h('span', { text: tool.name['zh-CN'] }),
    ),
    h(
      'header',
      { class: 'tool-page__head' },
      h(
        'div',
        { class: 'tool-page__title' },
        h('h1', { text: tool.name['zh-CN'] }),
        h('span', { class: 'badge badge--local', text: '本地计算' }),
        tool.offline ? h('span', { class: 'badge badge--accent', text: '可离线' }) : null,
        tool.tags.includes('ctf') ? h('span', { class: 'badge badge--accent', text: 'CTF' }) : null,
      ),
      h('p', { class: 'tool-page__desc', text: tool.description['zh-CN'] }),
      h('div', { class: 'tool-page__badges' }, favoriteButton, copyButton, feedback),
    ),
    panelHost,
    ...(WARNINGS[tool.key] ? [h('div', { class: 'callout callout--warn', text: WARNINGS[tool.key] })] : []),
    h(
      'section',
      { class: 'related' },
      h('div', { class: 'section-head' }, h('h2', { text: '相关工具' })),
      toolGrid(relatedTools(tool)),
    ),
  );

  pushRecent(tool.slug);

  try {
    const module = await loadToolModule(tool.key);
    module.mount(panelHost);
    cleanup = () => module.unmount?.();
  } catch (error) {
    panelHost.append(
      h('p', { class: 'panel__status', attrs: { 'data-kind': 'error' }, text: `工具加载失败：${(error as Error).message}` }),
    );
  }
}
