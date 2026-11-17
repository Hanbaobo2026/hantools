import { mountPanel } from '../../components/ToolPanel';
import { cjkCount, fromBinary, fromHex, printableRatio } from '../../utils/text';
import { base32Decode, decodeText as decodeBase } from '../base64/index';
import { atbash, morseDecode, rot13 } from '../cipher/index';
import { htmlDecode, unicodeDecode, urlDecode } from '../urlcode/index';

/**
 * 编码链自动识别。
 * 思路：BFS 逐层尝试常见解码器，每一步都要求“解码后变成更可读的文本”，
 * 用可打印比例 + 中文占比 + flag 特征给结果打分，返回最像答案的若干条链。
 * 只做纯解码，不做任何网络请求。
 */

interface Decoder {
  label: string;
  detect: (input: string) => boolean;
  decode: (input: string) => string;
}

const utf8 = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);

const DECODERS: Decoder[] = [
  {
    label: 'Base64',
    detect: (s) => s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s),
    decode: (s) => decodeBase(s, 'base64'),
  },
  {
    label: 'Base64URL',
    detect: (s) => /^[A-Za-z0-9_-]+={0,2}$/.test(s) && /[-_]/.test(s),
    decode: (s) => decodeBase(s, 'base64url'),
  },
  {
    label: 'Base32',
    detect: (s) => s.length % 8 === 0 && /^[A-Z2-7]+=*$/.test(s),
    decode: (s) => utf8(base32Decode(s)),
  },
  {
    label: 'Hex',
    detect: (s) => /^(?:[0-9a-fA-F]{2})+$/.test(s),
    decode: (s) => utf8(fromHex(s)),
  },
  {
    label: 'URL',
    detect: (s) => /%[0-9a-fA-F]{2}/.test(s),
    decode: urlDecode,
  },
  {
    label: 'HTML',
    detect: (s) => /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(s),
    decode: htmlDecode,
  },
  {
    label: 'Unicode',
    detect: (s) => /\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}/.test(s),
    decode: unicodeDecode,
  },
  {
    label: 'Binary',
    detect: (s) => /^[01\s]{8,}$/.test(s) && s.replace(/\s/g, '').length % 8 === 0,
    decode: (s) => utf8(fromBinary(s)),
  },
  { label: 'ROT13', detect: (s) => /[a-zA-Z]{2,}/.test(s), decode: rot13 },
  { label: 'Atbash', detect: (s) => /[a-zA-Z]{2,}/.test(s), decode: atbash },
  {
    label: 'Morse',
    detect: (s) => /^[.\-\s/]+$/.test(s) && s.includes('.'),
    decode: morseDecode,
  },
];

export interface ChainResult {
  chain: string[];
  text: string;
  score: number;
  depth: number;
}

const FLAG_PATTERN = /flag\{|ctf\{|key\{|hgame\{|DASCTF\{|flag is/i;

export function scoreText(text: string): number {
  const ratio = printableRatio(text);
  const cjk = cjkCount(text);
  const flagBonus = FLAG_PATTERN.test(text) ? 40 : 0;
  const lengthBonus = Math.min(text.length, 80) * 0.15;
  return Math.round((ratio * 12 + Math.min(cjk, 30) * 1.2 + flagBonus + lengthBonus) * 10) / 10;
}

export function decodeChain(input: string, maxDepth = 4, maxResults = 8): ChainResult[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const results: ChainResult[] = [];
  const visited = new Set<string>([trimmed]);
  let frontier: Array<{ text: string; chain: string[] }> = [{ text: trimmed, chain: [] }];

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next: Array<{ text: string; chain: string[] }> = [];
    for (const node of frontier) {
      for (const decoder of DECODERS) {
        if (!decoder.detect(node.text)) continue;
        let out: string;
        try {
          out = decoder.decode(node.text);
        } catch {
          continue;
        }
        if (!out || out === node.text || out.length > 20000) continue;
        if (visited.has(out)) continue;
        visited.add(out);

        const chain = [...node.chain, decoder.label];
        const ratio = printableRatio(out);
        if (ratio >= 0.9 && out.length >= 3) {
          results.push({ chain, text: out, score: scoreText(out), depth });
        }
        next.push({ text: out, chain });
      }
    }
    frontier = next.sort((a, b) => b.text.length - a.text.length).slice(0, 40);
  }

  return results.sort((a, b) => b.score - a.score || a.depth - b.depth).slice(0, maxResults);
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '待识别内容',
        kind: 'textarea',
        rows: 6,
        placeholder: '粘贴可疑字符串，例如 ZmxhZ3toZWxsb30= 或 %66%6c%61%67%7b%78%7d',
      },
      {
        id: 'depth',
        label: '最大解码层数',
        kind: 'number',
        value: '4',
        hint: '层数越多越慢，一般 3–4 层足够',
      },
    ],
    actions: [
      {
        label: '自动识别',
        primary: true,
        run: ({ values }) => {
          const depth = Math.min(Math.max(Number.parseInt(values.depth ?? '4', 10) || 4, 1), 6);
          const results = decodeChain(values.input ?? '', depth);
          if (results.length === 0) {
            return { output: '', status: { text: '没有找到可读的解码结果，可能不是常见编码', kind: 'warn' } };
          }
          const lines = results.map(
            (result, index) =>
              `${index + 1}. ${result.chain.join(' → ')}（${result.depth} 层，评分 ${result.score}）\n${result.text}`,
          );
          return {
            output: lines.join('\n\n'),
            status: { text: `找到 ${results.length} 个候选，评分越高越像答案`, kind: 'ok' },
          };
        },
      },
    ],
    outputLabel: '候选解码链',
    outputRows: 12,
    note: '纯本地启发式识别，可能产生误报；识别结果仅供线索，请结合题目上下文判断。',
  });
}
