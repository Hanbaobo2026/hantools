import { mountPanel } from '../../components/ToolPanel';

/**
 * JSON 工具（纯函数）：
 *  - pretty：缩进格式化
 *  - minify：压缩
 *  - sort：递归按键名排序后格式化
 *  - validate：只校验并回报行列错误
 * 解析失败时把 V8 的 "position N" 换算成行/列并给出插入符，便于定位。
 */

export type JsonMode = 'pretty' | 'minify' | 'sort' | 'validate';

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = sortKeysDeep(source[key]);
    return out;
  }
  return value;
}

export function locateJsonError(input: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const posMatch = /position\s+(\d+)/i.exec(message);
  if (!posMatch) return message;
  const pos = Number.parseInt(posMatch[1] ?? '0', 10);
  const before = input.slice(0, pos);
  const line = before.split('\n').length;
  const column = pos - before.lastIndexOf('\n');
  const lineText = input.split('\n')[line - 1] ?? '';
  const caret = `${' '.repeat(Math.max(column - 1, 0))}^`;
  return `${message}\n第 ${line} 行，第 ${column} 列\n${lineText}\n${caret}`;
}

export function transformJson(input: string, mode: JsonMode, indent = 2): string {
  const trimmed = input.trim();
  if (trimmed === '') throw new Error('输入为空，请粘贴 JSON 文本');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(locateJsonError(trimmed, error));
  }
  if (mode === 'validate') {
    const size = new TextEncoder().encode(trimmed).length;
    const type = Array.isArray(parsed) ? '数组' : parsed === null ? 'null' : typeof parsed;
    return `JSON 合法 ✅\n顶层类型：${type}\n原始大小：${size} 字节`;
  }
  if (mode === 'minify') return JSON.stringify(parsed);
  const safeIndent = Math.min(Math.max(Number.isFinite(indent) ? indent : 2, 0), 8);
  if (mode === 'sort') return JSON.stringify(sortKeysDeep(parsed), null, safeIndent);
  return JSON.stringify(parsed, null, safeIndent);
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: 'JSON 文本',
        kind: 'textarea',
        rows: 10,
        placeholder: '粘贴 JSON，支持格式化 / 压缩 / 键排序 / 校验',
      },
      {
        id: 'mode',
        label: '处理方式',
        kind: 'select',
        value: 'pretty',
        options: [
          { value: 'pretty', label: '格式化（缩进）' },
          { value: 'minify', label: '压缩（去掉空白）' },
          { value: 'sort', label: '按键名递归排序后格式化' },
          { value: 'validate', label: '仅校验并统计' },
        ],
      },
      { id: 'indent', label: '缩进空格数（0–8）', kind: 'number', value: '2' },
    ],
    actions: [
      {
        label: '执行',
        primary: true,
        run: ({ values }) =>
          transformJson(values.input ?? '', (values.mode ?? 'pretty') as JsonMode, Number.parseInt(values.indent ?? '2', 10)),
      },
    ],
    outputLabel: '结果',
    outputRows: 12,
    note: '解析使用浏览器原生 JSON.parse：重复键会保留最后一个；不支持注释与尾随逗号。',
  });
}
