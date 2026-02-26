export interface RSSFeed {
  id: string;
  title: string;
  url: string;
  description?: string;
  lastUpdated?: number;
}

export interface RSSItem {
  id: string;
  feedId: string;
  title: string;
  link: string;
  description?: string;
  content?: string;
  pubDate?: string;
  author?: string;
  categories?: string[];
  isRead: boolean;
  isStarred: boolean;
}

export interface FeedContent {
  feed: RSSFeed;
  items: RSSItem[];
}

export type ViewMode = 'all' | 'unread' | 'starred';

// 翻译结果
export interface TranslationCache {
  [itemId: string]: {
    title: string | null;
    content: string;
    translatedAt: number;
  };
}

// AI 翻译配置
export interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}
