/**
 * 文本 / 字节互转工具。
 * 关键点：
 *  - btoa/atob 只支持 Latin-1，中文必须经 TextEncoder/TextDecoder；
 *  - 解码统一提供 fatal 选项，用于“严格判定能否按该编码解释”，避免静默替换成 U+FFFD；
 *  - hex 解析容忍空格、逗号、冒号、连字符与 0x 前缀，便于从各种 CTF 题目里直接粘贴。
 */

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function utf8Decode(bytes: Uint8Array, fatal = false): string {
  return new TextDecoder('utf-8', { fatal }).decode(bytes);
}

/** 尝试以指定编码解码，失败返回 null（不抛异常，供“探测”类逻辑使用） */
export function tryDecode(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** 按码位截断到 0-255，用于还原“UTF-8 字节被当成 Latin-1 显示”的乱码 */
export function latin1Encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code > 0xff) {
      // 超出 Latin-1 的字符无法无损映射，交由调用方判定失败
      return new Uint8Array(0);
    }
    out[i] = code;
  }
  return out;
}

export function latin1Decode(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

export function toHex(bytes: Uint8Array, separator = ' ', uppercase = false): string {
  const parts: string[] = [];
  for (const byte of bytes) {
    const hex = byte.toString(16).padStart(2, '0');
    parts.push(uppercase ? hex.toUpperCase() : hex);
  }
  return parts.join(separator);
}

const HEX_JUNK = /[\s,:_-]+/g;
const HEX_PREFIX = /0x/gi;

export function fromHex(input: string): Uint8Array {
  const cleaned = input.replace(HEX_PREFIX, '').replace(HEX_JUNK, '');
  if (cleaned.length === 0) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
    throw new Error('包含非十六进制字符');
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error('十六进制字符数为奇数，无法组成完整字节');
  }
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function toBinary(bytes: Uint8Array, separator = ' '): string {
  return Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join(separator);
}

export function fromBinary(input: string): Uint8Array {
  const cleaned = input.replace(/[^01]/g, '');
  if (cleaned.length === 0) return new Uint8Array(0);
  if (cleaned.length % 8 !== 0) throw new Error('二进制位数不是 8 的倍数');
  const out = new Uint8Array(cleaned.length / 8);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(cleaned.slice(i * 8, i * 8 + 8), 2);
  }
  return out;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g;

export function cjkCount(text: string): number {
  return (text.match(CJK) ?? []).length;
}

/** 可打印字符占比（用于判断解码结果是否“像正常文本”） */
export function printableRatio(text: string): number {
  if (text.length === 0) return 0;
  let printable = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a || code === 0x0d) {
      printable += 1;
    } else if (code >= 0x20 && code !== 0x7f) {
      printable += 1;
    }
  }
  return printable / text.length;
}

export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KiB`;
  return `${(size / 1024 / 1024).toFixed(2)} MiB`;
}

/** 让出主线程，配合 AbortSignal 实现可取消的长任务 */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
