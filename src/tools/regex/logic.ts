import { escapeHtml } from '../../utils/text';

/**
 * 正则纯逻辑（无 DOM）：主线程与 Worker 共用同一份实现。
 * 安全策略：强制补 'g' 逐条枚举、零长度匹配手动推进 lastIndex、
 * 并对正则长度 / 文本长度 / 匹配条数设上限。
 */

export interface RegexMatch {
  value: string;
  index: number;
  groups: Array<string | undefined>;
}

export interface RegexResult {
  matches: RegexMatch[];
  truncated: boolean;
}

export const MAX_MATCHES = 500;
export const MAX_PATTERN = 500;
export const MAX_TEXT = 200_000;

export function runRegex(pattern: string, flags: string, text: string): RegexResult {
  if (pattern.length > MAX_PATTERN) throw new Error(`正则长度超过 ${MAX_PATTERN} 字符上限`);
  if (text.length > MAX_TEXT) throw new Error(`输入文本超过 ${MAX_TEXT} 字符上限，请分段测试`);
  const normalizedFlags = Array.from(new Set(flags.replace(/[^dgimsuy]/g, '').split(''))).join('');
  const effectiveFlags = normalizedFlags.includes('g') ? normalizedFlags : `${normalizedFlags}g`;

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, effectiveFlags);
  } catch (error) {
    throw new Error(`正则语法错误：${(error as Error).message}`);
  }

  const matches: RegexMatch[] = [];
  let truncated = false;
  let guard = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    matches.push({ value: match[0], index: match.index, groups: match.slice(1) });
    if (match[0].length === 0) regex.lastIndex += 1;
    guard += 1;
    if (matches.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
    if (guard > MAX_MATCHES * 4) break;
  }
  return { matches, truncated };
}

export function replaceRegex(pattern: string, flags: string, text: string, replacement: string): string {
  const regex = new RegExp(pattern, flags.replace(/[^dgimsuy]/g, ''));
  return text.replace(regex, replacement);
}

/** 生成安全的高亮 HTML：先转义原文，再用 <mark> 包裹匹配片段 */
export function highlightHtml(text: string, matches: RegexMatch[]): string {
  if (matches.length === 0) return escapeHtml(text);
  const sorted = [...matches].sort((a, b) => a.index - b.index);
  let cursor = 0;
  let html = '';
  for (const item of sorted) {
    if (item.index < cursor) continue;
    html += escapeHtml(text.slice(cursor, item.index));
    html += `<mark>${escapeHtml(item.value)}</mark>`;
    cursor = item.index + item.value.length;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}
