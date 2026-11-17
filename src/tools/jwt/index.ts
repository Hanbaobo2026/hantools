import { hmac } from '@noble/hashes/hmac.js';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { mountPanel } from '../../components/ToolPanel';

/**
 * JWT 解析与校验（纯函数）。
 * 隐私提醒：解析 ≠ 验签，payload 可能含敏感信息；页面明确提示不要粘贴生产 Token。
 * 仅支持 HS256/384/512 的本地验签（HMAC），RS/ES 系列需要公钥解析，暂不实现。
 */

export interface JwtDecoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  signingInput: string;
}

export function base64UrlDecode(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function base64UrlEncode(text: string): string {
  const bytes = utf8ToBytes(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeJwt(token: string): JwtDecoded {
  const parts = token.trim().split('.');
  if (parts.length !== 3) throw new Error('JWT 必须由三段组成：header.payload.signature');
  const [headerPart, payloadPart, signature] = parts as [string, string, string];
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerPart)) as Record<string, unknown>;
    payload = JSON.parse(base64UrlDecode(payloadPart)) as Record<string, unknown>;
  } catch {
    throw new Error('header / payload 不是合法的 Base64URL JSON');
  }
  return { header, payload, signature, signingInput: `${headerPart}.${payloadPart}` };
}

export interface JwtVerifyResult {
  valid: boolean;
  algorithm: string;
  message: string;
  expectedSignature?: string;
}

export function verifyJwt(token: string, secret: string): JwtVerifyResult {
  const decoded = decodeJwt(token);
  const algorithm = String(decoded.header.alg ?? '');
  if (algorithm === 'none') {
    return { valid: false, algorithm, message: 'alg=none：签名被禁用，任何人都能伪造该 Token' };
  }
  const hasher = algorithm === 'HS256' ? sha256 : algorithm === 'HS384' ? sha384 : algorithm === 'HS512' ? sha512 : null;
  if (!hasher) {
    return { valid: false, algorithm, message: `仅支持 HS256/HS384/HS512，当前 alg=${algorithm || '未知'}` };
  }
  if (secret === '') return { valid: false, algorithm, message: '请填写 HMAC 密钥' };

  const digest = hmac(hasher, utf8ToBytes(secret), utf8ToBytes(decoded.signingInput));
  let binary = '';
  for (const byte of digest) binary += String.fromCharCode(byte);
  const expected = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return expected === decoded.signature
    ? { valid: true, algorithm, message: `签名有效（${algorithm}）`, expectedSignature: expected }
    : { valid: false, algorithm, message: '签名不匹配：密钥错误或内容被篡改', expectedSignature: expected };
}

/** 时间类声明检查：exp / nbf / iat */
export function inspectClaims(payload: Record<string, unknown>, nowSeconds = Math.floor(Date.now() / 1000)): string[] {
  const notes: string[] = [];
  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  const nbf = typeof payload.nbf === 'number' ? payload.nbf : null;
  const iat = typeof payload.iat === 'number' ? payload.iat : null;
  if (exp !== null) {
    notes.push(exp < nowSeconds ? `已过期（exp 距今 ${nowSeconds - exp} 秒）` : `未过期（剩余 ${exp - nowSeconds} 秒）`);
  }
  if (nbf !== null && nbf > nowSeconds) notes.push(`尚未生效（还需 ${nbf - nowSeconds} 秒）`);
  if (iat !== null) notes.push(`签发于 ${new Date(iat * 1000).toISOString()}`);
  if (payload.iss !== undefined) notes.push(`iss = ${String(payload.iss)}`);
  if (payload.aud !== undefined) notes.push(`aud = ${String(payload.aud)}`);
  return notes;
}

export function mount(root: HTMLElement): void {
  mountPanel(root, {
    fields: [
      {
        id: 'token',
        label: 'JWT',
        kind: 'textarea',
        rows: 5,
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy',
      },
      { id: 'secret', label: 'HMAC 密钥（校验用）', kind: 'text', placeholder: '仅用于本地校验，不会上传' },
    ],
    actions: [
      {
        label: '解析',
        primary: true,
        run: ({ values }) => {
          const decoded = decodeJwt(values.token ?? '');
          const notes = inspectClaims(decoded.payload);
          return [
            '--- Header ---',
            JSON.stringify(decoded.header, null, 2),
            '',
            '--- Payload ---',
            JSON.stringify(decoded.payload, null, 2),
            '',
            '--- 声明检查 ---',
            notes.length > 0 ? notes.join('\n') : '无 exp / nbf / iat 等时间声明',
          ].join('\n');
        },
      },
      {
        label: '校验签名',
        run: ({ values }) => {
          const result = verifyJwt(values.token ?? '', values.secret ?? '');
          return {
            output: result.message,
            status: { text: result.valid ? '签名有效' : '签名无效或无法校验', kind: result.valid ? 'ok' : 'warn' },
          };
        },
      },
      {
        label: '导出 HS256 签名',
        run: ({ values }) => {
          const decoded = decodeJwt(values.token ?? '');
          const secret = values.secret ?? '';
          if (secret === '') throw new Error('请填写 HMAC 密钥');
          const digest = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(decoded.signingInput));
          return bytesToHex(digest);
        },
      },
    ],
    outputLabel: '结果',
    outputRows: 12,
    note: '解析不等于验签：Payload 只是 Base64URL 编码，任何人都能读取。请勿粘贴生产环境的真实 Token。',
  });
}
