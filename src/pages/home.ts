import { setPageMeta } from '../app/meta';
import { catalog, featuredTools, toolsInCategory } from '../app/registry';
import { icon } from '../components/icons';
import { categoryCard, toolGrid } from '../components/toolCard';
import { createSearchBox } from '../components/searchBox';
import { getFavorites, getRecents } from '../utils/storage';
import { h } from '../utils/dom';
import type { ToolMeta } from '../types';

/**
 * 首页：价值主张 + 搜索 + 分类 + 推荐工具 + 全部工具。
 * 收藏 / 最近使用从 localStorage 读取，读取失败时静默降级为空。
 */

const PRINCIPLES: Array<{ icon: 'crypto' | 'download' | 'bolt'; title: string; text: string }> = [
  { icon: 'crypto', title: '纯前端处理', text: '数据留在本机。配置严格 CSP 策略，页面本身不发任何外网请求。' },
  { icon: 'download', title: '支持完全离线', text: '支持 PWA 离线运行，也能下载单文件 HTML 丢到无外网的内网靶场环境打开。' },
  { icon: 'bolt', title: '针对题目场景设计', text: '整合 Misc 和 Crypto 常见套路，覆盖多层套娃解码、快速爆破和典型算法验证。' },
];

function quickChips(tools: ToolMeta[]): HTMLElement {
  return h(
    'div',
    { class: 'hero__chips' },
    h('span', { class: 'badge', text: '常用：' }),
    ...tools.map((tool) => h('a', { class: 'chip', attrs: { href: `/tools/${tool.slug}` }, text: tool.name['zh-CN'] })),
  );
}

function pickByKeys(keys: string[]): ToolMeta[] {
  return keys
    .map((key) => catalog.byKey.get(key))
    .filter((tool): tool is ToolMeta => Boolean(tool));
}

export function renderHome(view: HTMLElement): void {
  setPageMeta(
    'HanTools · CTF 与开发在线工具集',
    '开箱即用的 CTF 与 Web 研发工具箱：编码识别、哈希计算、常用加解密与文本处理，纯前端离线运算，数据不会上传后端。',
    '/',
  );

  const search = createSearchBox({ autofocus: false });

  const hero = h(
    'section',
    { class: 'hero' },
    h('h1', { text: '开箱即用的 CTF 与 Web 研发工具箱' }),
    h('p', {
      class: 'hero__lead',
      text: '包含编码识别、哈希计算、常用加解密与文本处理。纯前端离线运算，数据不会上传后端。',
    }),
    search.element,
    quickChips(pickByKeys(['base64', 'magic', 'hash', 'xor', 'jwt', 'rsa'])),
  );

  const principles = h(
    'section',
    { class: 'principles' },
    ...PRINCIPLES.map((item) =>
      h(
        'div',
        { class: 'principle' },
        h('div', { class: 'principle__title' }, icon(item.icon, 18), h('span', { text: item.title })),
        h('p', { class: 'principle__text', text: item.text }),
      ),
    ),
  );

  const favorites = getFavorites()
    .map((slug) => catalog.bySlug.get(slug))
    .filter((tool): tool is ToolMeta => Boolean(tool));
  const recents = getRecents()
    .map((slug) => catalog.bySlug.get(slug))
    .filter((tool): tool is ToolMeta => Boolean(tool));

  const favoriteSection =
    favorites.length > 0
      ? [
          h(
            'div',
            { class: 'section-head' },
            h('h2', { text: '我的收藏' }),
            h('span', { class: 'section-head__note', text: '保存在本机浏览器' }),
          ),
          toolGrid(favorites),
        ]
      : [];

  const recentSection =
    recents.length > 0
      ? [
          h(
            'div',
            { class: 'section-head' },
            h('h2', { text: '最近使用' }),
            h('span', { class: 'section-head__note', text: '仅记录工具名称，不记录输入内容' }),
          ),
          toolGrid(recents.slice(0, 4)),
        ]
      : [];

  const categories = h(
    'div',
    { class: 'grid' },
    ...catalog.categories.map((category) => categoryCard(category, toolsInCategory(category.slug).length)),
  );

  const featured = toolGrid(featuredTools());

  const allByCategory = catalog.categories.map((category) => {
    const tools = toolsInCategory(category.slug);
    return h(
      'section',
      { attrs: { id: `cat-${category.slug}` } },
      h(
        'div',
        { class: 'section-head' },
        h('h2', { text: `${category.icon} ${category.name['zh-CN']}` }),
        h('a', { class: 'section-head__note', attrs: { href: `/category/${category.slug}` }, text: '查看分类 →' }),
      ),
      toolGrid(tools),
    );
  });

  view.append(
    hero,
    principles,
    ...recentSection,
    ...favoriteSection,
    h(
      'div',
      { class: 'section-head' },
      h('h2', { text: '按分类浏览' }),
      h('a', { class: 'section-head__note', attrs: { href: '/tools' }, text: '全部工具 →' }),
    ),
    categories,
    h('div', { class: 'section-head' }, h('h2', { text: '推荐工具' }), h('span', { class: 'section-head__note', text: '最常用的一批' })),
    featured,
    ...allByCategory,
  );
}
