import { createCipheriv } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptText, encryptText, keyBytes } from '../tools/symmetric/index';
import type { SymmetricOptions } from '../tools/symmetric/index';

const aes = (overrides: Partial<SymmetricOptions>): SymmetricOptions => ({
  family: 'AES',
  mode: 'CBC',
  key: '',
  iv: '',
  keyEncoding: 'hex',
  padding: 'NoPadding',
  ...overrides,
});

describe('对称加密', () => {
  it('AES-128-ECB 对齐 FIPS-197 向量', () => {
    const options = aes({ mode: 'ECB', key: '000102030405060708090a0b0c0d0e0f' });
    expect(encryptText('00112233445566778899aabbccddeeff', 'hex', 'hex', options)).toBe(
      '69c4e0d86a7b0430d8cdb78070b4c55a',
    );
  });

  it('AES-128-CBC 与 node:crypto 一致', () => {
    const key = '000102030405060708090a0b0c0d0e0f';
    const iv = '101112131415161718191a1b1c1d1e1f';
    const plain = '00112233445566778899aabbccddeeff';
    const cipher = createCipheriv('aes-128-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    cipher.setAutoPadding(false);
    const expected = Buffer.concat([cipher.update(Buffer.from(plain, 'hex')), cipher.final()]).toString('hex');
    expect(encryptText(plain, 'hex', 'hex', aes({ key, iv }))).toBe(expected);
    expect(decryptText(expected, 'hex', 'hex', aes({ key, iv }))).toBe(plain);
  });

  it('AES-256-CTR 与 node:crypto 一致', () => {
    const key = '603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4';
    const iv = 'f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff';
    const plain = '6bc1bee22e409f96e93d7e117393172a';
    const cipher = createCipheriv('aes-256-ctr', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    const expected = Buffer.concat([cipher.update(Buffer.from(plain, 'hex')), cipher.final()]).toString('hex');
    const options = aes({ mode: 'CTR', key, iv });
    expect(encryptText(plain, 'hex', 'hex', options)).toBe(expected);
    expect(decryptText(expected, 'hex', 'hex', options)).toBe(plain);
  });

  it('RC4 标准向量', () => {
    const options: SymmetricOptions = {
      family: 'RC4',
      mode: 'CBC',
      key: 'Key',
      keyEncoding: 'utf8',
      padding: 'Pkcs7',
    };
    expect(encryptText('Plaintext', 'utf8', 'hex', options)).toBe('bbf316e8d940af0ad3');
    expect(decryptText('bbf316e8d940af0ad3', 'hex', 'utf8', options)).toBe('Plaintext');
  });

  it('DES / 3DES 往返', () => {
    const des: SymmetricOptions = {
      family: 'DES',
      mode: 'CBC',
      key: '0123456789abcdef',
      iv: '0011223344556677',
      keyEncoding: 'hex',
      padding: 'Pkcs7',
    };
    const desCipher = encryptText('flag{DES}', 'utf8', 'hex', des);
    expect(decryptText(desCipher, 'hex', 'utf8', des)).toBe('flag{DES}');

    const tdes: SymmetricOptions = {
      family: 'TripleDES',
      mode: 'CBC',
      key: '0123456789abcdeffedcba98765432100011223344556677',
      iv: '0011223344556677',
      keyEncoding: 'hex',
      padding: 'Pkcs7',
    };
    const tdesCipher = encryptText('flag{3DES}', 'utf8', 'hex', tdes);
    expect(decryptText(tdesCipher, 'hex', 'utf8', tdes)).toBe('flag{3DES}');
  });

  it('密钥 / IV 长度校验给出中文提示', () => {
    expect(() => encryptText('x', 'utf8', 'hex', aes({ key: '00112233', iv: '00112233445566778899aabbccddeeff' }))).toThrow(
      /AES 密钥应为 16 \/ 24 \/ 32 字节/,
    );
    expect(() =>
      encryptText('x', 'utf8', 'hex', aes({ key: '00112233445566778899aabbccddeeff', iv: '0011' })),
    ).toThrow(/16 字节 IV/);
  });

  it('NoPadding 要求整块对齐', () => {
    const options = aes({ mode: 'ECB', key: '00112233445566778899aabbccddeeff' });
    expect(() => encryptText('abc', 'utf8', 'hex', options)).toThrow(/整数倍/);
  });

  it('keyBytes 反映真实字节数', () => {
    expect(
      keyBytes({ family: 'AES', mode: 'CBC', key: '1234567890123456', keyEncoding: 'utf8', padding: 'Pkcs7' }),
    ).toBe(16);
  });
});
