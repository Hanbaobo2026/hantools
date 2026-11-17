import { setPageMeta } from '../app/meta';
import { replaceUrl } from '../app/navigation';
import { catalog, toolsInCategory } from '../app/registry';
import { searchTools } from '../app/search';
import { createSearchBox } from '../components/searchBox';
import { categoryFilters, toolGrid } from '../components/toolCard';
import { h } from '../utils/dom';
import type { ToolMeta } from '../types';

/**
 * 全部工具页：搜索 + 分类筛选（纯前端，状态同步到 URL query）。
 */

export function renderCatalog(view: HTMLElement, query: URLSearchParams): void {
  setPageMeta('全部工具', `HanTools 目前提供 ${catalog.tools.length} 个本地工具，覆盖编码、密码学、Web 与开发辅助。`, '/tools');

  let activeCategory = query.get('category') ?? '';
  let keyword = query.get('q') ?? '';

  const countLabel = h('span', { class: 'section-head__note' });
  const filtersHost = h('div');
  const gridHost = h('div');

  const search = createSearchBox({ placeholder: '在工具目录中搜索…' });
  if (keyword) search.input.value = keyword;

  function currentTools(): ToolMeta[] {
    const base = activeCategory ? toolsInCategory(activeCategory) : catalog.tools;
    return keyword.trim() ? searchTools(base, keyword, 200) : base;
  }

  function syncUrl(): void {
    const params = new URLSearchParams();
    if (activeCategory) params.set('category', activeCategory);
    if (keyword.trim()) params.set('q', keyword.trim());
    const suffix = params.toString();
    replaceUrl(`/tools${suffix ? `?${suffix}` : ''}`);
  }

  function refreshList(): void {
    const tools = currentTools();
    gridHost.replaceChildren(toolGrid(tools));
    countLabel.textContent = `${tools.length} 个工具`;
    syncUrl();
  }

  function renderFilters(): void {
    filtersHost.replaceChildren(
      categoryFilters(catalog.categories, activeCategory, (slug) => {
        activeCategory = slug;
        renderFilters();
        refreshList();
      }),
    );
  }

  search.input.addEventListener('input', () => {
    keyword = search.input.value;
    refreshList();
  });

  view.append(
    h('h1', { text: '全部工具' }),
    h('p', { class: 'hero__lead', text: '按关键词或分类筛选，工具全部在浏览器内运行。' }),
    search.element,
    filtersHost,
    h('div', { class: 'section-head' }, h('h2', { text: '工具列表' }), countLabel),
    gridHost,
  );

  renderFilters();
  refreshList();
}
