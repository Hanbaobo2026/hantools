import { describe, expect, it } from 'vitest';
import { encodeText } from '../tools/base64/index';
import { atbash, caesar, caesarBrute, morseDecode, morseEncode, rot13, vigenere } from '../tools/cipher/index';
import { BUILTIN_WORDLIST, crackHash, crc32, hashText, identifyHash } from '../tools/hash/index';
import { base64UrlEncode, decodeJwt, inspectClaims, verifyJwt } from '../tools/jwt/index';
import { decodeChain } from '../tools/magic/index';
import {
  bigintToText,
  factorTrialDivision,
  integerRoot,
  modInverse,
  modPow,
  parseBigNumber,
  recoverPrivateKey,
  smallExponentAttack,
} from '../tools/rsa/index';
import { cribAttack, scorePlaintext, singleByteBrute, xorBytes } from '../tools/xor/index';

describe('古典密码', () => {
  it('凯撒保留大小写与非字母', () => {
    expect(caesar('Hello, World!', 3)).toBe('Khoor, Zruog!');
    expect(caesar(caesar('Attack at dawn', 7), -7)).toBe('Attack at dawn');
  });

  it('凯撒暴力枚举可还原明文', () => {
    const guesses = caesarBrute('Khoor, Zruog!');
    expect(guesses.length).toBe(26);
    expect(guesses.find((guess) => guess.shift === 3)?.text).toBe('Hello, World!');
  });

  it('ROT13 与 Atbash', () => {
    expect(rot13(rot13('Hello'))).toBe('Hello');
    expect(rot13('ABC')).toBe('NOP');
    expect(atbash('abcXYZ')).toBe('zyxCBA');
  });

  it('维吉尼亚标准向量', () => {
    expect(vigenere('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR');
    expect(vigenere('LXFOPVEFRNHR', 'LEMON', true)).toBe('ATTACKATDAWN');
    expect(() => vigenere('abc', '123')).toThrow(/密钥/);
  });

  it('摩斯编码解码往返', () => {
    expect(morseEncode('SOS HELP')).toBe('... --- ... / .... . .-.. .--.');
    expect(morseDecode('... --- ... / .... . .-.. .--.')).toBe('SOS HELP');
    expect(morseDecode('... ..--')).toBe('S?');
  });
});

describe('哈希', () => {
  it('标准测试向量', () => {
    expect(hashText('abc', 'md5')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(hashText('abc', 'sha256')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hashText('abc', 'sha1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(crc32('123456789')).toBe('cbf43926');
  });

  it('摘要长度识别', () => {
    expect(identifyHash('5d41402abc4b2a76b9719d911017c592')[0]?.family).toBe('MD5');
    expect(identifyHash('a'.repeat(64)).some((guess) => guess.family === 'SHA-256')).toBe(true);
    expect(identifyHash('not-a-hash')).toEqual([]);
  });

  it('本地字典爆破', async () => {
    const target = hashText('flag', 'md5');
    const result = await crackHash(target, 'md5', ['admin', 'flag']);
    expect(result.found).toBe(true);
    expect(result.plaintext).toBe('flag');

    const miss = await crackHash(hashText('NotInList', 'sha256'), 'sha256', BUILTIN_WORDLIST);
    expect(miss.found).toBe(false);
  });

  it('可被取消', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(crackHash('00', 'md5', ['a', 'b'], { signal: controller.signal })).rejects.toThrow(/已取消/);
  });
});

describe('XOR', () => {
  it('异或可逆', () => {
    const data = new TextEncoder().encode('flag{test}');
    const key = new TextEncoder().encode('key');
    const cipher = xorBytes(data, key);
    expect(new TextDecoder().decode(xorBytes(cipher, key))).toBe('flag{test}');
  });

  it('单字节爆破能找到正确密钥', () => {
    const plaintext = 'The quick brown fox jumps over the lazy dog';
    const data = new TextEncoder().encode(plaintext);
    const cipher = xorBytes(data, new Uint8Array([0x42]));
    const hex = Array.from(cipher, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const hits = singleByteBrute(hex, true, 3);
    expect(hits[0]?.key).toBe(0x42);
    expect(hits[0]?.text).toBe(plaintext);
  });

  it('可读性评分区分文本与乱码', () => {
    expect(scorePlaintext('flag{hello}')).toBeGreaterThan(scorePlaintext('\u0001\u0002\u0003\u0004'));
  });

  it('crib 反推重复密钥', () => {
    const plaintext = 'flag{hello_world}';
    const key = new TextEncoder().encode('KEY');
    const cipher = xorBytes(new TextEncoder().encode(plaintext), key);
    const hex = Array.from(cipher, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const result = cribAttack(hex, 'flag', true);
    expect(result.text).toBe(plaintext);
    expect(result.keyHex.slice(0, 6)).toBe('4b4559');
  });
});

describe('JWT', () => {
  const token =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  it('解析 header / payload', () => {
    const decoded = decodeJwt(token);
    expect(decoded.header.alg).toBe('HS256');
    expect(decoded.payload.sub).toBe('1234567890');
    expect(decoded.payload.name).toBe('John Doe');
  });

  it('校验 HS256 签名', () => {
    expect(verifyJwt(token, 'your-256-bit-secret').valid).toBe(true);
    expect(verifyJwt(token, 'wrong-secret').valid).toBe(false);
  });

  it('alg=none 必须判为不安全', () => {
    const none = `${base64UrlEncode('{"alg":"none"}')}.${base64UrlEncode('{"a":1}')}.`;
    const result = verifyJwt(none, 'x');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('alg=none');
  });

  it('声明检查', () => {
    const notes = inspectClaims({ exp: 100, iat: 50 }, 200);
    expect(notes[0]).toContain('已过期');
  });

  it('段数不对时抛错', () => {
    expect(() => decodeJwt('abc.def')).toThrow(/三段/);
  });
});

describe('RSA', () => {
  it('modPow / modInverse 标准结果', () => {
    expect(modPow(4n, 13n, 497n)).toBe(445n);
    expect(modInverse(17n, 3120n)).toBe(2753n);
  });

  it('整数开方与小指数攻击', () => {
    expect(integerRoot(27n, 3)).toBe(3n);
    expect(integerRoot(28n, 3)).toBe(3n);
    expect(smallExponentAttack(74088n, 3)).toEqual({ message: 42n, exact: true });
    expect(smallExponentAttack(1_000_001n, 3).exact).toBe(false);
  });

  it('试除分解与已知 p/q 解密', () => {
    const factor = factorTrialDivision(3233n);
    expect(factor).not.toBeNull();
    expect((factor as { p: bigint; q: bigint }).p * (factor as { p: bigint; q: bigint }).q).toBe(3233n);

    const key = recoverPrivateKey(61n, 53n, 17n);
    expect(key.n).toBe(3233n);
    expect(key.d).toBe(2753n);
    expect(modPow(2790n, key.d, key.n)).toBe(65n);
    expect(bigintToText(65n)).toBe('A');
  });

  it('文本还原与数值解析', () => {
    expect(bigintToText(0x666c61677b78n)).toBe('flag{x');
    expect(parseBigNumber('0x10')).toBe(16n);
    expect(parseBigNumber('1_000')).toBe(1000n);
  });
});

describe('编码链识别', () => {
  it('识别单层 Base64', () => {
    const results = decodeChain('ZmxhZ3toZWxsb30=');
    expect(results[0]?.text).toBe('flag{hello}');
    expect(results[0]?.chain).toContain('Base64');
  });

  it('识别双层 Base64', () => {
    const double = encodeText(encodeText('flag{double}', 'base64'), 'base64');
    const results = decodeChain(double);
    expect(results.some((item) => item.text === 'flag{double}' && item.depth === 2)).toBe(true);
  });

  it('识别 URL 编码', () => {
    const results = decodeChain('%66%6c%61%67%7b%78%7d');
    expect(results.some((item) => item.text === 'flag{x}')).toBe(true);
  });
});
