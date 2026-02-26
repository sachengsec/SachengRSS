export interface OPMLFeed {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  description?: string;
}

/**
 * 解析 OPML 文件内容
 * @param opmlContent OPML 文件的 XML 字符串
 * @returns 解析出的 RSS 订阅源列表
 */
export function parseOPML(opmlContent: string): OPMLFeed[] {
  const feeds: OPMLFeed[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(opmlContent, 'text/xml');

    // 检查解析错误
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('OPML 文件格式错误');
    }

    // 获取所有 outline 元素
    const outlines = doc.querySelectorAll('outline');

    for (const outline of outlines) {
      const xmlUrl = outline.getAttribute('xmlUrl');

      // 只处理有 xmlUrl 的节点（RSS 订阅源）
      if (xmlUrl) {
        const feed: OPMLFeed = {
          title: outline.getAttribute('title') ||
                 outline.getAttribute('text') ||
                 '未命名订阅',
          xmlUrl: xmlUrl,
          htmlUrl: outline.getAttribute('htmlUrl') || undefined,
          description: outline.getAttribute('description') || undefined,
        };
        feeds.push(feed);
      }
    }

    return feeds;
  } catch (error) {
    console.error('解析 OPML 失败:', error);
    throw error;
  }
}

/**
 * 读取 OPML 文件
 * @param file 用户选择的文件对象
 * @returns 解析出的 RSS 订阅源列表
 */
export function readOPMLFile(file: File): Promise<OPMLFeed[]> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith('.opml') && !file.name.endsWith('.xml')) {
      reject(new Error('请选择 .opml 或 .xml 格式的文件'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) {
          throw new Error('文件内容为空');
        }
        const feeds = parseOPML(content);
        resolve(feeds);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };

    reader.readAsText(file);
  });
}

/**
 * 导出订阅源为 OPML 格式
 * @param feeds 订阅源列表
 * @param title OPML 标题
 * @returns OPML 格式的 XML 字符串
 */
export function exportToOPML(
  feeds: Array<{ title: string; url: string; description?: string }>,
  title: string = 'My RSS Feeds'
): string {
  const now = new Date().toUTCString();

  const outlines = feeds
    .map(
      (feed) => `    <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(
        feed.title
      )}" xmlUrl="${escapeXml(feed.url)}"${
        feed.description ? ` description="${escapeXml(feed.description)}"` : ''
      }/>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
    <dateCreated>${now}</dateCreated>
    <dateModified>${now}</dateModified>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

/**
 * 转义 XML 特殊字符
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
