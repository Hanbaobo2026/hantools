import { toolPath } from '../app/registry';
import type { CategoryMeta, ToolMeta } from '../types';
import { h } from '../utils/dom';
import { categoryIcon } from './icons';

/** 工具卡片与网格：首页、目录页、分类页、相关工具共用（深空蓝玻璃卡） */

function cardArrow(): HTMLElement {
  return h('span', { class: 'card__arrow', attrs: { 'aria-hidden': 'true' }, text: '→' });
}

export function toolCard(tool: ToolMeta): HTMLElement {
  const badges: HTMLElement[] = [
    h('span', { class: 'badge badge--local', text: '本地' }),
    ...(tool.tags.includes('ctf') ? [h('span', { class: 'badge badge--accent', text: 'CTF' })] : []),
  ];
  return h(
    'a',
    { class: 'card', attrs: { href: toolPath(tool) } },
    cardArrow(),
    h(
      'div',
      { class: 'card__top' },
      h('span', { class: 'card__icon', attrs: { 'aria-hidden': 'true' } }, categoryIcon(tool.category)),
      h('span', { class: 'card__meta' }, ...badges),
    ),
    h('span', { class: 'card__title', text: tool.name['zh-CN'] }),
    h('p', { class: 'card__desc', text: tool.description['zh-CN'] }),
    h('div', { class: 'card__foot', text: tool.keywords.slice(0, 3).join(' · ') }),
  );
}

export function toolGrid(tools: ToolMeta[]): HTMLElement {
  if (tools.length === 0) {
    return h('div', { class: 'empty', text: '没有匹配的工具，试试更短的关键词（如 base64 / 哈希 / 正则）。' });
  }
  return h('div', { class: 'grid' }, ...tools.map(toolCard));
}

export function categoryCard(category: CategoryMeta, count: number): HTMLElement {
  return h(
    'a',
    { class: 'card', attrs: { href: `/category/${category.slug}` } },
    cardArrow(),
    h(
      'div',
      { class: 'card__top' },
      h('span', { class: 'card__icon', attrs: { 'aria-hidden': 'true' } }, categoryIcon(category.slug)),
      h('span', { class: 'badge', text: `${count} 个工具` }),
    ),
    h('span', { class: 'card__title', text: category.name['zh-CN'] }),
    h('p', { class: 'card__desc', text: category.description['zh-CN'] }),
    h('div', { class: 'card__foot', text: category.slug }),
  );
}

export function categoryFilters(
  categories: CategoryMeta[],
  active: string,
  onSelect: (slug: string) => void,
): HTMLElement {
  const buttons = [
    { slug: '', label: '全部' },
    ...categories.map((category) => ({ slug: category.slug, label: category.name['zh-CN'] })),
  ];
  return h(
    'div',
    { class: 'filters', attrs: { role: 'group', 'aria-label': '按分类筛选' } },
    ...buttons.map((item) =>
      h('button', {
        class: 'filters__btn',
        attrs: { type: 'button', 'aria-pressed': String(item.slug === active) },
        text: item.label,
        on: { click: () => onSelect(item.slug) },
      }),
    ),
  );
}
