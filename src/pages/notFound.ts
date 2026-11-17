import { setPageMeta } from '../app/meta';
import { featuredTools } from '../app/registry';
import { createSearchBox } from '../components/searchBox';
import { toolGrid } from '../components/toolCard';
import { h } from '../utils/dom';

export function renderNotFound(view: HTMLElement, detail?: string): void {
  setPageMeta('页面不存在');
  const search = createSearchBox({ placeholder: '找不到页面？直接搜索工具…', autofocus: true });
  view.append(
    h('div', { class: 'empty' }, h('h1', { text: '404 · 这里没有工具' }), h('p', { text: detail ?? '链接可能已失效，或者工具 slug 拼写有误。' })),
    h('div', { class: 'section-head' }, h('h2', { text: '搜索工具' })),
    search.element,
    h('div', { class: 'section-head' }, h('h2', { text: '常用工具' })),
    toolGrid(featuredTools().slice(0, 6)),
  );
}
