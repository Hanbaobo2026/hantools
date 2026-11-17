import { mountPanel } from '../../components/ToolPanel';
import { cjkCount, printableRatio, fromHex, toHex } from '../../utils/text';

/**
 * Base 家族编解码（纯函数，全部可单测）：
 *  - base64：标准 alphabet，可选 URL-safe（-_ 替换、去 padding）
 *  - base32：RFC 4648，大写字母表 + '=' 补齐到 8 的倍数
 *  - base16：即十六进制，可选大写
 * 注意：中文必须走 TextEncoder，不能直接用 btoa（只支持 Latin-1）。
 */

export type Variant = 'base64' | 'base64url' | 'base32' | 'base16';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base64Encode(bytes: Uint8Array, urlSafe = false, pad = true): string {
  const alphabet = urlSafe ? B64URL : B64;
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const triplet = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += alphabet[(triplet >> 18) & 63];
    out += alphabet[(triplet >> 12) & 63];
    out += b1 === undefined ? '=' : alphabet[(triplet >> 6) & 63];
    out += b2 === undefined ? '=' : alphabet[triplet & 63];
  }
  return pad ? out : out.replace(/=+$/, '');
}

export function base64Decode(input: string, urlSafe = false): Uint8Array {
  let text = input.replace(/\s+/g, '');
  if (urlSafe) text = text.replace(/-/g, '+').replace(/_/g, '/');
  if (text.length % 4 === 1) throw new Error('Base64 长度不合法（模 4 余 1）');
  while (text.length % 4 !== 0) text += '=';
  const stripped = text.replace(/=+$/, '');
  if (!/^[A-Za-z0-9+/]*$/.test(stripped)) throw new Error('包含非 Base64 字符');

  const bytes: number[] = [];
  for (let i = 0; i < stripped.length; i += 4) {
    const chunk = stripped.slice(i, i + 4);
    const values = Array.from(chunk, (ch) => B64.indexOf(ch));
    const v0 = values[0] ?? 0;
    const v1 = values[1] ?? 0;
    const v2 = values[2] ?? 0;
    const v3 = values[3] ?? 0;
    const triplet = (v0 << 18) | (v1 << 12) | (v2 << 6) | v3;
    bytes.push((triplet >> 16) & 0xff);
    if (chunk.length > 2) bytes.push((triplet >> 8) & 0xff);
    if (chunk.length > 3) bytes.push(triplet & 0xff);
  }
  return new Uint8Array(bytes);
}

export function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = ((buffer << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += B32[(buffer >> bits) & 31];
    }
  }
  if (bits > 0) out += B32[(buffer << (5 - bits)) & 31];
  while (out.length % 8 !== 0) out += '=';
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const text = input.replace(/[\s=]+/g, '').toUpperCase();
  if (text.length === 0) return new Uint8Array(0);
  if (!/^[A-Z2-7]+$/.test(text)) throw new Error('包含非 Base32 字符（仅允许 A-Z 与 2-7）');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of text) {
    buffer = ((buffer << 5) | B32.indexOf(ch)) & 0xffff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

export function encodeText(
  text: string,
  variant: Variant,
  options: { uppercase?: boolean; pad?: boolean } = {},
): string {
  const bytes = new TextEncoder().encode(text);
  switch (variant) {
    case 'base64':
      return base64Encode(bytes, false, options.pad ?? true);
    case 'base64url':
      return base64Encode(bytes, true, options.pad ?? false);
    case 'base32':
      return base32Encode(bytes);
    case 'base16':
      return toHex(bytes, '', options.uppercase ?? false);
    default:
      throw new Error(`未知变体：${String(variant)}`);
  }
}

export function decodeText(input: string, variant: Variant): string {
  let bytes: Uint8Array;
  switch (variant) {
    case 'base64':
      bytes = base64Decode(input, false);
      break;
    case 'base64url':
      bytes = base64Decode(input, true);
      break;
    case 'base32':
      bytes = base32Decode(input);
      break;
    case 'base16':
      bytes = fromHex(input);
      break;
    default:
      throw new Error(`未知变体：${String(variant)}`);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export interface DecodeAttempt {
  variant: Variant;
  text: string;
  score: number;
}

const PLAUSIBLE_B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const PLAUSIBLE_B64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const PLAUSIBLE_B32 = /^[A-Z2-7]+={0,6}$/;
const PLAUSIBLE_HEX = /^(?:[0-9a-fA-F]{2})+$/;

/** 自动识别：对每个可行变体解码并按“像正常文本的程度”评分 */
export function autoDecode(input: string): DecodeAttempt[] {
  const compact = input.replace(/\s+/g, '');
  const attempts: DecodeAttempt[] = [];

  const tryVariant = (variant: Variant, plausible: boolean): void => {
    if (!plausible) return;
    try {
      const text = decodeText(compact, variant);
      if (text.length === 0) return;
      const ratio = printableRatio(text);
      if (ratio <= 0.75) return;
      const score = ratio + Math.min(cjkCount(text), 20) * 0.05;
      attempts.push({ variant, text, score });
    } catch {
      /* 该变体不成立，忽略 */
    }
  };

  tryVariant('base64', compact.length % 4 !== 1 && PLAUSIBLE_B64.test(compact));
  tryVariant('base64url', compact.length % 4 !== 1 && PLAUSIBLE_B64URL.test(compact));

  tryVariant('base32', compact.length % 8 === 0 && PLAUSIBLE_B32.test(compact));
  tryVariant('base16', PLAUSIBLE_HEX.test(compact));

  const seen = new Set<string>();
  return attempts
    .sort((a, b) => b.score - a.score)
    .filter((attempt) => {
      if (seen.has(attempt.text)) return false;
      seen.add(attempt.text);
      return true;
    });
}
export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入文本 / 编码内容',
        kind: 'textarea',
        rows: 6,
        placeholder: '粘贴要编码的文本，或要解码的 Base 字符串（自动忽略空格与换行）',
      },
      {
        id: 'variant',
        label: '编码变体',
        kind: 'select',
        value: 'base64',
        options: [
          { value: 'base64', label: 'Base64（标准，+/）' },
          { value: 'base64url', label: 'Base64 URL-safe（-_，无 padding）' },
          { value: 'base32', label: 'Base32（RFC 4648）' },
          { value: 'base16', label: 'Base16 / Hex' },
        ],
      },
      { id: 'uppercase', label: 'Base16 输出大写', kind: 'checkbox' },
      { id: 'pad', label: 'Base64 保留 = 补齐', kind: 'checkbox', checked: true },
    ],
    actions: [
      {
        label: '编码',
        primary: true,
        run: ({ values, checks }) =>
          encodeText(values.input ?? '', (values.variant ?? 'base64') as Variant, {
            uppercase: Boolean(checks.uppercase),
            pad: Boolean(checks.pad),
          }),
      },
      {
        label: '解码',
        run: ({ values }) => decodeText(values.input ?? '', (values.variant ?? 'base64') as Variant),
      },
      {
        label: '自动识别',
        run: ({ values }) => {
          const attempts = autoDecode(values.input ?? '');
          if (attempts.length === 0) {
            return { output: '', status: { text: '未能识别出有效编码，或解码结果不是可读文本', kind: 'warn' } };
          }
          const lines = attempts.map(
            (item, index) =>
              `${index + 1}. [${item.variant}] 置信度 ${(Math.min(item.score, 1) * 100).toFixed(0)}%\n${item.text}`,
          );
          return { output: lines.join('\n\n'), status: { text: `识别到 ${attempts.length} 个候选，优先看第 1 条`, kind: 'ok' } };
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 8,
    note: '解码按严格 UTF-8 处理：若原始数据是二进制或 GBK，请到「Hex 与 Hexdump 转换」查看字节。',
  });
}

