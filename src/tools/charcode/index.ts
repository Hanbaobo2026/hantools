import { mountPanel } from '../../components/ToolPanel';

/**
 * ASCII / 字符码转换（纯函数）。
 * 文本 → 十进制 / 十六进制 / 二进制 / 八进制码点；反向支持自动识别。
 * 使用 codePointAt，因此中文、emoji 也能正确转换（不是按 UTF-16 码元拆开）。
 */

export type CodeFormat = 'dec' | 'hex' | 'bin' | 'oct';
export type Separator = 'space' | 'comma' | 'newline' | 'none';

const SEPARATORS: Record<Separator, string> = {
  space: ' ',
  comma: ', ',
  newline: '\n',
  none: '',
};

export function tokenizeCodes(input: string): string[] {
  return input
    .trim()
    .split(/[\s,;|]+/)
    .filter(Boolean);
}

export function detectFormat(input: string): CodeFormat {
  const tokens = tokenizeCodes(input);
  if (tokens.length === 0) throw new Error('没有可解析的编码');
  if (tokens.every((token) => /^0x[0-9a-f]+$/i.test(token))) return 'hex';
  if (tokens.every((token) => /^[01]{8}$/.test(token))) return 'bin';
  if (tokens.every((token) => /^[0-7]{1,3}$/.test(token)) && tokens.some((token) => token.length === 3 && token.startsWith('0'))) {
    return 'oct';
  }
  return 'dec';
}

function formatCode(code: number, format: CodeFormat, pad: boolean): string {
  switch (format) {
    case 'hex':
      return code.toString(16).padStart(pad ? 2 : 0, '0');
    case 'bin':
      return code.toString(2).padStart(pad ? 8 : 0, '0');
    case 'oct':
      return code.toString(8);
    default:
      return code.toString(10);
  }
}

export function textToCodes(text: string, format: CodeFormat, separator: Separator = 'space', pad = false): string {
  if (text === '') throw new Error('输入为空');
  const parts: string[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === undefined) continue;
    parts.push(formatCode(code, format, pad));
  }
  return parts.join(SEPARATORS[separator]);
}

function parseToken(token: string, format: CodeFormat): number {
  if (format === 'hex') {
    const hex = token.replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(hex)) throw new Error(`不是合法的十六进制码：${token}`);
    return Number.parseInt(hex, 16);
  }
  if (format === 'bin') {
    if (!/^[01]+$/.test(token)) throw new Error(`不是合法的二进制码：${token}`);
    return Number.parseInt(token, 2);
  }
  if (format === 'oct') {
    if (!/^[0-7]+$/.test(token)) throw new Error(`不是合法的八进制码：${token}`);
    return Number.parseInt(token, 8);
  }
  if (!/^\d+$/.test(token)) throw new Error(`不是合法的十进制码：${token}`);
  return Number.parseInt(token, 10);
}

export function codesToText(input: string, format: CodeFormat | 'auto' = 'auto'): string {
  const tokens = tokenizeCodes(input);
  if (tokens.length === 0) throw new Error('没有可解析的编码');
  const resolved = format === 'auto' ? detectFormat(input) : format;
  let out = '';
  for (const token of tokens) {
    const code = parseToken(token, resolved);
    if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
      throw new Error(`码点超出范围：${token}`);
    }
    out += String.fromCodePoint(code);
  }
  return out;
}

/** 可打印 ASCII 表（32–126）+ 常用控制字符 */
export function asciiTable(): string {
  const lines = ['DEC  HEX  CHAR', '---  ---  ----'];
  const controls: Array<[number, string]> = [
    [0, 'NUL'], [7, 'BEL'], [8, 'BS'], [9, 'TAB'], [10, 'LF'], [13, 'CR'], [27, 'ESC'], [32, 'SPACE'],
  ];
  for (const [code, name] of controls) {
    lines.push(`${String(code).padStart(3, ' ')}  ${code.toString(16).padStart(2, '0').toUpperCase()}   ${name}`);
  }
  for (let code = 33; code <= 126; code += 1) {
    lines.push(`${String(code).padStart(3, ' ')}  ${code.toString(16).padStart(2, '0').toUpperCase()}   ${String.fromCharCode(code)}`);
  }
  return lines.join('\n');
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入',
        kind: 'textarea',
        rows: 6,
        placeholder: '文本（如 Hello）或码值（如 72 101 108 108 111 / 0x48 0x65）',
      },
      {
        id: 'format',
        label: '码制',
        kind: 'select',
        value: 'dec',
        options: [
          { value: 'dec', label: '十进制（72 101）' },
          { value: 'hex', label: '十六进制（48 65）' },
          { value: 'bin', label: '二进制（01001000）' },
          { value: 'oct', label: '八进制（110 145）' },
        ],
      },
      {
        id: 'separator',
        label: '分隔符（编码时）',
        kind: 'select',
        value: 'space',
        options: [
          { value: 'space', label: '空格' },
          { value: 'comma', label: '逗号 + 空格' },
          { value: 'newline', label: '换行' },
          { value: 'none', label: '无（连续输出）' },
        ],
      },
      { id: 'pad', label: '补齐位数（hex 2 位 / bin 8 位）', kind: 'checkbox' },
    ],
    actions: [
      {
        label: '文本 → 码值',
        primary: true,
        run: ({ values, checks }) =>
          textToCodes(
            values.input ?? '',
            (values.format ?? 'dec') as CodeFormat,
            (values.separator ?? 'space') as Separator,
            Boolean(checks.pad),
          ),
      },
      {
        label: '码值 → 文本',
        run: ({ values }) => {
          const format = (values.format ?? 'dec') as CodeFormat;
          const text = codesToText(values.input ?? '', format);
          return { output: text, status: { text: `按 ${format} 解析`, kind: 'ok' } };
        },
      },
      {
        label: '自动识别并解码',
        run: ({ values }) => {
          const format = detectFormat(values.input ?? '');
          const text = codesToText(values.input ?? '', format);
          return { output: text, status: { text: `识别为 ${format}`, kind: 'ok' } };
        },
      },
      {
        label: 'ASCII 表',
        run: () => asciiTable(),
      },
    ],
    outputLabel: '结果',
    outputRows: 10,
    note: '按 Unicode 码点转换，中文与 emoji 不会被拆成两个码元；解码时十六进制可带 0x 前缀。',
  });
}
