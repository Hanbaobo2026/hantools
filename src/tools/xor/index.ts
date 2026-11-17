import { mountPanel } from '../../components/ToolPanel';
import { fromHex, latin1Decode, printableRatio, toHex, utf8Decode, utf8Encode } from '../../utils/text';

/**
 * XOR 加解密与爆破（纯函数）。
 * 三种模式：
 *  1) 已知密钥异或（密钥可为文本或 hex）
 *  2) 单字节 256 键暴力枚举，按“英文/中文可读性”评分排序
 *  3) 已知明文（crib）反推重复密钥
 */

export type KeyFormat = 'text' | 'hex';

export function parseKey(key: string, format: KeyFormat): Uint8Array {
  if (format === 'hex') return fromHex(key);
  return utf8Encode(key);
}

export function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (key.length === 0) throw new Error('密钥不能为空');
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = (data[i] as number) ^ (key[i % key.length] as number);
  }
  return out;
}

const FREQUENT = ' etaoinshrdlucmfwypvbgkjqxz';

/** 可读性评分：空格、常见英文字母、中文加分；控制字符重罚 */
export function scorePlaintext(text: string): number {
  if (text.length === 0) return -100;
  let score = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === ' ') score += 3;
    else if (/[a-zA-Z]/.test(ch)) score += FREQUENT.includes(ch.toLowerCase()) ? 2 : 1;
    else if (code >= 0x4e00 && code <= 0x9fff) score += 2;
    else if (code >= 0x30 && code <= 0x39) score += 1;
    else if (ch === '\n' || ch === '\t') score += 0.5;
    else if (code < 0x20 || code === 0x7f) score -= 8;
    else score -= 2;
  }
  return score / text.length;
}

export interface BruteHit {
  key: number;
  score: number;
  text: string;
}

export function singleByteBrute(input: string, inputIsHex: boolean, topN = 12): BruteHit[] {
  const data = inputIsHex ? fromHex(input) : utf8Encode(input);
  if (data.length === 0) throw new Error('输入为空');
  const hits: BruteHit[] = [];
  for (let key = 0; key < 256; key += 1) {
    const out = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i += 1) out[i] = (data[i] as number) ^ key;
    const text = utf8Decode(out);
    hits.push({ key, text, score: Math.round(scorePlaintext(text) * 100) / 100 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, topN);
}

export interface CribResult {
  keyText: string;
  keyHex: string;
  text: string;
}

export function cribAttack(input: string, crib: string, inputIsHex: boolean, offset = 0): CribResult {
  const data = inputIsHex ? fromHex(input) : utf8Encode(input);
  const cribBytes = utf8Encode(crib);
  if (cribBytes.length === 0) throw new Error('已知明文不能为空');
  if (offset < 0 || offset + cribBytes.length > data.length) throw new Error('已知明文长度或偏移超出密文范围');

  const key = new Uint8Array(cribBytes.length);
  for (let i = 0; i < cribBytes.length; i += 1) {
    key[i] = (data[offset + i] as number) ^ (cribBytes[i] as number);
  }

  // crib 长度可能不是密钥周期的整数倍（如 key=KEY、crib=flag → 推导出 KEYK），
  // 因此先求最小周期，再用真正的密钥解密。
  const period = minimalPeriod(key);
  const realKey = key.slice(0, period);
  const text = utf8Decode(xorBytes(data, realKey));
  const printableKey = latin1Decode(realKey);
  const keyText = printableRatio(printableKey) > 0.9 ? printableKey : '(不可打印，见 hex)';
  return { keyText, keyHex: toHex(realKey, ''), text };
}

function minimalPeriod(bytes: Uint8Array): number {
  // 注意：不要求 period 整除长度（KEYK 的周期是 3，而非 4）
  for (let period = 1; period <= bytes.length; period += 1) {
    let matches = true;
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] !== bytes[i % period]) {
        matches = false;
        break;
      }
    }
    if (matches) return period;
  }
  return bytes.length;
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入（明文 / 密文）',
        kind: 'textarea',
        rows: 6,
        placeholder: '文本，或十六进制字节串（勾选“输入为 Hex”时）',
      },
      { id: 'inputIsHex', label: '输入为 Hex', kind: 'checkbox' },
      { id: 'key', label: '密钥（文本或 Hex）', kind: 'text', placeholder: '例如 key 或 0f1e2d' },
      {
        id: 'keyFormat',
        label: '密钥格式',
        kind: 'select',
        value: 'text',
        options: [
          { value: 'text', label: '文本（UTF-8）' },
          { value: 'hex', label: 'Hex' },
        ],
      },
      { id: 'crib', label: '已知明文 crib', kind: 'text', placeholder: '例如 flag{ 或 The ' },
      { id: 'offset', label: 'crib 起始偏移', kind: 'number', value: '0' },
    ],
    actions: [
      {
        label: '异或',
        primary: true,
        run: ({ values, checks }) => {
          const data = checks.inputIsHex ? fromHex(values.input ?? '') : utf8Encode(values.input ?? '');
          const key = parseKey(values.key ?? '', (values.keyFormat ?? 'text') as KeyFormat);
          const out = xorBytes(data, key);
          return [`文本：${utf8Decode(out)}`, '', `Hex：${toHex(out, '')}`].join('\n');
        },
      },
      {
        label: '单字节爆破（256 键）',
        run: ({ values, checks }) => {
          const hits = singleByteBrute(values.input ?? '', Boolean(checks.inputIsHex));
          const lines = hits.map(
            (hit) =>
              `key 0x${hit.key.toString(16).padStart(2, '0')}（评分 ${hit.score.toFixed(2)}）→ ${hit.text.slice(0, 120)}`,
          );
          return {
            output: lines.join('\n'),
            status: { text: '按评分排序，越靠前越像可读文本', kind: 'ok' },
          };
        },
      },
      {
        label: 'crib 反推密钥',
        run: ({ values, checks }) => {
          const result = cribAttack(
            values.input ?? '',
            values.crib ?? '',
            Boolean(checks.inputIsHex),
            Number.parseInt(values.offset ?? '0', 10) || 0,
          );
          return [
            `推导密钥（文本）：${result.keyText}`,
            `推导密钥（Hex）：${result.keyHex}`,
            '',
            `解密结果：${result.text}`,
          ].join('\n');
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 10,
    note: '单字节爆破基于英文/中文可读性评分，短文本可能有多个高分候选；crib 攻击假设密钥按 crib 长度循环。',
  });
}
