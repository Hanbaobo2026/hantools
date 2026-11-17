/**
 * HanTools 核心类型。
 * 设计原则：元数据（可被构建脚本读取）与实现（按需加载的模块）分离，
 * 因此工具元数据统一放在 src/data/tools.json，供 Vite 与 Node 构建脚本共用。
 */

export type Locale = 'zh-CN' | 'en';

/** 可本地化的文本：zh-CN 必填，其他语言可选（当前 UI 为 zh-CN，结构已预留 i18n） */
export interface LocalizedText {
  'zh-CN': string;
  en?: string;
}

/** local：纯浏览器本地计算；network-optional：默认本地，联网能力为可选增强 */
export type PrivacyLevel = 'local' | 'network-optional';

export type CategorySlug = 'misc' | 'crypto' | 'web' | 'dev';

export interface ToolMeta {
  /** 目录名，同时作为模块加载键 */
  key: string;
  /** 规范路径 /tools/<slug> */
  slug: string;
  /** 短链接别名，/b64 → /tools/base64 */
  aliases: string[];
  category: CategorySlug;
  name: LocalizedText;
  description: LocalizedText;
  /** 搜索关键词（中英混合，覆盖中文别名与常见英文术语） */
  keywords: string[];
  tags: string[];
  privacy: PrivacyLevel;
  featured: boolean;
  /** 排序权重，越小越靠前 */
  order: number;
  offline: boolean;
  /** 引入版本，用于路线图追溯 */
  since: string;
}

export interface CategoryMeta {
  slug: CategorySlug;
  name: LocalizedText;
  description: LocalizedText;
  icon: string;
  order: number;
}

export interface CatalogData {
  site: {
    name: string;
    origin: string;
    version: string;
  };
  categories: CategoryMeta[];
  tools: ToolMeta[];
}

/** 每个工具模块必须导出的挂载函数签名 */
export interface ToolModule {
  mount(root: HTMLElement): void | Promise<void>;
  /** 可选清理：路由离开时调用，用于中断长任务 / 移除全局监听 */
  unmount?(): void;
}
