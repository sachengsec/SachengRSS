import type { RSSFeed, RSSItem, ViewMode, TranslationCache, AIConfig } from '@/types';

const STORAGE_KEYS = {
  FEEDS: 'rss_reader_feeds',
  ITEMS: 'rss_reader_items',
  VIEW_MODE: 'rss_reader_view_mode',
  SELECTED_FEED: 'rss_reader_selected_feed',
  TRANSLATIONS: 'rss_reader_translations',
  AI_CONFIG: 'rss_reader_ai_config',
};

export function saveFeeds(feeds: RSSFeed[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FEEDS, JSON.stringify(feeds));
    console.log('[storage] 保存订阅源:', feeds.length, '个');
  } catch (err) {
    console.error('[storage] 保存订阅源失败:', err);
  }
}

// 验证订阅源数据
function isValidFeed(feed: unknown): feed is RSSFeed {
  return (
    typeof feed === 'object' &&
    feed !== null &&
    typeof (feed as RSSFeed).id === 'string' &&
    typeof (feed as RSSFeed).title === 'string' &&
    typeof (feed as RSSFeed).url === 'string'
  );
}

// 验证文章数据
function isValidItem(item: unknown): item is RSSItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as RSSItem).id === 'string' &&
    typeof (item as RSSItem).feedId === 'string' &&
    typeof (item as RSSItem).title === 'string' &&
    typeof (item as RSSItem).link === 'string' &&
    typeof (item as RSSItem).isRead === 'boolean' &&
    typeof (item as RSSItem).isStarred === 'boolean'
  );
}

export function loadFeeds(): RSSFeed[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FEEDS);
    if (!data) {
      console.log('[storage] 没有保存的订阅源');
      return [];
    }
    const parsed = JSON.parse(data);

    // 验证是否为数组
    if (!Array.isArray(parsed)) {
      console.error('[storage] 订阅源数据格式错误：不是数组');
      return [];
    }

    // 验证每个订阅源
    const validFeeds = parsed.filter(isValidFeed);

    if (validFeeds.length !== parsed.length) {
      console.warn(`[storage] 过滤了 ${parsed.length - validFeeds.length} 个无效的订阅源`);
    }

    console.log('[storage] 加载订阅源:', validFeeds.length, '个');
    return validFeeds;
  } catch (err) {
    console.error('[storage] 加载订阅源失败:', err);
    return [];
  }
}

export function saveItems(items: RSSItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
    console.log('[storage] 保存文章:', items.length, '篇');
  } catch (err) {
    console.error('[storage] 保存文章失败:', err);
  }
}

export function loadItems(): RSSItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (!data) {
      console.log('[storage] 没有保存的文章');
      return [];
    }
    const parsed = JSON.parse(data);

    // 验证是否为数组
    if (!Array.isArray(parsed)) {
      console.error('[storage] 文章数据格式错误：不是数组');
      return [];
    }

    // 验证每篇文章
    const validItems = parsed.filter(isValidItem);

    if (validItems.length !== parsed.length) {
      console.warn(`[storage] 过滤了 ${parsed.length - validItems.length} 篇无效的文章`);
    }

    console.log('[storage] 加载文章:', validItems.length, '篇');
    return validItems;
  } catch (err) {
    console.error('[storage] 加载文章失败:', err);
    return [];
  }
}

export function saveViewMode(mode: ViewMode): void {
  localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);
}

export function loadViewMode(): ViewMode {
  return (localStorage.getItem(STORAGE_KEYS.VIEW_MODE) as ViewMode) || 'all';
}

export function saveSelectedFeed(feedId: string | null): void {
  if (feedId) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_FEED, feedId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_FEED);
  }
}

export function loadSelectedFeed(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_FEED);
}

export function saveTranslations(translations: TranslationCache): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify(translations));
    console.log('[storage] 保存翻译缓存:', Object.keys(translations).length, '条');
  } catch (err) {
    console.error('[storage] 保存翻译缓存失败:', err);
    // 如果存储空间不足，可以尝试清理旧的翻译
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      console.warn('[storage] 存储空间不足，清理旧翻译缓存');
      const trimmed = trimOldTranslations(translations, 50);
      try {
        localStorage.setItem(STORAGE_KEYS.TRANSLATIONS, JSON.stringify(trimmed));
      } catch {
        // 仍然失败则放弃保存
      }
    }
  }
}

export function saveAIConfig(config: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AI_CONFIG, JSON.stringify(config));
    console.log('[storage] 保存 AI 配置成功');
  } catch (err) {
    console.error('[storage] 保存 AI 配置失败:', err);
  }
}

export function loadAIConfig(): AIConfig | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.AI_CONFIG);
    if (!data) return null;
    return JSON.parse(data);
  } catch (err) {
    console.error('[storage] 加载 AI 配置失败:', err);
    return null;
  }
}
export function loadTranslations(): TranslationCache {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSLATIONS);
    if (!data) {
      console.log('[storage] 没有保存的翻译缓存');
      return {};
    }
    const translations = JSON.parse(data);
    console.log('[storage] 加载翻译缓存:', Object.keys(translations).length, '条');
    return translations;
  } catch (err) {
    console.error('[storage] 加载翻译缓存失败:', err);
    return {};
  }
}

// 清理旧的翻译缓存，只保留最新的 N 条
function trimOldTranslations(translations: TranslationCache, keepCount: number): TranslationCache {
  const entries = Object.entries(translations);
  if (entries.length <= keepCount) return translations;

  // 按翻译时间排序，保留最新的
  entries.sort((a, b) => (b[1].translatedAt || 0) - (a[1].translatedAt || 0));
  const trimmed = entries.slice(0, keepCount);
  return Object.fromEntries(trimmed);
}
