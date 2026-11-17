import { describe, expect, it } from 'vitest';
import { bitwise, convertAll, formatBigInt, parseBigInt } from '../tools/radix/index';
import { sortKeysDeep, transformJson } from '../tools/json/index';
import { gbkEncode, repairMojibake } from '../tools/textfix/index';
import { convertTimestamp, relativeTime } from '../tools/timestamp/index';

describe('乱码修复', () => {
  it('修复 Latin-1 型乱码', () => {
    // 真实乱码中 0xA0 会显示为不换行空格，因此这里显式使用 \u00a0
    const candidates = repairMojibake('ä½\u00a0å¥½');
    expect(candidates[0]?.text).toBe('你好');
  });

  it('修复 GBK 型乱码（运行时构建 GBK 反查表）', () => {
    const bytes = gbkEncode('浣犲ソ');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe('你好');
    const candidates = repairMojibake('浣犲ソ');
    expect(candidates[0]?.text).toBe('你好');
  });

  it('含替换字符时不应给出错误候选', () => {
    expect(repairMojibake('你好\uFFFD')).toEqual([]);
  });
});

describe('进制与位运算', () => {
  it('自动识别前缀', () => {
    expect(convertAll('0x1f').dec).toBe('31');
    expect(convertAll('0b1010').dec).toBe('10');
    expect(convertAll('0o17').dec).toBe('15');
    expect(convertAll('255').hex).toBe('0xff');
  });

  it('超大整数不截断', () => {
    const big = (1n << 100n) - 1n;
    expect(parseBigInt(big.toString(16), 16)).toBe(big);
    expect(formatBigInt(big, 2).length).toBe(102);
  });

  it('负数与位运算', () => {
    expect(parseBigInt('-0x10', 'auto')).toBe(-16n);
    expect(bitwise(0b1100n, 0b1010n, 'and')).toBe(0b1000n);
    expect(bitwise(0b0001n, 0n, 'shl', 4)).toBe(0b10000n);
    expect(bitwise(0n, 0n, 'not')).toBe(-1n);
  });

  it('非法字符抛错', () => {
    expect(() => parseBigInt('12z', 10)).toThrow(/字符集/);
  });
});

describe('JSON', () => {
  it('格式化 / 压缩 / 排序', () => {
    const source = '{"b":1,"a":{"d":2,"c":3}}';
    expect(transformJson(source, 'minify')).toBe('{"b":1,"a":{"d":2,"c":3}}');
    expect(transformJson(source, 'sort', 0)).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(transformJson(source, 'pretty', 2)).toContain('\n  "b": 1');
  });

  it('数组保持顺序', () => {
    expect(sortKeysDeep([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('报错带行列信息', () => {
    expect(() => transformJson('{\n  "a": 1,\n}', 'pretty')).toThrow(/第 3 行/);
  });

  it('校验统计', () => {
    expect(transformJson('[1,2]', 'validate')).toContain('顶层类型：数组');
  });
});

describe('时间戳', () => {
  it('秒 / 毫秒自动识别', () => {
    expect(convertTimestamp('1700000000').iso).toBe('2023-11-14T22:13:20.000Z');
    expect(convertTimestamp('1700000000000').seconds).toBe(1700000000);
    expect(convertTimestamp('1700000000', 's').ms).toBe(1700000000000);
  });

  it('ISO 与相对时间', () => {
    const info = convertTimestamp('2024-01-01T00:00:00Z');
    expect(info.iso).toBe('2024-01-01T00:00:00.000Z');
    expect(relativeTime(info.ms, info.ms)).toBe('就是现在');
    expect(relativeTime(info.ms + 3 * 86_400_000, info.ms)).toBe('3 天后');
  });

  it('非法输入抛错', () => {
    expect(() => convertTimestamp('not-a-date')).toThrow(/无法解析/);
  });
});
