import { mountPanel } from '../../components/ToolPanel';

/**
 * 零宽字符 / 不可见字符隐写（纯函数）。
 * 常见做法：把 UTF-8 字节逐位映射成 U+200B(0) / U+200C(1)，粘到正常文本里。
 * 本工具覆盖三种映射，并支持自动识别与“不可见字符体检”。
 */

export type ZeroVariant = 'zwsp-zwnj' | 'zwsp-zwj' | 'wj-bom';

const VARIANTS: Record<ZeroVariant, { zero: string; one: string; label: string }> = {
  'zwsp-zwnj': { zero: '\u200b', one: '\u200c', label: 'U+200B / U+200C（最常见）' },
  'zwsp-zwj': { zero: '\u200b', one: '\u200d', label: 'U+200B / U+200D' },
  'wj-bom': { zero: '\u2060', one: '\ufeff', label: 'U+2060 / U+FEFF' },
};

const ZERO_SET = new Set(['\u200b', '\u2060']);
const ONE_SET = new Set(['\u200c', '\u200d', '\ufeff']);

const NAMES: Record<string, string> = {
  '\u200b': 'ZWSP 零宽空格',
  '\u200c': 'ZWNJ 零宽不连字',
  '\u200d': 'ZWJ 零宽连字',
  '\u2060': 'Word Joiner',
  '\ufeff': 'BOM / 零宽不换行空格',
};

export function encodeZeroWidth(text: string, variant: ZeroVariant = 'zwsp-zwnj'): string {
  if (text === '') throw new Error('输入为空');
  const { zero, one } = VARIANTS[variant];
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (const byte of bytes) {
    for (let bit = 7; bit >= 0; bit -= 1) {
      out += (byte >> bit) & 1 ? one : zero;
    }
  }
  return out;
}

function variantOf(text: string): ZeroVariant | 'mixed' {
  const hasZwnj = text.includes('\u200c');
  const hasZwj = text.includes('\u200d');
  const hasBom = text.includes('\ufeff');
  const hasWj = text.includes('\u2060');
  if (hasZwnj && !hasZwj) return 'zwsp-zwnj';
  if (hasZwj && !hasZwnj) return 'zwsp-zwj';
  if (hasBom || hasWj) return 'wj-bom';
  return 'mixed';
}

export interface ZeroDecodeResult {
  text: string;
  bits: number;
  variant: ZeroVariant | 'mixed';
}

export function decodeZeroWidth(input: string): ZeroDecodeResult {
  const chars = Array.from(input).filter((ch) => ZERO_SET.has(ch) || ONE_SET.has(ch));
  if (chars.length === 0) throw new Error('没有找到零宽字符（U+200B/200C/200D/2060/FEFF）');
  if (chars.length % 8 !== 0) {
    throw new Error(`零宽字符数量为 ${chars.length}，不是 8 的倍数，可能混入了普通零宽字符或数据被截断`);
  }

  const bytes = new Uint8Array(chars.length / 8);
  for (let i = 0; i < bytes.length; i += 1) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) {
      const ch = chars[i * 8 + bit] as string;
      value = (value << 1) | (ONE_SET.has(ch) ? 1 : 0);
    }
    bytes[i] = value;
  }

  try {
    return {
      text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      bits: chars.length,
      variant: variantOf(input),
    };
  } catch {
    throw new Error('零宽字符解出的字节不是合法 UTF-8：可能是不同映射（U+200B/200C 与 2060/FEFF），或数据不完整');
  }
}

export interface InvisibleStat {
  char: string;
  name: string;
  count: number;
}

export function scanInvisible(text: string): InvisibleStat[] {
  const counts = new Map<string, number>();
  for (const ch of text) {
    if (ZERO_SET.has(ch) || ONE_SET.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([char, count]) => ({ char, name: NAMES[char] ?? '不可见字符', count }))
    .sort((a, b) => b.count - a.count);
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入',
        kind: 'textarea',
        rows: 6,
        placeholder: '编码时填正常文本；解码/统计时粘贴疑似被插入零宽字符的文本',
      },
      {
        id: 'variant',
        label: '映射方式',
        kind: 'select',
        value: 'zwsp-zwnj',
        options: [
          { value: 'zwsp-zwnj', label: VARIANTS['zwsp-zwnj'].label },
          { value: 'zwsp-zwj', label: VARIANTS['zwsp-zwj'].label },
          { value: 'wj-bom', label: VARIANTS['wj-bom'].label },
        ],
      },
    ],
    actions: [
      {
        label: '编码为零宽字符',
        primary: true,
        run: ({ values }) => {
          const output = encodeZeroWidth(values.input ?? '', (values.variant ?? 'zwsp-zwnj') as ZeroVariant);
          return {
            output,
            status: {
              text: `已生成 ${output.length} 个零宽字符（原文 ${(values.input ?? '').length} 字符）；复制到载体文本里即可`,
              kind: 'ok',
            },
          };
        },
      },
      {
        label: '解码',
        run: ({ values }) => {
          const result = decodeZeroWidth(values.input ?? '');
          return {
            output: result.text,
            status: {
              text: `解出 ${result.bits} bit / ${result.bits / 8} 字节 · 映射：${result.variant}`,
              kind: 'ok',
            },
          };
        },
      },
      {
        label: '统计不可见字符',
        run: ({ values }) => {
          const input = values.input ?? '';
          const stats = scanInvisible(input);
          if (stats.length === 0) {
            return { output: '', status: { text: '没有发现零宽字符', kind: 'warn' } };
          }
          const total = stats.reduce((sum, item) => sum + item.count, 0);
          const lines = stats.map((item) => `${item.name}：${item.count} 个（U+${item.char.codePointAt(0)?.toString(16).toUpperCase()}）`);
          return {
            output: lines.join('\n'),
            status: { text: `共 ${total} 个不可见字符`, kind: 'ok' },
          };
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 8,
    note: '编码结果本身不可见：请复制输出，粘贴到任意一句话中间再发给目标。解码会自动识别三种常见映射。',
  });
}
