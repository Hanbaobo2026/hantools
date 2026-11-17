import { describe, expect, it } from 'vitest';
import {
  detectSignatures,
  extractStrings,
  hexPreview,
  looksLikeText,
  sha256Hex,
} from '../tools/fileinfo/index';

const bytesOf = (...parts: Array<number | string>): Uint8Array => {
  const out: number[] = [];
  for (const part of parts) {
    if (typeof part === 'number') out.push(part);
    else for (const byte of new TextEncoder().encode(part)) out.push(byte);
  }
  return Uint8Array.from(out);
};

describe('文件魔数识别', () => {
  it('识别 PNG', () => {
    const sigs = detectSignatures(bytesOf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 'IHDR'));
    expect(sigs[0]?.name).toContain('PNG');
    expect(sigs[0]?.ext).toBe('.png');
    expect(sigs[0]?.offset).toBe(0);
  });

  it('识别 ZIP / ELF / PDF / PCAP', () => {
    expect(detectSignatures(bytesOf(0x50, 0x4b, 0x03, 0x04))[0]?.name).toContain('ZIP');
    expect(detectSignatures(bytesOf(0x7f, 'ELF', 2, 1, 1, 0))[0]?.name).toContain('ELF');
    expect(detectSignatures(bytesOf('%PDF-1.7'))[0]?.name).toContain('PDF');
    expect(detectSignatures(bytesOf(0xd4, 0xc3, 0xb2, 0xa1))[0]?.name).toContain('PCAP');
  });

  it('识别 RIFF 子类型与 ftyp 偏移', () => {
    expect(detectSignatures(bytesOf('RIFF', 0, 0, 0, 0, 'WAVE', 'fmt '))[0]?.name).toContain('WAV');
    expect(detectSignatures(bytesOf(0, 0, 0, 0x18, 'ftyp', 'isom'))[0]?.name).toContain('ftyp');
  });

  it('文本与未知二进制', () => {
    const text = bytesOf('hello world, this is plain text\n');
    expect(detectSignatures(text)).toEqual([]);
    expect(looksLikeText(text)).toBe(true);
    expect(looksLikeText(bytesOf(0, 1, 2, 3, 4, 5))).toBe(false);
  });
});

describe('strings 提取', () => {
  it('ASCII 与最小长度过滤', () => {
    const data = bytesOf(0, 'flag{abc}', 0, 'hi', 0);
    const hits = extractStrings(data, 4, 'ascii');
    expect(hits.map((hit) => hit.text)).toEqual(['flag{abc}']);
    expect(hits[0]?.offset).toBe(1);
  });

  it('UTF-16LE 且结尾处也能输出', () => {
    const data = bytesOf('A', 0, 'B', 0, 'C', 0, 'D', 0);
    expect(extractStrings(data, 2, 'utf-16le')[0]?.text).toBe('ABCD');
  });

  it('both 模式同时返回两类', () => {
    const data = bytesOf('AAAA', 0, 0, 'A', 0, 'B', 0, 'C', 0, 'D', 0);
    const hits = extractStrings(data, 2, 'both');
    expect(hits.some((hit) => hit.encoding === 'ascii')).toBe(true);
    expect(hits.some((hit) => hit.encoding === 'utf-16le')).toBe(true);
  });
});

describe('辅助输出', () => {
  it('hex 预览格式', () => {
    const preview = hexPreview(bytesOf('flag'), 16);
    expect(preview.startsWith('00000000  66 6c 61 67')).toBe(true);
    expect(preview).toContain('|flag|');
  });

  it('SHA-256', () => {
    expect(sha256Hex(bytesOf('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
