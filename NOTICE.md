# 第三方许可清单（NOTICE）

本项目以 MIT License 发布。以下为运行时依赖的许可信息，分发构建产物时请保留本文件。

## 运行时依赖

| 依赖 | 版本 | 许可 | 用途 |
|---|---|---|---|
| @noble/hashes | 2.4.0 | MIT | MD5 / SHA-1 / SHA-2 / SHA-3 / Keccak / RIPEMD-160 / HMAC |
| crypto-js | 4.2.0 | MIT | AES / DES / 3DES / RC4 对称加密（仅对称加密工具按需加载） |
| qrcode | 1.5.4 | MIT | 二维码生成 |
| jsqr | 1.4.0 | Apache-2.0 | 二维码识别 |

## 构建与开发依赖

| 依赖 | 许可 | 用途 |
|---|---|---|
| vite | MIT | 构建与开发服务器 |
| typescript | Apache-2.0 | 类型检查 |
| vitest | MIT | 单元测试 |
| wrangler | MIT OR Apache-2.0 | Cloudflare Workers 部署 |

## 说明

- 所有工具逻辑均为本项目自研（Base 家族、Hex、古典密码、XOR、RSA、JWT 验签封装、Magic 链识别等），未复制第三方代码。
- 若未来引入 `crypto-js`（DES/RC4）、`jsQR`（Apache-2.0）、`JSZip`（MIT OR GPL-3.0，需选择 MIT）、`pyodide`（MPL-2.0）等依赖，必须在本文件登记并确认许可兼容性。
