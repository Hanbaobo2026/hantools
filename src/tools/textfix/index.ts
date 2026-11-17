import { mountPanel } from '../../components/ToolPanel';
import { cjkCount, latin1Encode, printableRatio, tryDecode } from '../../utils/text';

/**
 * 乱码修复（编码探测）。
 * 常见两种错配：
 *   1) UTF-8 字节被当作 Latin-1 显示 → “ä½ å¥½”
 *   2) UTF-8 字节被当作 GBK 显示   → “浣犲ソ”（含 U+FFFD 时不可逆）
 * 浏览器没有 GBK 编码器，所以这里按需构建“字符 → GBK 字节”反查表来做第 2 种修复。
 */

export interface Candidate {
  label: string;
  text: string;
  score: number;
}

let gbkTable: Map<string, number[]> | null = null;

function buildGbkTable(): Map<string, number[]> {
  const table = new Map<string, number[]>();
  const decoder = new TextDecoder('gbk');
  for (let code = 0x20; code < 0x7f; code += 1) table.set(String.fromCharCode(code), [code]);
  for (let lead = 0x81; lead <= 0xfe; lead += 1) {
    for (let trail = 0x40; trail <= 0xfe; trail += 1) {
      if (trail === 0x7f) continue;
      const ch = decoder.decode(new Uint8Array([lead, trail]));
      if (ch.length === 1 && ch !== '\uFFFD' && !table.has(ch)) table.set(ch, [lead, trail]);
    }
  }
  return table;
}

/** 把字符串编码回 GBK 字节；遇到 GBK 无法表示的字符返回 null */
export function gbkEncode(text: string): Uint8Array | null {
  if (!gbkTable) gbkTable = buildGbkTable();
  const out: number[] = [];
  for (const ch of text) {
    const mapped = gbkTable.get(ch);
    if (!mapped) return null;
    out.push(...mapped);
  }
  return new Uint8Array(out);
}

export function repairMojibake(input: string): Candidate[] {
  if (input.length === 0) return [];
  const candidates: Candidate[] = [];
  const inputIsLatin1 = Array.from(input).every((ch) => (ch.codePointAt(0) ?? 0) <= 0xff);

  const push = (label: string, text: string | null, bonus = 0): void => {
    if (!text || text === input) return;
    if (text.includes('\uFFFD')) return;
    const cjk = cjkCount(text);
    const ratio = printableRatio(text);
    if (ratio < 0.6) return;
    // 中日混排通常意味着错误候选：中文文本里出现片假名/平假名基本不成立
    const kana = (text.match(/[\u3040-\u30ff]/g) ?? []).length;
    const score = Math.round((cjk * 2 + ratio * 10 - kana * 2 + bonus) * 10) / 10;
    candidates.push({ label, text, score });
  };

  const latinBytes = latin1Encode(input);
  if (latinBytes.length > 0) {
    push('Latin-1 → UTF-8（常见“ä½ å¥½”型乱码）', tryDecode(latinBytes, 'utf-8'), inputIsLatin1 ? 6 : 0);
    push('Latin-1 → GBK（字节被当作 Latin-1 显示）', tryDecode(latinBytes, 'gbk'), inputIsLatin1 ? 3 : 0);
  }

  const gbkBytes = gbkEncode(input);
  if (gbkBytes) push('GBK → UTF-8（常见“浣犲ソ”型乱码）', tryDecode(gbkBytes, 'utf-8'), inputIsLatin1 ? 0 : 6);

  const seen = new Set<string>();
  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.text)) return false;
      seen.add(candidate.text);
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '乱码文本',
        kind: 'textarea',
        rows: 7,
        placeholder: '粘贴显示异常的文本，例如：ä½ å¥½ 或 浣犲ソ',
      },
    ],
    actions: [
      {
        label: '尝试修复',
        primary: true,
        run: ({ values }) => {
          const input = values.input ?? '';
          const candidates = repairMojibake(input);
          if (candidates.length === 0) {
            return {
              output: '',
              status: {
                text: '没有找到可逆的候选结果：可能原文已含 U+FFFD（替换字符），信息已丢失。',
                kind: 'warn',
              },
            };
          }
          const lines = candidates.map(
            (candidate, index) => `${index + 1}. ${candidate.label}（评分 ${candidate.score}）\n${candidate.text}`,
          );
          return {
            output: lines.join('\n\n'),
            status: { text: `找到 ${candidates.length} 个候选，优先看第 1 条`, kind: 'ok' },
          };
        },
      },
    ],
    outputLabel: '候选结果',
    outputRows: 10,
    note: '乱码修复不是万能的：若原文已被替换成 U+FFFD（显示为 �），对应字节已丢失，无法还原。',
  });
}
