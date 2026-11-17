import { describe, expect, it } from 'vitest';
import { decodeZeroWidth, encodeZeroWidth, scanInvisible } from '../tools/zerowidth/index';
import type { ZeroVariant } from '../tools/zerowidth/index';

describe('零宽字符隐写', () => {
  it('三种映射均可往返', () => {
    const text = 'flag{零宽字符}';
    const bytes = new TextEncoder().encode(text).length;
    for (const variant of ['zwsp-zwnj', 'zwsp-zwj', 'wj-bom'] as ZeroVariant[]) {
      const encoded = encodeZeroWidth(text, variant);
      expect(encoded.length).toBe(bytes * 8);
      expect(decodeZeroWidth(encoded).text).toBe(text);
    }
  });

  it('能从普通文本中自动解出隐藏内容', () => {
    const carrier = `正常的一句话 ${encodeZeroWidth('hi')} 结束`;
    const result = decodeZeroWidth(carrier);
    expect(result.text).toBe('hi');
    expect(result.bits).toBe(16);
  });

  it('空输入与非 8 倍数报错', () => {
    expect(() => encodeZeroWidth('')).toThrow(/为空/);
    expect(() => decodeZeroWidth('abc')).toThrow(/没有找到零宽字符/);
    expect(() => decodeZeroWidth('\u200b\u200b\u200b')).toThrow(/8 的倍数/);
  });

  it('统计不可见字符', () => {
    const stats = scanInvisible('a\u200b\u200b\u200c\u200d');
    expect(stats.find((item) => item.char === '\u200b')?.count).toBe(2);
    expect(stats.reduce((sum, item) => sum + item.count, 0)).toBe(4);
  });
});
