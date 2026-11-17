import { describe, expect, it } from 'vitest';
import { asciiTable, codesToText, detectFormat, textToCodes } from '../tools/charcode/index';

describe('ASCII / 字符码', () => {
  it('文本 → 各进制码值', () => {
    expect(textToCodes('Hi', 'dec')).toBe('72 105');
    expect(textToCodes('Hi', 'hex')).toBe('48 69');
    expect(textToCodes('Hi', 'bin')).toBe('1001000 1101001');
    expect(textToCodes('Hi', 'oct')).toBe('110 151');
    expect(textToCodes('Hi', 'dec', 'comma')).toBe('72, 105');
    expect(textToCodes('Hi', 'hex', 'space', true)).toBe('48 69');
  });

  it('码值 → 文本', () => {
    expect(codesToText('72 105', 'dec')).toBe('Hi');
    expect(codesToText('0x48 0x69', 'hex')).toBe('Hi');
    expect(codesToText('01001000 01101001', 'bin')).toBe('Hi');
  });

  it('自动识别码制', () => {
    expect(detectFormat('0x48 0x69')).toBe('hex');
    expect(detectFormat('01001000 01101001')).toBe('bin');
    expect(detectFormat('72 105')).toBe('dec');
    expect(codesToText('0x48 0x69')).toBe('Hi');
  });

  it('中文与 emoji 按码点处理', () => {
    expect(textToCodes('你好', 'dec')).toBe('20320 22909');
    expect(codesToText('20320 22909', 'dec')).toBe('你好');
    expect(codesToText(textToCodes('🚩', 'hex'), 'hex')).toBe('🚩');
  });

  it('非法码值报错', () => {
    expect(() => codesToText('72 abc', 'dec')).toThrow(/十进制码/);
    expect(() => codesToText('0xzz', 'hex')).toThrow(/十六进制码/);
    expect(() => codesToText('1114112', 'dec')).toThrow(/超出范围/);
  });

  it('ASCII 表包含可打印字符', () => {
    const table = asciiTable();
    expect(table).toContain('A');
    expect(table).toContain('65');
    expect(table).toContain('SPACE');
  });
});
