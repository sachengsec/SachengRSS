import { toast } from 'sonner';
import { loadAIConfig } from './storage';

// 默认配置（环境变量作为后备）
const DEFAULT_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3.2';

// 动态获取 AI 配置
function getAIConfig() {
  const customConfig = loadAIConfig();
  const envKey = import.meta.env.VITE_SILICONFLOW_API_KEY;

  const config = {
    apiUrl: customConfig?.apiUrl?.trim() || DEFAULT_API_URL,
    apiKey: customConfig?.apiKey?.trim() || envKey || '',
    model: customConfig?.model?.trim() || DEFAULT_MODEL,
  };

  // 补全 URL 协议和路径（如果是简写的 host）
  if (config.apiUrl && !config.apiUrl.startsWith('http')) {
    config.apiUrl = `https://${config.apiUrl}`;
  }
  if (config.apiUrl.endsWith('/')) {
    config.apiUrl = config.apiUrl.slice(0, -1);
  }
  // 如果输入的是 base url (例如 api.siliconflow.cn/v1)，则补充 chat completions 路径
  if (!config.apiUrl.endsWith('/chat/completions')) {
    config.apiUrl = `${config.apiUrl}${config.apiUrl.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
  }

  return config;
}

// 检查是否配置了 API 密钥
export function hasAIConfigured(): boolean {
  return !!getAIConfig().apiKey;
}

// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 60000;

// 创建带超时的 fetch 请求
async function fetchWithTimeout(url: string, options: RequestInit, timeout = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    throw error;
  }
}

export interface TranslationResult {
  paragraphs: Array<{
    original: string;
    translated: string;
  }>;
}

// 将 HTML 内容分割成段落
function splitIntoParagraphs(htmlContent: string): string[] {
  // 创建临时 DOM 元素来解析 HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  const paragraphs: string[] = [];

  // 遍历所有子元素
  const traverse = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text && text.length > 0) {
        paragraphs.push(text);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      // 跳过脚本和样式标签
      if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'NAV') {
        return;
      }
      // 对于段落、标题等块级元素，直接提取文本
      if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'SECTION', 'ARTICLE', 'TD'].includes(element.tagName)) {
        const text = element.textContent?.trim();
        if (text && text.length > 0) {
          paragraphs.push(text);
        }
      } else {
        // 递归遍历子元素
        Array.from(node.childNodes).forEach(traverse);
      }
    }
  };

  Array.from(tempDiv.childNodes).forEach(traverse);

  // 如果没有提取到段落，尝试直接将整个文本内容作为一个段落
  if (paragraphs.length === 0) {
    const plainText = tempDiv.textContent?.trim();
    if (plainText && plainText.length > 0) {
      paragraphs.push(plainText);
    }
  }

  // 过滤掉太短的段落（可能是格式符号），但保留至少有意义的内容
  return paragraphs.filter((p: string) => p.length > 5);
}

// 合并短段落，避免请求过多
function mergeParagraphs(paragraphs: string[], maxLength: number = 2000): string[] {
  const merged: string[] = [];
  let current = '';
  
  for (const p of paragraphs) {
    if ((current + p).length > maxLength && current.length > 0) {
      merged.push(current.trim());
      current = p;
    } else {
      current += '\n\n' + p;
    }
  }
  
  if (current.trim()) {
    merged.push(current.trim());
  }
  
  return merged;
}

export async function translateContent(
  content: string,
  _title: string,
  onProgress?: (translatedPart: { original: string; translated: string }) => void
): Promise<TranslationResult | null> {
  const config = getAIConfig();
  // 检查 API 密钥
  if (!config.apiKey) {
    toast.error('翻译功能未配置：请在左下角设置中配置 API Key，或设置 VITE_SILICONFLOW_API_KEY 环境变量');
    return null;
  }

  try {
    // 分割段落
    const paragraphs = splitIntoParagraphs(content);

    if (paragraphs.length === 0) {
      toast.error('没有可翻译的内容');
      return null;
    }

    // 合并段落以减少请求次数
    const mergedParagraphs = mergeParagraphs(paragraphs);

    const translatedParagraphs: Array<{ original: string; translated: string }> = [];

    // 逐段翻译
    for (let i = 0; i < mergedParagraphs.length; i++) {
      const paragraph = mergedParagraphs[i];

      const response = await fetchWithTimeout(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a professional translator. Translate the following English text to Chinese. Keep the original meaning and style. Only return the translation, no explanations.'
            },
            {
              role: 'user',
              content: paragraph
            }
          ],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        let errorMessage = `API 错误 (${response.status})`;
        try {
          const errorData = await response.json();
          console.error('Translation API error:', errorData);
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          // 如果无法解析 JSON，使用状态文本
          errorMessage = response.statusText || errorMessage;
        }
        toast.error(`翻译失败: ${errorMessage}`);
        return null;
      }

      const data = await response.json();

      // 验证响应数据结构
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('Invalid API response structure:', data);
        toast.error('翻译失败: API 返回数据格式异常');
        return null;
      }

      const translatedText = data.choices[0]?.message?.content?.trim();

      if (translatedText) {
        // 将合并的段落重新拆分
        const originalParts = paragraph.split('\n\n').filter((p: string) => p.trim());
        const translatedParts = translatedText.split('\n\n').filter((p: string) => p.trim());

        // 如果拆分后的数量匹配，逐段对应
        if (originalParts.length === translatedParts.length) {
          for (let j = 0; j < originalParts.length; j++) {
            const part = {
              original: originalParts[j],
              translated: translatedParts[j],
            };
            translatedParagraphs.push(part);
            if (onProgress) {
              onProgress(part);
            }
          }
        } else {
          // 如果不匹配，将整个段落作为一个整体
          const part = {
            original: paragraph,
            translated: translatedText,
          };
          translatedParagraphs.push(part);
          if (onProgress) {
            onProgress(part);
          }
        }
      }

      // 可选：如果不使用回调，仍然保留 toast 进度提示作为 fallback
      if (!onProgress && mergedParagraphs.length > 1) {
        toast.info(`翻译进度: ${i + 1}/${mergedParagraphs.length}`, { duration: 1000 });
      }
    }

    return { paragraphs: translatedParagraphs };
  } catch (error) {
    console.error('Translation error:', error);
    toast.error('翻译失败，请检查网络连接');
    return null;
  }
}

// 翻译标题
export async function translateTitle(title: string): Promise<string | null> {
  const config = getAIConfig();
  // 检查 API 密钥
  if (!config.apiKey) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the following English title to Chinese. Keep it concise and natural.'
          },
          {
            role: 'user',
            content: title
          }
        ],
        temperature: 0.3,
        max_tokens: 256,
      }),
    }, 30000); // 标题翻译使用 30 秒超时

    if (!response.ok) {
      console.error('Title translation API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    // 验证响应数据结构
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('Invalid API response structure for title:', data);
      return null;
    }

    return data.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('Title translation error:', error);
    return null;
  }
}
