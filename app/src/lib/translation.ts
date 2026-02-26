import { toast } from 'sonner';
import { loadAIConfig } from './storage';

// 默认配置（环境变量作为后备）
const DEFAULT_API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3.2';

// 动态获取 AI 配置
function getAIConfig() {
  const customConfig = loadAIConfig();
  const envKey = import.meta.env.VITE_SILICONFLOW_API_KEY;

  const apiUrl = customConfig?.apiUrl?.trim() || DEFAULT_API_URL;
  const apiKey = customConfig?.apiKey?.trim() || envKey || '';
  const model = customConfig?.model?.trim() || DEFAULT_MODEL;

  return { apiUrl, apiKey, model };
}

// 检查是否配置了 API 密钥
export function hasAIConfigured(): boolean {
  return !!getAIConfig().apiKey;
}

// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 120000;

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

// 从 HTML 中提取纯文本内容
function extractTextFromHtml(htmlContent: string): string {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  // 移除脚本和样式标签
  const scripts = tempDiv.querySelectorAll('script, style, nav');
  scripts.forEach(el => el.remove());

  return tempDiv.textContent?.trim() || '';
}

// 翻译整篇文章内容
export async function translateContent(
  content: string,
  title: string
): Promise<string | null> {
  const config = getAIConfig();
  // 检查 API 密钥
  if (!config.apiKey) {
    toast.error('翻译功能未配置：请在左下角设置中配置 API Key，或设置 VITE_SILICONFLOW_API_KEY 环境变量');
    return null;
  }

  try {
    // 提取纯文本内容
    const textContent = extractTextFromHtml(content);

    if (!textContent || textContent.length < 10) {
      toast.error('没有可翻译的内容');
      return null;
    }

    // 构建请求头（本地 API 不需要 Authorization）
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetchWithTimeout(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the following article from English to Chinese. Keep the original meaning and style. Return only the translated text without any explanations or notes.'
          },
          {
            role: 'user',
            content: `Title: ${title}\n\nContent:\n${textContent}`
          }
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      let errorMessage = `API 错误 (${response.status})`;

      // 处理常见 HTTP 错误
      if (response.status === 503) {
        errorMessage = 'AI 服务暂时不可用 (503)，请稍后重试';
      } else if (response.status === 429) {
        errorMessage = '请求过于频繁 (429)，请稍后再试';
      } else if (response.status === 401) {
        errorMessage = 'API Key 无效或已过期 (401)';
      } else if (response.status === 500) {
        errorMessage = 'AI 服务内部错误 (500)，请稍后重试';
      } else {
        try {
          const errorData = await response.json();
          console.error('Translation API error:', errorData);
          errorMessage = errorData.error?.message || errorData.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
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

    if (!translatedText) {
      toast.error('翻译失败: 返回内容为空');
      return null;
    }

    return translatedText;
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
