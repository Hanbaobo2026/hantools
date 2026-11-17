import { mountPanel } from '../../components/ToolPanel';
import { escapeHtml } from '../../utils/text';

/**
 * URL / HTML / Unicode 转义工具。
 * 关键点：decodeURIComponent 遇到非法百分号会抛错，这里转成可读的中文错误；
 * HTML 解码同时支持命名实体与数字实体（十进制 / 十六进制）。
 */

export type UrlMode =
  | 'url-encode'
  | 'url-decode'
  | 'form-encode'
  | 'form-decode'
  | 'html-encode'
  | 'html-decode'
  | 'unicode-encode'
  | 'unicode-decode';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  times: '×',
  divide: '÷',
  middot: '·',
  yen: '¥',
  euro: '€',
  deg: '°',
  plusmn: '±',
};

export function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

export function urlDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    throw new Error('URL 解码失败：存在不完整或非法的 % 转义序列');
  }
}

/** application/x-www-form-urlencoded：空格编码为 + */
export function formEncode(text: string): string {
  return encodeURIComponent(text).replace(/%20/g, '+');
}

export function formDecode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, '%20'));
  } catch {
    throw new Error('表单解码失败：存在非法 % 转义序列');
  }
}

/** encodeNonAscii=true 时把非 ASCII 字符也转成数字实体，便于纯 ASCII 环境传输 */
export function htmlEncode(text: string, encodeNonAscii = false): string {
  let out = escapeHtml(text);
  if (encodeNonAscii) {
    out = out.replace(/[^\x00-\x7f]/g, (ch) => `&#x${(ch.codePointAt(0) ?? 0).toString(16)};`);
  }
  return out;
}

export function htmlDecode(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&#(\d+);/g, (_match, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _match;
    })
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/** 转成 \uXXXX（按 UTF-16 码元，代理对自然拆成两个转义） */
export function unicodeEncode(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) {
      out += text[i];
    } else {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
    }
  }
  return out;
}

export function unicodeDecode(text: string): string {
  return text
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_m, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

export function convert(text: string, mode: UrlMode, encodeNonAscii = false): string {
  switch (mode) {
    case 'url-encode':
      return urlEncode(text);
    case 'url-decode':
      return urlDecode(text);
    case 'form-encode':
      return formEncode(text);
    case 'form-decode':
      return formDecode(text);
    case 'html-encode':
      return htmlEncode(text, encodeNonAscii);
    case 'html-decode':
      return htmlDecode(text);
    case 'unicode-encode':
      return unicodeEncode(text);
    case 'unicode-decode':
      return unicodeDecode(text);
    default:
      throw new Error(`未知模式：${String(mode)}`);
  }
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入内容',
        kind: 'textarea',
        rows: 7,
        placeholder: '要转义的文本，或已转义的字符串（如 %E4%BD%A0%E5%A5%BD / &amp;lt; / \\u4f60\\u597d）',
      },
      {
        id: 'mode',
        label: '转换方式',
        kind: 'select',
        value: 'url-encode',
        options: [
          { value: 'url-encode', label: 'URL 编码（encodeURIComponent）' },
          { value: 'url-decode', label: 'URL 解码' },
          { value: 'form-encode', label: '表单编码（空格 → +）' },
          { value: 'form-decode', label: '表单解码' },
          { value: 'html-encode', label: 'HTML 实体编码' },
          { value: 'html-decode', label: 'HTML 实体解码' },
          { value: 'unicode-encode', label: 'Unicode 转义（\\uXXXX）' },
          { value: 'unicode-decode', label: 'Unicode 反转义' },
        ],
      },
      { id: 'nonAscii', label: 'HTML 编码时把非 ASCII 也转成实体', kind: 'checkbox' },
    ],
    actions: [
      {
        label: '转换',
        primary: true,
        run: ({ values, checks }) =>
          convert(values.input ?? '', (values.mode ?? 'url-encode') as UrlMode, Boolean(checks.nonAscii)),
      },
    ],
    outputLabel: '结果',
    outputRows: 8,
    note: '解码严格校验转义序列：出现非法百分号会直接报错，而不是静默替换。',
  });
}
