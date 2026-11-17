import { mountPanel } from '../../components/ToolPanel';
import { fromHex, toHex, utf8Decode, utf8Encode } from '../../utils/text';

/**
 * Hex 与 Hexdump 转换。
 * 支持：
 *  - 文本 → hex（自定义分隔符）
 *  - hex → 文本（容忍空格/逗号/冒号/连字符/0x 前缀）
 *  - 文本 → xxd 风格 hexdump（含偏移与 ASCII 列）
 *  - 解析 xxd / hexdump -C 输出，抽取字节
 */

export type HexMode = 'encode' | 'decode' | 'dump' | 'undump';

export function textToHex(text: string, separator = ' '): string {
  return toHex(utf8Encode(text), separator);
}

export function hexToText(hex: string): string {
  const bytes = fromHex(hex);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** 生成 xxd 风格 hexdump：偏移 + 16 字节 + ASCII 列 */
export function toHexdump(text: string, bytesPerLine = 16): string {
  const bytes = utf8Encode(text);
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += bytesPerLine) {
    const slice = bytes.subarray(offset, offset + bytesPerLine);
    const hexPart = Array.from(slice, (b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(slice, (b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hexPart.padEnd(bytesPerLine * 3 - 1, ' ')}  |${ascii}|`);
  }
  return lines.join('\n');
}

/** 解析 xxd / hexdump -C 风格文本：每行取 ASCII 列之前的十六进制部分 */
export function parseHexdump(dump: string): Uint8Array {
  const bytes: number[] = [];
  for (const rawLine of dump.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('*')) continue;

    // 去掉行首偏移：支持 "00000000:" 与 "00000000  "（xxd / hexdump -C）两种写法
    let body = line.replace(/^[0-9a-fA-F]{4,16}:\s*/, '');
    if (body === line) body = line.replace(/^[0-9a-fA-F]{8}\s{2,}/, '');

    // 去掉 ASCII 列：|....| 或列之间的两个以上空格
    const pipe = body.indexOf('|');
    if (pipe >= 0) body = body.slice(0, pipe);
    const [hexPart] = body.split(/\s{2,}/);
    const cleaned = (hexPart ?? '').replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length === 0 || cleaned.length % 2 !== 0) continue;

    for (let i = 0; i < cleaned.length; i += 2) {
      bytes.push(Number.parseInt(cleaned.slice(i, i + 2), 16));
    }
  }
  if (bytes.length === 0) throw new Error('未从输入中解析出十六进制字节');
  return new Uint8Array(bytes);
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入',
        kind: 'textarea',
        rows: 7,
        placeholder: '文本，或十六进制字符串 / hexdump 文本',
      },
      {
        id: 'mode',
        label: '转换方向',
        kind: 'select',
        value: 'encode',
        options: [
          { value: 'encode', label: '文本 → Hex' },
          { value: 'decode', label: 'Hex → 文本' },
          { value: 'dump', label: '文本 → Hexdump（xxd 风格）' },
          { value: 'undump', label: 'Hexdump → 字节 / 文本' },
        ],
      },
      {
        id: 'separator',
        label: 'Hex 分隔符',
        kind: 'text',
        value: ' ',
        hint: '留空表示连续输出；常用：空格、逗号、\\n',
      },
      { id: 'uppercase', label: '输出大写', kind: 'checkbox' },
    ],
    actions: [
      {
        label: '转换',
        primary: true,
        run: ({ values, checks }) => {
          const input = values.input ?? '';
          const mode = (values.mode ?? 'encode') as HexMode;
          const separator = values.separator === '\\n' ? '\n' : (values.separator ?? ' ');
          const uppercase = Boolean(checks.uppercase);
          if (mode === 'encode') return toHex(utf8Encode(input), separator, uppercase);
          if (mode === 'decode') return hexToText(input);
          if (mode === 'dump') return toHexdump(input);
          const bytes = parseHexdump(input);
          const text = utf8Decode(bytes);
          return `字节数：${bytes.length}\n\n${text}\n\n--- hex ---\n${toHex(bytes, ' ', uppercase)}`;
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 10,
    note: 'Hex → 文本按严格 UTF-8 解码；若失败，可用「Hexdump → 字节」查看原始字节。',
  });
}
