import { catalog } from '../app/registry';
import { searchTools } from '../app/search';
import { toolPath } from '../app/registry';
import { navigateTo } from '../app/navigation';
import type { ToolMeta } from '../types';
import { h } from '../utils/dom';

/**
 * 搜索框：输入即搜，结果用下拉列出；支持 ↑/↓ 选择 + Enter 跳转，Esc 关闭。
 * 搜索逻辑是纯函数（src/app/search.ts），这里只负责交互与可访问性。
 */

export interface SearchBoxOptions {
  placeholder?: string;
  autofocus?: boolean;
  onSelect?: (tool: ToolMeta) => void;
}

export interface SearchBoxHandle {
  element: HTMLElement;
  input: HTMLInputElement;
}

export function createSearchBox(options: SearchBoxOptions = {}): SearchBoxHandle {
  let activeIndex = -1;
  let results: ToolMeta[] = [];

  const input = h('input', {
    class: 'search__input',
    attrs: {
      type: 'search',
      placeholder: options.placeholder ?? '搜索工具：base64、哈希、XOR、JWT、正则…',
      'aria-label': '搜索工具',
      autocomplete: 'off',
      spellcheck: 'false',
    },
  });

  const list = h('div', { class: 'search__results', attrs: { hidden: true, role: 'listbox' } });
  const hint = h('p', { class: 'search__hint', text: '支持中文与英文关键词；按 / 可快速聚焦' });

  function close(): void {
    list.hidden = true;
    activeIndex = -1;
  }

  function choose(tool: ToolMeta): void {
    if (options.onSelect) options.onSelect(tool);
    else navigateTo(toolPath(tool));
    close();
  }

  function renderList(): void {
    list.replaceChildren();
    if (results.length === 0) {
      list.append(h('div', { class: 'search__empty', text: '没有匹配的工具' }));
    } else {
      results.forEach((tool, index) => {
        list.append(
          h(
            'a',
            {
              class: 'search__item',
              attrs: {
                href: toolPath(tool),
                role: 'option',
                'aria-selected': String(index === activeIndex),
              },
              on: {
                click: (event) => {
                  event.preventDefault();
                  choose(tool);
                },
              },
            },
            h('span', { class: 'search__item-title', text: tool.name['zh-CN'] }),
            h('span', { class: 'search__item-desc', text: tool.description['zh-CN'] }),
          ),
        );
      });
    }
    list.hidden = false;
  }

  input.addEventListener('input', () => {
    results = searchTools(catalog.tools, input.value, 8);
    activeIndex = -1;
    if (input.value.trim() === '') {
      close();
      return;
    }
    renderList();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
      input.blur();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length === 0) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + delta + results.length) % results.length;
      renderList();
      return;
    }
    if (event.key === 'Enter') {
      const target = results[activeIndex] ?? results[0];
      if (target) {
        event.preventDefault();
        choose(target);
      }
    }
  });

  // 用 blur 关闭下拉，避免在 document 上挂全局监听（页面反复导航时不会累积）
  input.addEventListener('blur', () => {
    window.setTimeout(close, 150);
  });

  if (options.autofocus) queueMicrotask(() => input.focus());

  const element = h('div', { class: 'search' }, input, list, hint);
  return { element, input };
}
