import type { RSSItem } from '@/types';

export interface ParsedFeed {
  title: string;
  description?: string;
  items: Array<{
    title?: string;
    link?: string;
    content?: string;
    contentSnippet?: string;
    pubDate?: string;
    author?: string;
    categories?: string[];
    guid?: string;
  }>;
}

// 常见的 RSS 路径后缀，用于自动探测
const RSS_SUFFIXES = [
  '',           // 原始 URL
  '/feed',
  '/feed/',
  '/rss',
  '/rss/',
  '/index.xml',
  '/feed.xml',
  '/rss.xml',
  '?format=rss',
  '?format=atom',
  '/atom',
  '/atom.xml',
];

// 快速 CORS 代理列表
const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const FETCH_TIMEOUT = 15000; // 15 秒超时

function parseXML(xmlText: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlText, 'application/xml');
}

function getTextContent(element: Element | null, tagName: string): string | undefined {
  if (!element) return undefined;
  const child = element.getElementsByTagName(tagName)[0];
  return child?.textContent?.trim() || undefined;
}

// 带超时的 fetch
async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// 尝试通过代理获取内容
async function fetchWithProxy(url: string): Promise<string> {
  let lastError: Error | null = null;
  
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(url);
      const response = await fetchWithTimeout(proxyUrl, FETCH_TIMEOUT);
      
      if (response.ok) {
        return await response.text();
      }
    } catch (err) {
      lastError = err as Error;
      continue;
    }
  }
  
  throw new Error(`无法获取订阅内容: ${lastError?.message || '网络错误'}`);
}

// 尝试解析单个 URL
async function tryParseUrl(url: string): Promise<ParsedFeed | null> {
  try {
    const xmlText = await fetchWithProxy(url);
    const doc = parseXML(xmlText);
    
    // 检查解析错误
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      return null;
    }
    
    // 检测订阅类型
    const rssElement = doc.querySelector('rss');
    const feedElement = doc.querySelector('feed');
    const rdfElement = doc.getElementsByTagName('rdf:RDF')[0] || doc.getElementsByTagName('RDF')[0];
    
    let title = '未命名订阅';
    let description: string | undefined;
    let items: ParsedFeed['items'] = [];
    
    if (rssElement) {
      // RSS 2.0
      const channel = rssElement.querySelector('channel');
      title = getTextContent(channel, 'title') || '未命名订阅';
      description = getTextContent(channel, 'description');
      
      const itemElements = channel?.getElementsByTagName('item') || [];
      items = Array.from(itemElements).map(item => ({
        title: getTextContent(item, 'title'),
        link: getTextContent(item, 'link'),
        content: getTextContent(item, 'content:encoded') || getTextContent(item, 'description'),
        contentSnippet: getTextContent(item, 'description')?.substring(0, 300),
        pubDate: getTextContent(item, 'pubDate') || getTextContent(item, 'dc:date'),
        author: getTextContent(item, 'author') || getTextContent(item, 'dc:creator'),
        categories: Array.from(item.getElementsByTagName('category')).map(c => c.textContent || '').filter(Boolean),
        guid: getTextContent(item, 'guid'),
      }));
    } else if (feedElement) {
      // Atom
      title = getTextContent(feedElement, 'title') || '未命名订阅';
      description = getTextContent(feedElement, 'subtitle');
      
      const entryElements = feedElement.getElementsByTagName('entry');
      items = Array.from(entryElements).map(entry => {
        const linkElement = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
        const link = linkElement?.getAttribute('href') || undefined;
        
        return {
          title: getTextContent(entry, 'title'),
          link,
          content: getTextContent(entry, 'content') || getTextContent(entry, 'summary'),
          contentSnippet: getTextContent(entry, 'summary')?.substring(0, 300),
          pubDate: getTextContent(entry, 'published') || getTextContent(entry, 'updated'),
          author: getTextContent(entry, 'author') || getTextContent(entry, 'name'),
          categories: Array.from(entry.getElementsByTagName('category')).map(c => c.getAttribute('term') || '').filter(Boolean),
          guid: getTextContent(entry, 'id'),
        };
      });
    } else if (rdfElement) {
      // RSS 1.0 / RDF
      title = getTextContent(rdfElement, 'title') || '未命名订阅';
      description = getTextContent(rdfElement, 'description');
      
      const itemElements = rdfElement.getElementsByTagName('item');
      items = Array.from(itemElements).map(item => ({
        title: getTextContent(item, 'title'),
        link: getTextContent(item, 'link'),
        content: getTextContent(item, 'description'),
        contentSnippet: getTextContent(item, 'description')?.substring(0, 300),
        pubDate: getTextContent(item, 'date'),
        author: getTextContent(item, 'creator'),
        categories: [],
        guid: getTextContent(item, 'about') || getTextContent(item, 'link'),
      }));
    } else {
      return null;
    }
    
    return { title, description, items };
  } catch {
    return null;
  }
}

// 主解析函数 - 尝试原始 URL 和各种后缀
export async function parseRSSFeed(url: string): Promise<ParsedFeed> {
  const baseUrl = url.trim().replace(/\/$/, ''); // 移除末尾斜杠
  
  // 首先尝试原始 URL
  const directResult = await tryParseUrl(baseUrl);
  if (directResult && directResult.items.length > 0) {
    return directResult;
  }
  
  // 如果原始 URL 失败，尝试各种后缀
  const suffixPromises = RSS_SUFFIXES.slice(1).map(async (suffix) => {
    try {
      const result = await tryParseUrl(baseUrl + suffix);
      if (result && result.items.length > 0) {
        return result;
      }
    } catch {
      // 忽略单个后缀的错误
    }
    return null;
  });
  
  // 使用 Promise.race 获取最快成功的结果
  const results = await Promise.all(suffixPromises);
  const successfulResult = results.find(r => r !== null);
  
  if (successfulResult) {
    return successfulResult;
  }
  
  // 如果都失败了，抛出错误
  throw new Error('无法解析该订阅源，请检查 URL 是否正确');
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function convertToRSSItems(
  parsedItems: ParsedFeed['items'],
  feedId: string
): RSSItem[] {
  return parsedItems.map((item, index) => ({
    id: `${feedId}-${item.guid || index}-${Date.now()}`,
    feedId,
    title: item.title || '无标题',
    link: item.link || '',
    description: item.contentSnippet || item.content?.substring(0, 200) || '',
    content: item.content || item.contentSnippet || '',
    pubDate: item.pubDate,
    author: item.author,
    categories: item.categories,
    isRead: false,
    isStarred: false,
  }));
}
