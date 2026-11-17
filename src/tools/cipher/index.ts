import { mountPanel } from '../../components/ToolPanel';

/**
 * 古典密码工具箱（纯函数）：
 *  - 凯撒：保留大小写，仅移动 A-Z / a-z；附 26 位移暴力枚举
 *  - ROT13：凯撒位移 13 的特例
 *  - Atbash：字母表反转
 *  - 维吉尼亚：A-Z 循环移位，非字母原样保留且不消耗密钥
 *  - 摩斯电码：字母 / 数字 / 常用标点，单词用 / 分隔
 */

export type CipherMode = 'caesar' | 'rot13' | 'atbash' | 'vigenere' | 'morse';

const A = 'A'.charCodeAt(0);
const LOWER_A = 'a'.charCodeAt(0);
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function shiftChar(code: number, base: number, shift: number): string {
  const offset = (((code - base + shift) % 26) + 26) % 26;
  return String.fromCharCode(base + offset);
}

export function caesar(text: string, shift: number): string {
  const normalized = ((shift % 26) + 26) % 26;
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= A && code <= A + 25) out += shiftChar(code, A, normalized);
    else if (code >= LOWER_A && code <= LOWER_A + 25) out += shiftChar(code, LOWER_A, normalized);
    else out += ch;
  }
  return out;
}

export interface CaesarGuess {
  shift: number;
  text: string;
}

export function caesarBrute(text: string): CaesarGuess[] {
  const guesses: CaesarGuess[] = [];
  for (let shift = 0; shift < 26; shift += 1) {
    guesses.push({ shift, text: caesar(text, -shift) });
  }
  return guesses;
}

export function rot13(text: string): string {
  return caesar(text, 13);
}

export function atbash(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= A && code <= A + 25) out += ALPHABET[25 - (code - A)];
    else if (code >= LOWER_A && code <= LOWER_A + 25) {
      out += (ALPHABET[25 - (code - LOWER_A)] as string).toLowerCase();
    } else out += ch;
  }
  return out;
}

export function vigenere(text: string, key: string, decode = false): string {
  const cleanKey = key.toUpperCase().replace(/[^A-Z]/g, '');
  if (cleanKey.length === 0) throw new Error('维吉尼亚密码需要至少一个字母作为密钥');
  let out = '';
  let index = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    const isUpper = code >= A && code <= A + 25;
    const isLower = code >= LOWER_A && code <= LOWER_A + 25;
    if (!isUpper && !isLower) {
      out += ch;
      continue;
    }
    const keyShift = ALPHABET.indexOf(cleanKey[index % cleanKey.length] as string);
    const shift = decode ? -keyShift : keyShift;
    out += isUpper ? shiftChar(code, A, shift) : shiftChar(code, LOWER_A, shift);
    index += 1;
  }
  return out;
}

const MORSE_MAP: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
};

const MORSE_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_MAP).map(([letter, code]) => [code, letter]),
);

export function morseEncode(text: string): string {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const encoded = words.map((word) =>
    Array.from(word)
      .map((ch) => MORSE_MAP[ch] ?? '')
      .filter(Boolean)
      .join(' '),
  );
  return encoded.join(' / ');
}

export function morseDecode(text: string): string {
  return text
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => MORSE_REVERSE[code] ?? '?')
        .join(''),
    )
    .join(' ');
}

export function convert(text: string, mode: CipherMode, shift: number, key: string, decode: boolean): string {
  switch (mode) {
    case 'caesar':
      return caesar(text, decode ? -shift : shift);
    case 'rot13':
      return rot13(text);
    case 'atbash':
      return atbash(text);
    case 'vigenere':
      return vigenere(text, key, decode);
    case 'morse':
      return decode ? morseDecode(text) : morseEncode(text);
    default:
      throw new Error(`未知算法：${String(mode)}`);
  }
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入文本',
        kind: 'textarea',
        rows: 6,
        placeholder: '明文或密文；摩斯电码用空格分隔字母、/ 分隔单词',
      },
      {
        id: 'mode',
        label: '算法',
        kind: 'select',
        value: 'caesar',
        options: [
          { value: 'caesar', label: '凯撒 Caesar' },
          { value: 'rot13', label: 'ROT13' },
          { value: 'atbash', label: 'Atbash（字母表反转）' },
          { value: 'vigenere', label: '维吉尼亚 Vigenère' },
          { value: 'morse', label: '摩斯电码 Morse' },
        ],
      },
      { id: 'shift', label: '凯撒位移（1-25）', kind: 'number', value: '3' },
      { id: 'key', label: '维吉尼亚密钥', kind: 'text', placeholder: '例如 LEMON' },
      { id: 'decode', label: '解密模式', kind: 'checkbox' },
    ],
    actions: [
      {
        label: '转换',
        primary: true,
        run: ({ values, checks }) =>
          convert(
            values.input ?? '',
            (values.mode ?? 'caesar') as CipherMode,
            Number.parseInt(values.shift ?? '3', 10) || 0,
            values.key ?? '',
            Boolean(checks.decode),
          ),
      },
      {
        label: '凯撒暴力枚举（26 位移）',
        run: ({ values, setStatus }) => {
          if ((values.mode ?? 'caesar') !== 'caesar') {
            setStatus('暴力枚举仅适用于凯撒密码，请先切换算法', 'warn');
            return '';
          }
          const guesses = caesarBrute(values.input ?? '');
          const lines = guesses.map(
            (guess) => `解密位移 ${String(guess.shift).padStart(2, '0')} → ${guess.text}`,
          );
          return {
            output: lines.join('\n'),
            status: { text: '已列出全部 26 种可能，挑选语义通顺的一行', kind: 'ok' },
          };
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 10,
    note: '维吉尼亚只处理 A-Z 字母，其他字符原样保留且不消耗密钥；摩斯解码遇到未知码会输出 ?。',
  });
}
