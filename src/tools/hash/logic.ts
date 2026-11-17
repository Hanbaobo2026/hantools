import { md5, ripemd160, sha1 } from '@noble/hashes/legacy.js';
import { sha224, sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import { keccak_256, sha3_256, sha3_512 } from '@noble/hashes/sha3.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { yieldToUi } from '../../utils/text';

/**
 * 哈希纯逻辑（无 DOM）：主线程与 Worker 共用。
 * 使用 @noble/hashes（审计过、零依赖），爆破只跑本地字典。
 */

export type HashAlgo =
  | 'md5'
  | 'sha1'
  | 'sha224'
  | 'sha256'
  | 'sha384'
  | 'sha512'
  | 'sha3_256'
  | 'sha3_512'
  | 'keccak_256'
  | 'ripemd160'
  | 'crc32';

const HASHERS: Record<Exclude<HashAlgo, 'crc32'>, (msg: Uint8Array) => Uint8Array> = {
  md5,
  sha1,
  sha224,
  sha256,
  sha384,
  sha512,
  sha3_256,
  sha3_512,
  keccak_256,
  ripemd160,
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

/** CRC32（常用于 ZIP / PNG 校验；CTF 里偶尔作为“不是哈希的哈希”） */
export function crc32(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}

export function hashText(text: string, algo: HashAlgo): string {
  if (algo === 'crc32') return crc32(text);
  const hasher = HASHERS[algo];
  if (!hasher) throw new Error(`不支持的算法：${String(algo)}`);
  return bytesToHex(hasher(utf8ToBytes(text)));
}

export interface HashGuess {
  family: string;
  note: string;
}

const GUESSES: Record<number, HashGuess[]> = {
  8: [{ family: 'CRC32', note: '校验和，不是密码学哈希' }],
  32: [
    { family: 'MD5', note: '128 位，已被碰撞攻击，不可用于安全场景' },
    { family: 'NTLM / MD4', note: '长度相同，需结合上下文判断' },
  ],
  40: [
    { family: 'SHA-1', note: '160 位，已不推荐' },
    { family: 'RIPEMD-160', note: '常见于比特币地址推导' },
  ],
  56: [{ family: 'SHA-224 / SHA3-224', note: '224 位' }],
  64: [
    { family: 'SHA-256', note: '最常见' },
    { family: 'SHA3-256', note: '输出长度相同' },
    { family: 'Keccak-256', note: '以太坊使用；与 SHA3-256 填充不同' },
    { family: 'BLAKE2s-256', note: '长度相同' },
  ],
  96: [{ family: 'SHA-384 / SHA3-384', note: '384 位' }],
  128: [
    { family: 'SHA-512', note: '512 位' },
    { family: 'SHA3-512', note: '长度相同' },
    { family: 'Whirlpool', note: '长度相同' },
  ],
};

/** 按长度与字符集给出可能的算法（仅提示，不能替代上下文） */
export function identifyHash(input: string): HashGuess[] {
  const hex = input.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex)) return [];
  return GUESSES[hex.length] ?? [];
}

/** 内置小字典：CTF 常见弱口令 / 题目习惯用词，可被自定义字典覆盖 */
export const BUILTIN_WORDLIST: readonly string[] = [
  'flag', 'ctf', 'admin', 'administrator', 'root', 'password', 'password1', 'passw0rd', 'p@ssw0rd',
  '123456', '1234567', '12345678', '123456789', '1234567890', '000000', '111111', '666666', '888888',
  '654321', '123123', '112233', '123321', '5201314', '1314520', 'woaini', 'woaini1314', 'qwerty',
  'qwerty123', 'qwe123', 'qweasd', '1qaz2wsx', '1q2w3e4r', 'zaq12wsx', 'qazwsx', 'asdfgh', 'zxcvbnm',
  'abc123', 'a123456', 'a123456789', 'iloveyou', 'letmein', 'welcome', 'monkey', 'dragon', 'master',
  'sunshine', 'princess', 'football', 'baseball', 'shadow', 'superman', 'trustno1', 'whatever',
  'freedom', 'hello', 'hello123', 'test', 'test123', 'guest', 'guest123', 'demo', 'sample', 'example',
  'user', 'user123', 'admin123', 'admin888', 'adminadmin', 'root123', 'changeme', 'secret', 'default',
  'system', 'mysql', 'oracle', 'postgres', 'redis', 'docker', 'ubuntu', 'debian', 'kali', 'linux',
  'hacker', 'security', 'exploit', 'payload', 'shell', 'reverse', 'backdoor', 'injection', 'xss',
  'csrf', 'jwt', 'token', 'secretkey', 'privatekey', 'publickey', 'crypto', 'cipher', 'encode',
  'decode', 'base64', 'xor', 'rsa', 'aes', 'des', 'md5', 'sha1', 'sha256', 'hantools', 'hanbaobo',
  'computer', 'internet', 'samsung', 'google', 'facebook', 'twitter', 'apple', 'microsoft',
  'starwars', 'pokemon', 'minecraft', 'matrix', 'neo', 'trinity', 'morpheus', '741852963', '159753',
];

export interface CrackResult {
  found: boolean;
  plaintext?: string;
  tried: number;
}

function abortError(): Error {
  const error = new Error('已取消');
  error.name = 'AbortError';
  return error;
}

export async function crackHash(
  target: string,
  algo: HashAlgo,
  candidates: readonly string[],
  options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<CrackResult> {
  const normalized = target.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized)) throw new Error('目标摘要必须是十六进制字符串');

  for (let index = 0; index < candidates.length; index += 1) {
    if (options.signal?.aborted) throw abortError();
    const candidate = candidates[index] as string;
    if (hashText(candidate, algo) === normalized) {
      return { found: true, plaintext: candidate, tried: index + 1 };
    }
    if (index % 200 === 0) {
      options.onProgress?.(index + 1, candidates.length);
      await yieldToUi();
    }
  }
  return { found: false, tried: candidates.length };
}
