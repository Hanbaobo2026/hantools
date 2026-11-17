import { create } from 'qrcode';
import { describe, expect, it } from 'vitest';
import { qrOptions } from '../tools/qr/index';

describe('二维码', () => {
  it('纠错等级与尺寸夹取', () => {
    expect(qrOptions('H', 512, 4)).toMatchObject({ errorCorrectionLevel: 'H', width: 512, margin: 4 });
    expect(qrOptions('X', 10, 99)).toMatchObject({ errorCorrectionLevel: 'M', width: 128, margin: 10 });
    expect(qrOptions('L', 9999, -3)).toMatchObject({ width: 1024, margin: 0 });
  });

  it('固定深色模块 + 白底', () => {
    const options = qrOptions('M', 256, 2);
    expect(options.color.dark).toBe('#04060f');
    expect(options.color.light).toBe('#ffffff');
  });

  it('qrcode 能按参数生成矩阵', () => {
    const qr = create('flag{qr}', { errorCorrectionLevel: 'M' });
    expect(qr.modules.size).toBeGreaterThan(20);
    expect(qr.version).toBeGreaterThanOrEqual(1);
  });
});
