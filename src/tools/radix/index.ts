import { mountPanel } from '../../components/ToolPanel';

/**
 * 进制转换与位运算（纯函数）。
 * 使用 BigInt 支持任意长度整数（CTF 常见大数），并容忍 0x/0b/0o 前缀、下划线与负号。
 */

export type Radix = 2 | 8 | 10 | 16;
export type BitOp = 'and' | 'or' | 'xor' | 'not' | 'shl' | 'shr';

const BASE_PREFIX: Array<[RegExp, Radix]> = [
  [/^0[xX]/, 16],
  [/^0[bB]/, 2],
  [/^0[oO]/, 8],
];

export function detectBase(input: string): Radix {
  const trimmed = input.trim();
  for (const [pattern, base] of BASE_PREFIX) {
    if (pattern.test(trimmed)) return base;
  }
  return 10;
}

export function parseBigInt(input: string, base: Radix | 'auto' = 'auto'): bigint {
  let text = input.trim().replace(/_/g, '');
  if (text === '') throw new Error('输入为空');
  let negative = false;
  if (text.startsWith('-')) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith('+')) {
    text = text.slice(1);
  }
  const resolved = base === 'auto' ? detectBase(text) : base;
  for (const [pattern] of BASE_PREFIX) text = text.replace(pattern, '');

  const DIGITS: Record<number, RegExp> = {
    2: /^[01]+$/,
    8: /^[0-7]+$/,
    10: /^[0-9]+$/,
    16: /^[0-9a-fA-F]+$/,
  };
  const validator = DIGITS[resolved];
  if (!validator || !validator.test(text)) {
    throw new Error(`输入不符合 ${resolved} 进制的字符集`);
  }
  const value = BigInt(`${resolved === 16 ? '0x' : resolved === 8 ? '0o' : resolved === 2 ? '0b' : ''}${text}`);
  return negative ? -value : value;
}

export function formatBigInt(value: bigint, base: Radix): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const text = abs.toString(base);
  const prefixed = base === 16 ? `0x${text}` : base === 8 ? `0o${text}` : base === 2 ? `0b${text}` : text;
  return negative ? `-${prefixed}` : prefixed;
}

export interface RadixTable {
  bin: string;
  oct: string;
  dec: string;
  hex: string;
  bytes: string;
}

export function convertAll(input: string, base: Radix | 'auto' = 'auto'): RadixTable {
  const value = parseBigInt(input, base);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  let hex = abs.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  const bytes = (hex.match(/.{2}/g) ?? []).join(' ').toUpperCase();
  return {
    bin: formatBigInt(value, 2),
    oct: formatBigInt(value, 8),
    dec: value.toString(10),
    hex: formatBigInt(value, 16),
    bytes: negative ? `-${bytes}` : bytes,
  };
}

export function bitwise(a: bigint, b: bigint, op: BitOp, shift = 0): bigint {
  switch (op) {
    case 'and':
      return a & b;
    case 'or':
      return a | b;
    case 'xor':
      return a ^ b;
    case 'not':
      return ~a;
    case 'shl':
      return a << BigInt(Math.max(0, Math.trunc(shift)));
    case 'shr':
      return a >> BigInt(Math.max(0, Math.trunc(shift)));
    default:
      throw new Error(`未知位运算：${String(op)}`);
  }
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      { id: 'input', label: '数值', kind: 'text', placeholder: '例如 0x1f、0b1010、0o777、12345678901234567890', full: true },
      {
        id: 'base',
        label: '输入进制',
        kind: 'select',
        value: 'auto',
        options: [
          { value: 'auto', label: '自动识别前缀（默认十进制）' },
          { value: '2', label: '二进制' },
          { value: '8', label: '八进制' },
          { value: '10', label: '十进制' },
          { value: '16', label: '十六进制' },
        ],
      },
      { id: 'operand', label: '第二个操作数（位运算用）', kind: 'text', placeholder: '例如 0xff' },
      {
        id: 'op',
        label: '位运算',
        kind: 'select',
        value: 'and',
        options: [
          { value: 'and', label: 'AND（与）' },
          { value: 'or', label: 'OR（或）' },
          { value: 'xor', label: 'XOR（异或）' },
          { value: 'not', label: 'NOT（取反）' },
          { value: 'shl', label: 'SHL（左移）' },
          { value: 'shr', label: 'SHR（右移）' },
        ],
      },
      { id: 'shift', label: '移位位数（仅移位运算）', kind: 'number', value: '1' },
    ],
    actions: [
      {
        label: '转换进制',
        primary: true,
        run: ({ values }) => {
          const base = values.base === 'auto' ? 'auto' : (Number.parseInt(values.base ?? '10', 10) as Radix);
          const table = convertAll(values.input ?? '', base);
          return [
            `二进制：${table.bin}`,
            `八进制：${table.oct}`,
            `十进制：${table.dec}`,
            `十六进制：${table.hex}`,
            `字节序列：${table.bytes}`,
          ].join('\n');
        },
      },
      {
        label: '执行位运算',
        run: ({ values }) => {
          const base = values.base === 'auto' ? 'auto' : (Number.parseInt(values.base ?? '10', 10) as Radix);
          const a = parseBigInt(values.input ?? '', base);
          const b = parseBigInt(values.operand ?? '0', base);
          const op = (values.op ?? 'and') as BitOp;
          const shift = Number.parseInt(values.shift ?? '1', 10) || 0;
          const result = bitwise(a, b, op, shift);
          return [
            `表达式：${formatBigInt(a, 16)} ${op.toUpperCase()} ${formatBigInt(b, 16)}${op === 'shl' || op === 'shr' ? ` ${shift}` : ''}`,
            `十进制：${result.toString(10)}`,
            `十六进制：${formatBigInt(result, 16)}`,
            `二进制：${formatBigInt(result, 2)}`,
          ].join('\n');
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 8,
    note: '全部使用 BigInt，无 32 位 / 64 位截断；负数按补码语义由 BigInt 原生处理。',
  });
}
