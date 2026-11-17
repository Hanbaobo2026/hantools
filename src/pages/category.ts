import { setPageMeta } from '../app/meta';
import { categoryOf, toolsInCategory } from '../app/registry';
import { categoryIcon } from '../components/icons';
import { toolGrid } from '../components/toolCard';
import { h } from '../utils/dom';
import { renderNotFound } from './notFound';

export function renderCategory(view: HTMLElement, slug: string): void {
  const category = categoryOf(slug);
  if (!category) {
    renderNotFound(view, `分类 ${slug} 不存在`);
    return;
  }
  const tools = toolsInCategory(category.slug);
  setPageMeta(`${category.name['zh-CN']} · 工具分类`, category.description['zh-CN'], `/category/${category.slug}`);

  view.append(
    h(
      'nav',
      { class: 'breadcrumbs', attrs: { 'aria-label': '面包屑' } },
      h('a', { attrs: { href: '/' }, text: '首页' }),
      h('span', { class: 'breadcrumbs__sep', text: '/' }),
      h('a', { attrs: { href: '/tools' }, text: '全部工具' }),
      h('span', { class: 'breadcrumbs__sep', text: '/' }),
      h('span', { text: category.name['zh-CN'] }),
    ),
    h(
      'h1',
      { class: 'title-with-icon' },
      categoryIcon(category.slug, 26),
      h('span', { text: category.name['zh-CN'] }),
    ),
    h('p', { class: 'hero__lead', text: category.description['zh-CN'] }),
    h('div', { class: 'section-head' }, h('h2', { text: '分类下的工具' }), h('span', { class: 'section-head__note', text: `${tools.length} 个` })),
    toolGrid(tools),
  );
}
