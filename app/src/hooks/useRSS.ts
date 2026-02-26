import { useState, useEffect, useCallback, useRef } from 'react';
import type { RSSFeed, RSSItem, ViewMode, TranslationCache } from '@/types';
import { parseRSSFeed, convertToRSSItems, generateId } from '@/lib/rssParser';
import {
  saveFeeds,
  loadFeeds,
  saveItems,
  loadItems,
  saveViewMode,
  loadViewMode,
  saveSelectedFeed,
  loadSelectedFeed,
  saveTranslations,
  loadTranslations,
} from '@/lib/storage';

// 并发控制 - 同时最多 10 个请求
const CONCURRENT_REQUESTS = 10;

export function useRSS() {
  const [feeds, setFeeds] = useState<RSSFeed[]>([]);
  const [items, setItems] = useState<RSSItem[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  const abortControllersRef = useRef<AbortController[]>([]);
  const addFeedAbortRef = useRef<AbortController | null>(null);
  const isDataLoadedRef = useRef(false);
  const isInitialLoadCompleteRef = useRef(false);

  // 加载本地数据 - 只在组件挂载时执行一次（使用 ref 防止 StrictMode 重复加载）
  useEffect(() => {
    // 防止重复加载（React StrictMode 会双重挂载）
    if (isDataLoadedRef.current) {
      console.log('[useRSS] 数据已加载，跳过重复加载');
      return;
    }

    try {
      const savedFeeds = loadFeeds();
      const savedItems = loadItems();
      const savedViewMode = loadViewMode();
      const savedSelectedFeed = loadSelectedFeed();
      const savedTranslations = loadTranslations();

      console.log('[useRSS] 从 localStorage 加载数据:', {
        feeds: savedFeeds.length,
        items: savedItems.length,
        viewMode: savedViewMode,
        selectedFeed: savedSelectedFeed,
        translations: Object.keys(savedTranslations).length
      });

      isDataLoadedRef.current = true;
      setFeeds(savedFeeds);
      setItems(savedItems);
      setViewMode(savedViewMode);
      setSelectedFeedId(savedSelectedFeed);
      setTranslationCache(savedTranslations);

      // 延迟标记初始加载完成，确保 state 已经更新
      setTimeout(() => {
        isInitialLoadCompleteRef.current = true;
        console.log('[useRSS] 初始加载完成');
      }, 0);
    } catch (err) {
      console.error('[useRSS] 加载本地数据失败:', err);
    }
  }, []);

  // 保存到本地存储 - 只在初始加载完成后执行
  useEffect(() => {
    // 跳过初始加载前的保存，防止覆盖已有数据
    if (!isInitialLoadCompleteRef.current) {
      console.log('[useRSS] 初始加载未完成，跳过保存 feeds');
      return;
    }
    saveFeeds(feeds);
    console.log('[useRSS] 保存 feeds:', feeds.length);
  }, [feeds]);

  useEffect(() => {
    // 跳过初始加载前的保存，防止覆盖已有数据
    if (!isInitialLoadCompleteRef.current) {
      console.log('[useRSS] 初始加载未完成，跳过保存 items');
      return;
    }
    saveItems(items);
    console.log('[useRSS] 保存 items:', items.length);
  }, [items]);

  useEffect(() => {
    saveViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    saveSelectedFeed(selectedFeedId);
  }, [selectedFeedId]);

  // 保存翻译缓存
  useEffect(() => {
    if (!isInitialLoadCompleteRef.current) {
      console.log('[useRSS] 初始加载未完成，跳过保存 translations');
      return;
    }
    saveTranslations(translationCache);
    console.log('[useRSS] 保存 translations:', Object.keys(translationCache).length);
  }, [translationCache]);

  // 添加翻译到缓存
  const addTranslation = useCallback((itemId: string, title: string | null, paragraphs: Array<{ original: string; translated: string }>) => {
    setTranslationCache(prev => ({
      ...prev,
      [itemId]: {
        title,
        paragraphs,
        translatedAt: Date.now()
      }
    }));
  }, []);

  // 清除翻译缓存
  const clearTranslation = useCallback((itemId: string) => {
    setTranslationCache(prev => {
      const { [itemId]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // 取消添加订阅
  const cancelAddFeed = useCallback(() => {
    if (addFeedAbortRef.current) {
      addFeedAbortRef.current.abort();
      addFeedAbortRef.current = null;
    }
    setIsLoading(false);
    setError(null);
  }, []);

  // 批量添加订阅源 (支持进度回调和取消)
  const addFeedsBatch = useCallback(async (
    urls: string[],
    onProgress?: (current: number, total: number) => void
  ) => {
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // 验证和过滤 URL
    const existingUrls = new Set(feeds.map(f => f.url));
    const validUrls: string[] = [];

    for (const url of urls) {
      // 验证 URL 格式
      try {
        const urlObj = new URL(url.trim());
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          results.failed++;
          results.errors.push(`${url}: 只支持 HTTP 和 HTTPS 协议`);
          continue;
        }
      } catch {
        results.failed++;
        results.errors.push(`${url}: URL 格式无效`);
        continue;
      }

      // 检查是否已存在
      if (existingUrls.has(url.trim())) {
        results.skipped++;
        continue;
      }

      validUrls.push(url.trim());
    }

    const newUrls = validUrls;

    if (newUrls.length === 0) {
      return results;
    }

    // 设置 AbortController 支持中途取消
    if (addFeedAbortRef.current) {
      addFeedAbortRef.current.abort();
    }
    const controller = new AbortController();
    addFeedAbortRef.current = controller;

    setIsLoading(true);

    const total = newUrls.length;
    let completed = 0;

    // 并发控制函数 (最多同时进行 10 个请求)
    const MAX_CONCURRENT = 10;
    const executeBatch = async () => {
      let index = 0;

      const worker = async () => {
        while (index < newUrls.length) {
          if (controller.signal.aborted) {
            break;
          }

          const currentUrl = newUrls[index++];

          try {
            const parsed = await Promise.race([
              parseRSSFeed(currentUrl),
              new Promise<never>((_, reject) => {
                controller.signal.addEventListener('abort', () => reject(new Error('已取消')));
              }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error('请求超时')), 30000))
            ]);

            if (controller.signal.aborted) throw new Error('已取消');

            if (!parsed.items.length) {
              results.failed++;
              results.errors.push(`${currentUrl}: 该订阅源没有文章`);
            } else {
              const newFeed: RSSFeed = {
                id: generateId(),
                title: parsed.title,
                url: currentUrl,
                description: parsed.description,
                lastUpdated: Date.now(),
              };

              // 实时更新状态
              setFeeds(prev => [newFeed, ...prev]);

              const newItems = convertToRSSItems(parsed.items, newFeed.id);
              setItems(prev => [...newItems, ...prev]);

              results.success++;
            }
          } catch (err) {
            if (err instanceof Error && err.message === '已取消') {
              break;
            }
            results.failed++;
            results.errors.push(`${currentUrl}: ${err instanceof Error ? err.message : '添加失败'}`);
          } finally {
            completed++;
            if (onProgress && !controller.signal.aborted) {
              onProgress(completed, total);
            }
          }
        }
      };

      // 启动指定数量的 worker
      const workers = Array(Math.min(MAX_CONCURRENT, newUrls.length))
        .fill(null)
        .map(() => worker());

      await Promise.all(workers);
    };

    try {
      await executeBatch();
    } finally {
      if (!controller.signal.aborted) {
        addFeedAbortRef.current = null;
      }
      setIsLoading(false);
    }

    return results;
  }, [feeds]);

  // 添加订阅 - 支持取消
  const addFeed = useCallback(async (url: string) => {
    // 验证 URL 格式
    let validatedUrl: string;
    try {
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('只支持 HTTP 和 HTTPS 协议的 URL');
      }
      validatedUrl = url.trim();
    } catch {
      throw new Error('无效的 URL 格式');
    }

    // 如果已有进行中的请求，先取消
    if (addFeedAbortRef.current) {
      addFeedAbortRef.current.abort();
    }

    const controller = new AbortController();
    addFeedAbortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      // 检查是否已存在
      const existingFeed = feeds.find(f => f.url === validatedUrl);
      if (existingFeed) {
        throw new Error('该订阅源已存在');
      }

      // 检查是否被取消
      if (controller.signal.aborted) {
        throw new Error('已取消');
      }

      const parsed = await Promise.race([
        parseRSSFeed(url),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('已取消'));
          });
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('请求超时')), 30000);
        }),
      ]);
      
      // 检查是否被取消
      if (controller.signal.aborted) {
        throw new Error('已取消');
      }
      
      if (!parsed.items.length) {
        throw new Error('该订阅源没有文章');
      }

      const newFeed: RSSFeed = {
        id: generateId(),
        title: parsed.title,
        url,
        description: parsed.description,
        lastUpdated: Date.now(),
      };

      setFeeds(prev => [newFeed, ...prev]);
      
      const newItems = convertToRSSItems(parsed.items, newFeed.id);
      setItems(prev => [...newItems, ...prev]);
      
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '添加订阅失败';
      // 取消不算错误
      if (errorMsg === '已取消') {
        return false;
      }
      setError(errorMsg);
      return false;
    } finally {
      addFeedAbortRef.current = null;
      setIsLoading(false);
    }
  }, [feeds]);

  // 删除订阅
  const removeFeed = useCallback((feedId: string) => {
    setFeeds(prev => prev.filter(f => f.id !== feedId));
    setItems(prev => prev.filter(i => i.feedId !== feedId));
    if (selectedFeedId === feedId) {
      setSelectedFeedId(null);
    }
  }, [selectedFeedId]);

  // 刷新单个订阅 - 带超时控制
  const refreshFeed = useCallback(async (feedId: string) => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;

    const controller = new AbortController();
    abortControllersRef.current.push(controller);

    try {
      const parsed = await Promise.race([
        parseRSSFeed(feed.url),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('请求超时')), 30000);
        }),
      ]);
      
      const newItems = convertToRSSItems(parsed.items, feedId);
      
      setItems(prev => {
        const filtered = prev.filter(i => i.feedId !== feedId);
        // 保留已读和收藏状态
        const merged = newItems.map(newItem => {
          const existing = prev.find(i => i.link === newItem.link);
          if (existing) {
            return { ...newItem, isRead: existing.isRead, isStarred: existing.isStarred };
          }
          return newItem;
        });
        return [...merged, ...filtered];
      });
      
      setFeeds(prev =>
        prev.map(f =>
          f.id === feedId ? { ...f, lastUpdated: Date.now() } : f
        )
      );
    } catch (err) {
      console.error('Refresh feed error:', err);
    } finally {
      abortControllersRef.current = abortControllersRef.current.filter(c => c !== controller);
    }
  }, [feeds]);

  // 批量刷新所有订阅 - 带并发控制和进度
  const refreshAllFeeds = useCallback(async () => {
    if (feeds.length === 0) return;

    setIsLoading(true);
    setRefreshProgress({ current: 0, total: feeds.length });
    setError(null);

    let completedCount = 0;

    try {
      // 分批处理，控制并发数
      for (let i = 0; i < feeds.length; i += CONCURRENT_REQUESTS) {
        const batch = feeds.slice(i, i + CONCURRENT_REQUESTS);
        await Promise.all(
          batch.map(async (feed) => {
            await refreshFeed(feed.id);
            completedCount++;
            setRefreshProgress({ current: completedCount, total: feeds.length });
          })
        );
      }
    } catch (err) {
      console.error('Refresh all error:', err);
    } finally {
      setIsLoading(false);
      setRefreshProgress(null);
    }
  }, [feeds, refreshFeed]);

  // 标记已读
  const markAsRead = useCallback((itemId: string, isRead: boolean = true) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, isRead } : item
      )
    );
  }, []);

  // 全部标记已读
  const markAllAsRead = useCallback((feedId?: string) => {
    setItems(prev =>
      prev.map(item =>
        (!feedId || item.feedId === feedId) ? { ...item, isRead: true } : item
      )
    );
  }, []);

  // 切换收藏
  const toggleStar = useCallback((itemId: string) => {
    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, isStarred: !item.isStarred } : item
      )
    );
  }, []);

  // 过滤文章
  const filteredItems = items.filter(item => {
    if (viewMode === 'unread') return !item.isRead;
    if (viewMode === 'starred') return item.isStarred;
    return true;
  }).filter(item => {
    if (selectedFeedId) return item.feedId === selectedFeedId;
    return true;
  });

  const unreadCount = items.filter(i => !i.isRead).length;
  const starredCount = items.filter(i => i.isStarred).length;

  return {
    feeds,
    items,
    filteredItems,
    viewMode,
    selectedFeedId,
    selectedItemId,
    isLoading,
    refreshProgress,
    error,
    unreadCount,
    starredCount,
    translationCache,
    setViewMode,
    setSelectedFeedId,
    setSelectedItemId,
    addFeed,
    addFeedsBatch,
    cancelAddFeed,
    removeFeed,
    refreshFeed,
    refreshAllFeeds,
    markAsRead,
    markAllAsRead,
    toggleStar,
    addTranslation,
    clearTranslation,
  };
}
