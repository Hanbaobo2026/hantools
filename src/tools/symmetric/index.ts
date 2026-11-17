import * as CryptoJS from 'crypto-js';
import { mountPanel } from '../../components/ToolPanel';

/**
 * 对称加密（纯函数）：AES / DES / TripleDES / RC4。
 * CryptoJS 负责算法本体（MIT），这里补齐 CTF 最需要的部分：
 *  - 密钥 / IV 支持 utf8、hex、base64 三种输入
 *  - AES 支持 CBC / ECB / CTR / CFB / OFB，DES/3DES 支持 CBC / ECB
 *  - 支持 Pkcs7 / NoPadding / ZeroPadding / AnsiX923 / Iso10126
 *  - 对密钥、IV 字节长度做显式校验，报错直接说“应为多少字节、当前多少字节”
 */

export type Family = 'AES' | 'DES' | 'TripleDES' | 'RC4';
export type Mode = 'CBC' | 'ECB' | 'CTR' | 'CFB' | 'OFB';
export type TextEncoding = 'utf8' | 'hex' | 'base64';
export type PaddingName = 'Pkcs7' | 'NoPadding' | 'ZeroPadding' | 'AnsiX923' | 'Iso10126';

export interface SymmetricOptions {
  family: Family;
  mode: Mode;
  key: string;
  iv?: string;
  keyEncoding: TextEncoding;
  padding: PaddingName;
}

const BLOCK_SIZE: Record<Family, number> = { AES: 16, DES: 8, TripleDES: 8, RC4: 0 };
const KEY_SIZES: Record<Family, number[]> = {
  AES: [16, 24, 32],
  DES: [8],
  TripleDES: [16, 24],
  RC4: [],
};

const MODES: Record<Mode, typeof CryptoJS.mode.CBC> = {
  CBC: CryptoJS.mode.CBC,
  ECB: CryptoJS.mode.ECB,
  CTR: CryptoJS.mode.CTR,
  CFB: CryptoJS.mode.CFB,
  OFB: CryptoJS.mode.OFB,
};

const PADDINGS: Record<PaddingName, typeof CryptoJS.pad.Pkcs7> = {
  Pkcs7: CryptoJS.pad.Pkcs7,
  NoPadding: CryptoJS.pad.NoPadding,
  ZeroPadding: CryptoJS.pad.ZeroPadding,
  AnsiX923: CryptoJS.pad.AnsiX923,
  Iso10126: CryptoJS.pad.Iso10126,
};

interface CipherApi {
  encrypt(
    message: CryptoJS.lib.WordArray,
    key: CryptoJS.lib.WordArray,
    cfg?: Record<string, unknown>,
  ): { ciphertext: CryptoJS.lib.WordArray };
  decrypt(
    ciphertext: CryptoJS.lib.CipherParams,
    key: CryptoJS.lib.WordArray,
    cfg?: Record<string, unknown>,
  ): CryptoJS.lib.WordArray;
}

function cipherApi(family: Family): CipherApi {
  const table: Record<Family, unknown> = {
    AES: CryptoJS.AES,
    DES: CryptoJS.DES,
    TripleDES: CryptoJS.TripleDES,
    RC4: CryptoJS.RC4,
  };
  return table[family] as CipherApi;
}

function parseEncoded(value: string, encoding: TextEncoding, label: string): CryptoJS.lib.WordArray {
  if (encoding === 'hex') {
    const hex = value.replace(/\s+/g, '');
    if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error(`${label} 不是合法的 hex（含非十六进制字符）`);
    if (hex.length % 2 !== 0) throw new Error(`${label} 的 hex 长度为奇数，无法组成完整字节`);
    return CryptoJS.enc.Hex.parse(hex);
  }
  if (encoding === 'base64') {
    const b64 = value.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) throw new Error(`${label} 不是合法的 Base64`);
    return CryptoJS.enc.Base64.parse(b64);
  }
  return CryptoJS.enc.Utf8.parse(value);
}

function parseData(value: string, encoding: TextEncoding, label: string): CryptoJS.lib.WordArray {
  if (value === '') throw new Error(`${label}为空`);
  return parseEncoded(value, encoding, label);
}

export function keyBytes(options: SymmetricOptions): number {
  return parseEncoded(options.key, options.keyEncoding, '密钥').sigBytes;
}

function parseKey(options: SymmetricOptions): CryptoJS.lib.WordArray {
  const key = parseEncoded(options.key, options.keyEncoding, '密钥');
  const allowed = KEY_SIZES[options.family];
  if (allowed.length > 0 && !allowed.includes(key.sigBytes)) {
    throw new Error(`${options.family} 密钥应为 ${allowed.join(' / ')} 字节，当前为 ${key.sigBytes} 字节`);
  }
  return key;
}

function parseIv(options: SymmetricOptions): CryptoJS.lib.WordArray | undefined {
  if (options.family === 'RC4' || options.mode === 'ECB') return undefined;
  const size = BLOCK_SIZE[options.family];
  const raw = (options.iv ?? '').trim();
  if (raw === '') throw new Error(`${options.mode} 模式需要 IV，请输入 ${size} 字节的 IV`);
  const iv = parseEncoded(raw, options.keyEncoding, 'IV');
  if (iv.sigBytes !== size) throw new Error(`${options.mode} 模式需要 ${size} 字节 IV，当前为 ${iv.sigBytes} 字节`);
  return iv;
}

function assertBlockAligned(message: CryptoJS.lib.WordArray, options: SymmetricOptions): void {
  if (options.family === 'RC4' || options.padding !== 'NoPadding') return;
  const block = BLOCK_SIZE[options.family];
  if (message.sigBytes % block !== 0) {
    throw new Error(`NoPadding 要求输入长度为 ${block} 的整数倍，当前为 ${message.sigBytes} 字节`);
  }
}

function config(options: SymmetricOptions, iv?: CryptoJS.lib.WordArray): Record<string, unknown> {
  if (options.family === 'RC4') return {};
  return {
    mode: MODES[options.mode],
    padding: PADDINGS[options.padding],
    ...(iv ? { iv } : {}),
  };
}

function encodeOutput(data: CryptoJS.lib.WordArray, encoding: TextEncoding): string {
  if (encoding === 'utf8') {
    try {
      return CryptoJS.enc.Utf8.stringify(data);
    } catch {
      throw new Error('结果不是合法 UTF-8，请把输出编码改为 hex 或 base64');
    }
  }
  return encoding === 'hex' ? data.toString(CryptoJS.enc.Hex) : data.toString(CryptoJS.enc.Base64);
}

export function encryptText(
  input: string,
  inputEncoding: TextEncoding,
  outputEncoding: TextEncoding,
  options: SymmetricOptions,
): string {
  const message = parseData(input, inputEncoding, '输入');
  const key = parseKey(options);
  const iv = parseIv(options);
  assertBlockAligned(message, options);
  const result = cipherApi(options.family).encrypt(message, key, config(options, iv));
  return encodeOutput(result.ciphertext, outputEncoding);
}

export function decryptText(
  input: string,
  inputEncoding: TextEncoding,
  outputEncoding: TextEncoding,
  options: SymmetricOptions,
): string {
  const data = parseData(input, inputEncoding, '密文');
  const key = parseKey(options);
  const iv = parseIv(options);
  const params = CryptoJS.lib.CipherParams.create({ ciphertext: data });
  const result = cipherApi(options.family).decrypt(params, key, config(options, iv));
  if (result.sigBytes <= 0) throw new Error('解密结果为空：密钥 / IV / 模式 / 填充方式可能不正确');
  return encodeOutput(result, outputEncoding);
}

const FAMILY_OPTIONS: Array<{ value: Family; label: string }> = [
  { value: 'AES', label: 'AES（128 / 192 / 256）' },
  { value: 'DES', label: 'DES（8 字节密钥）' },
  { value: 'TripleDES', label: '3DES（16 / 24 字节密钥）' },
  { value: 'RC4', label: 'RC4（无 IV / 填充）' },
];

const MODE_OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: 'CBC', label: 'CBC（需要 IV）' },
  { value: 'ECB', label: 'ECB（不需要 IV）' },
  { value: 'CTR', label: 'CTR（需要 IV）' },
  { value: 'CFB', label: 'CFB（需要 IV）' },
  { value: 'OFB', label: 'OFB（需要 IV）' },
];

const ENCODING_OPTIONS: Array<{ value: TextEncoding; label: string }> = [
  { value: 'utf8', label: 'UTF-8 文本' },
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' },
];

const PADDING_OPTIONS: Array<{ value: PaddingName; label: string }> = [
  { value: 'Pkcs7', label: 'PKCS#7（最常用）' },
  { value: 'NoPadding', label: 'NoPadding（输入需整块对齐）' },
  { value: 'ZeroPadding', label: 'ZeroPadding' },
  { value: 'AnsiX923', label: 'ANSI X9.23' },
  { value: 'Iso10126', label: 'ISO 10126' },
];

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'input',
        label: '输入（明文或密文）',
        kind: 'textarea',
        rows: 6,
        placeholder: '明文，或 hex / base64 密文（按下方“输入编码”解释）',
      },
      { id: 'family', label: '算法', kind: 'select', value: 'AES', options: FAMILY_OPTIONS },
      { id: 'mode', label: '模式', kind: 'select', value: 'CBC', options: MODE_OPTIONS },
      { id: 'padding', label: '填充', kind: 'select', value: 'Pkcs7', options: PADDING_OPTIONS },
      { id: 'key', label: '密钥', kind: 'text', placeholder: 'AES 16/24/32 字节；DES 8 字节；3DES 16/24 字节' },
      {
        id: 'keyEncoding',
        label: '密钥 / IV 编码',
        kind: 'select',
        value: 'utf8',
        options: ENCODING_OPTIONS,
      },
      { id: 'iv', label: 'IV（CBC/CTR/CFB/OFB 必填）', kind: 'text', placeholder: 'AES 16 字节，DES/3DES 8 字节' },
      { id: 'inputEncoding', label: '输入编码', kind: 'select', value: 'utf8', options: ENCODING_OPTIONS },
      {
        id: 'outputEncoding',
        label: '输出编码（加密时）',
        kind: 'select',
        value: 'hex',
        options: [
          { value: 'hex', label: 'Hex（推荐）' },
          { value: 'base64', label: 'Base64' },
          { value: 'utf8', label: 'UTF-8 文本' },
        ],
      },
    ],
    actions: [
      {
        label: '加密',
        primary: true,
        run: ({ values }) => {
          const options: SymmetricOptions = {
            family: (values.family ?? 'AES') as Family,
            mode: (values.mode ?? 'CBC') as Mode,
            key: values.key ?? '',
            iv: values.iv ?? '',
            keyEncoding: (values.keyEncoding ?? 'utf8') as TextEncoding,
            padding: (values.padding ?? 'Pkcs7') as PaddingName,
          };
          const output = encryptText(
            values.input ?? '',
            (values.inputEncoding ?? 'utf8') as TextEncoding,
            (values.outputEncoding ?? 'hex') as TextEncoding,
            options,
          );
          return {
            output,
            status: {
              text: `${options.family}-${options.mode} · 密钥 ${keyBytes(options)} 字节`,
              kind: 'ok',
            },
          };
        },
      },
      {
        label: '解密',
        run: ({ values }) => {
          const options: SymmetricOptions = {
            family: (values.family ?? 'AES') as Family,
            mode: (values.mode ?? 'CBC') as Mode,
            key: values.key ?? '',
            iv: values.iv ?? '',
            keyEncoding: (values.keyEncoding ?? 'utf8') as TextEncoding,
            padding: (values.padding ?? 'Pkcs7') as PaddingName,
          };
          const output = decryptText(
            values.input ?? '',
            (values.inputEncoding ?? 'hex') as TextEncoding,
            (values.outputEncoding ?? 'utf8') as TextEncoding,
            options,
          );
          return {
            output,
            status: {
              text: `已按 ${options.family}-${options.mode} 解密 · 密钥 ${keyBytes(options)} 字节`,
              kind: 'ok',
            },
          };
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 8,
    note: 'AES/3DES 的密钥长度决定 128/192/256 位与 2-key/3-key 3DES；ECB 不需要 IV，RC4 两者都不需要。解密时若报“结果不是合法 UTF-8”，请把输出编码改成 hex。',
  });
}
