import { mountPanel } from '../../components/ToolPanel';
import { fromHex, toHex } from '../../utils/text';

/**
 * RSA 工具箱（纯函数，BigInt 实现）。
 * 覆盖 CTF 常见三类：
 *  1) 小指数开方：e 很小且 m^e < n 时直接开方
 *  2) n 试除分解：p/q 较小（默认上限 100 万）
 *  3) 已知 p、q：求 d 并解密
 */

export function parseBigNumber(value: string): bigint {
  const text = value.trim().replace(/[\s_,]/g, '');
  if (text === '') throw new Error('数值为空');
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  let parsed: bigint;
  if (/^0[xX][0-9a-fA-F]+$/.test(body)) parsed = BigInt(body);
  else if (/^[0-9]+$/.test(body)) parsed = BigInt(body);
  else throw new Error(`无法解析数值：${value}`);
  return negative ? -parsed : parsed;
}

export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus <= 0n) throw new Error('模数必须为正整数');
  let result = 1n;
  let b = ((base % modulus) + modulus) % modulus;
  let e = exponent;
  while (e > 0n) {
    if ((e & 1n) === 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

export function modInverse(a: bigint, m: bigint): bigint {
  if (m <= 0n) throw new Error('模数必须为正整数');
  let oldR = ((a % m) + m) % m;
  let r = m;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) throw new Error('逆元不存在：a 与 m 不互素');
  return ((oldS % m) + m) % m;
}

/** floor(n^(1/k))，牛顿迭代；用于小指数开方 */
export function integerRoot(n: bigint, k: number): bigint {
  if (n < 0n) throw new Error('仅支持非负整数');
  if (!Number.isInteger(k) || k < 1) throw new Error('开方次数必须是正整数');
  if (n < 2n) return n;
  const bigK = BigInt(k);
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / k));
  for (;;) {
    const next = ((bigK - 1n) * x + n / x ** (bigK - 1n)) / bigK;
    if (next >= x) return x;
    x = next;
  }
}

export interface SmallExponentResult {
  message: bigint;
  exact: boolean;
}

export function smallExponentAttack(cipher: bigint, e: number): SmallExponentResult {
  const root = integerRoot(cipher, e);
  return { message: root, exact: root ** BigInt(e) === cipher };
}

export interface FactorResult {
  p: bigint;
  q: bigint;
}

export function factorTrialDivision(n: bigint, limit = 1_000_000): FactorResult | null {
  if (n < 4n) return null;
  if (n % 2n === 0n) return { p: 2n, q: n / 2n };
  const max = BigInt(limit);
  for (let d = 3n; d * d <= n && d <= max; d += 2n) {
    if (n % d === 0n) return { p: d, q: n / d };
  }
  return null;
}

export interface RsaKey {
  n: bigint;
  phi: bigint;
  d: bigint;
}

export function recoverPrivateKey(p: bigint, q: bigint, e: bigint): RsaKey {
  if (p <= 1n || q <= 1n) throw new Error('p / q 必须是大于 1 的整数');
  if (p === q) throw new Error('p 与 q 不能相等');
  const n = p * q;
  const phi = (p - 1n) * (q - 1n);
  return { n, phi, d: modInverse(e, phi) };
}

/** 把大整数按大端字节还原为文本；无法按 UTF-8 解码时回退为 hex */
export function bigintToText(value: bigint): string {
  if (value < 0n) throw new Error('负数无法转换为文本');
  let hex = value.toString(16);
  if (hex.length % 2 !== 0) hex = `0${hex}`;
  const bytes = fromHex(hex);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return `(非 UTF-8 文本) hex = ${toHex(bytes, '')}`;
  }
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      { id: 'n', label: 'n（模数）', kind: 'text', placeholder: '十进制或 0x 开头的十六进制' },
      { id: 'e', label: 'e（公钥指数）', kind: 'text', placeholder: '例如 65537 或 3' },
      { id: 'c', label: 'c（密文）', kind: 'text', placeholder: '十进制或 0x 开头的十六进制' },
      { id: 'p', label: 'p（质因子）', kind: 'text', placeholder: '已知分解时填写' },
      { id: 'q', label: 'q（质因子）', kind: 'text', placeholder: '已知分解时填写' },
    ],
    actions: [
      {
        label: '小指数开方',
        primary: true,
        run: ({ values }) => {
          const cipher = parseBigNumber(values.c ?? '');
          const e = Number.parseInt(values.e ?? '3', 10);
          if (!Number.isInteger(e) || e < 2 || e > 17) throw new Error('e 需为 2–17 的整数（更大时开方无意义）');
          const result = smallExponentAttack(cipher, e);
          return [
            `开 ${e} 次方结果：${result.message.toString(10)}`,
            `是否精确：${result.exact ? '是（m^e = c，未取模）' : '否（可能发生回绕，需分解 n）'}`,
            `十六进制：${result.message.toString(16)}`,
            `文本：${bigintToText(result.message)}`,
          ].join('\n');
        },
      },
      {
        label: '试除分解 n',
        run: ({ values }) => {
          const n = parseBigNumber(values.n ?? '');
          const factor = factorTrialDivision(n);
          if (!factor) throw new Error('在试除上限内未找到因子；请改用 Pollard rho / yafu 等工具');
          return [
            `p = ${factor.p.toString(10)}`,
            `q = ${factor.q.toString(10)}`,
            `验证：p × q = ${(factor.p * factor.q).toString(10)}`,
          ].join('\n');
        },
      },
      {
        label: '已知 p/q 解密',
        run: ({ values }) => {
          const p = parseBigNumber(values.p ?? '');
          const q = parseBigNumber(values.q ?? '');
          const e = parseBigNumber(values.e ?? '65537');
          const cipher = parseBigNumber(values.c ?? '');
          const key = recoverPrivateKey(p, q, e);
          const message = modPow(cipher, key.d, key.n);
          return [
            `n = ${key.n.toString(10)}`,
            `φ(n) = ${key.phi.toString(10)}`,
            `d = ${key.d.toString(10)}`,
            '',
            `m（十进制）= ${message.toString(10)}`,
            `m（十六进制）= ${message.toString(16)}`,
            `m（文本）= ${bigintToText(message)}`,
          ].join('\n');
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 10,
    note: '纯本地 BigInt 计算；试除上限 100 万，超大 n 请使用专用工具分解。',
  });
}
