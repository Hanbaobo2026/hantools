/** 轻量 DOM 构建与事件工具。刻意不引入框架：首屏体积可控，且工具面板逻辑更直观。 */

export type EventHandlers = {
  [K in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[K]) => void;
};

export interface NodeProps {
  class?: string;
  text?: string;
  /** 仅用于可信内容（本模块内部常量），用户输入一律走 text */
  html?: string;
  attrs?: Record<string, string | number | boolean | undefined | null>;
  dataset?: Record<string, string>;
  style?: string;
  on?: EventHandlers;
}

type Child = Node | string | number | null | undefined | false;

function setAttrs(el: Element, attrs: NodeProps['attrs']): void {
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
}

function appendChildren(el: Element, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: NodeProps | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    if (props.class) el.className = props.class;
    if (props.text !== undefined) el.textContent = props.text;
    if (props.html !== undefined) el.innerHTML = props.html;
    if (props.style) el.setAttribute('style', props.style);
    setAttrs(el, props.attrs);
    if (props.dataset) {
      for (const [key, value] of Object.entries(props.dataset)) el.dataset[key] = value;
    }
    if (props.on) {
      for (const [type, handler] of Object.entries(props.on)) {
        if (handler) el.addEventListener(type, handler as EventListener);
      }
    }
  }
  appendChildren(el, children);
  return el;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function on<K extends keyof HTMLElementEventMap>(
  target: EventTarget,
  type: K,
  handler: (ev: HTMLElementEventMap[K]) => void,
  options?: AddEventListenerOptions,
): () => void {
  target.addEventListener(type, handler as EventListener, options);
  return () => target.removeEventListener(type, handler as EventListener, options);
}

/** 富文本片段：把高亮等需要 DOM 结构的内容转成节点数组 */
export function fragment(parts: Array<string | Node>): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const part of parts) {
    frag.append(typeof part === 'string' ? document.createTextNode(part) : part);
  }
  return frag;
}
