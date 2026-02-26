import { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Star,
  Eye,
  EyeOff,
  ExternalLink,
  Clock,
  User,
  ChevronLeft,
  Languages,
  Loader2,
  X,
} from 'lucide-react';
import type { RSSItem, RSSFeed, TranslationCache } from '@/types';
import parseHTML, { Element } from 'html-react-parser';
import type { DOMNode } from 'html-react-parser';
import DOMPurify from 'dompurify';
import { translateContent, translateTitle } from '@/lib/translation';
import { toast } from 'sonner';

interface ArticleViewerProps {
  item: RSSItem | null;
  feed: RSSFeed | null;
  translationCache: TranslationCache;
  onMarkAsRead: (itemId: string, isRead: boolean) => void;
  onToggleStar: (itemId: string) => void;
  onAddTranslation: (itemId: string, title: string | null, paragraphs: Array<{ original: string; translated: string }>) => void;
  onClearTranslation: (itemId: string) => void;
  onBack?: () => void;
  isMobile?: boolean;
}

export function ArticleViewer({
  item,
  feed,
  translationCache,
  onMarkAsRead,
  onToggleStar,
  onAddTranslation,
  onClearTranslation,
  onBack,
  isMobile,
}: ArticleViewerProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // 从缓存中获取当前文章的翻译
  const cachedTranslation = item ? translationCache[item.id] : null;
  const hasTranslation = !!cachedTranslation;

  // 当文章切换时，重置显示状态
  useEffect(() => {
    setShowTranslation(false);
    setIsTranslating(false);
  }, [item?.id]);

  // 净化 HTML 内容，防止 XSS
  const sanitizedContent = useMemo(() => {
    if (!item?.content) return '';
    return DOMPurify.sanitize(item.content, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'b', 'i',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'blockquote',
        'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'div', 'span', 'hr'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'src', 'alt', 'class', 'style',
        'width', 'height', 'align', 'target'
      ],
      // 禁止事件处理器
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout'],
    });
  }, [item?.content]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'long',
    });
  };

  const handleOpenOriginal = () => {
    if (item?.link) {
      window.open(item.link, '_blank');
    }
  };

  const handleTranslate = useCallback(async () => {
    if (!item) return;

    // 如果缓存中有翻译，直接显示
    if (cachedTranslation) {
      setShowTranslation(true);
      return;
    }

    setIsTranslating(true);
    toast.info('正在翻译，请稍候...');

    try {
      // 翻译标题
      const titleResult = await translateTitle(item.title);

      // 翻译内容
      const contentToTranslate = item.content || item.description || '';
      let paragraphs: Array<{ original: string; translated: string }> = [];

      if (contentToTranslate) {
        const result = await translateContent(contentToTranslate, item.title);
        // 如果翻译失败或返回 null（比如没配置 API Key），立刻中止
        if (!result) {
          setIsTranslating(false);
          return;
        }
        paragraphs = result.paragraphs;
      } else {
        toast.error('没有可翻译的内容');
        setIsTranslating(false);
        return;
      }

      // 保存到缓存
      onAddTranslation(item.id, titleResult, paragraphs);
      setShowTranslation(true);
      toast.success('翻译完成');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('翻译失败');
    } finally {
      setIsTranslating(false);
    }
  }, [item, cachedTranslation, onAddTranslation]);

  const handleCloseTranslation = () => {
    setShowTranslation(false);
  };

  const handleClearTranslation = () => {
    if (item) {
      onClearTranslation(item.id);
    }
    setShowTranslation(false);
  };

  if (!item) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Eye className="h-8 w-8 opacity-50" />
          </div>
          <p className="text-lg font-medium">选择一篇文章阅读</p>
          <p className="text-sm mt-1">从左侧列表中选择</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-background">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-1">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2"
            onClick={() => onMarkAsRead(item.id, !item.isRead)}
          >
            {item.isRead ? (
              <>
                <EyeOff className="h-4 w-4" />
                {!isMobile && '标为未读'}
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                {!isMobile && '标为已读'}
              </>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {/* 翻译按钮 */}
          {hasTranslation ? (
            <Button
              variant={showTranslation ? 'default' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5"
              onClick={showTranslation ? handleCloseTranslation : handleTranslate}
            >
              <Languages className="h-4 w-4" />
              {showTranslation ? '隐藏翻译' : '显示翻译'}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleTranslate}
              disabled={isTranslating}
            >
              {isTranslating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Languages className="h-4 w-4" />
              )}
              {isTranslating ? '翻译中...' : '翻译'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${item.isStarred ? 'text-yellow-500' : ''}`}
            onClick={() => onToggleStar(item.id)}
          >
            <Star
              className="h-4 w-4"
              fill={item.isStarred ? 'currentColor' : 'none'}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleOpenOriginal}
            disabled={!item.link}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 文章内容 */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <article className={`max-w-3xl mx-auto ${isMobile ? 'px-4 py-4' : 'px-8 py-8'}`}>
          {/* 头部 */}
          <header className="mb-6">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {feed?.title || '未知订阅'}
              </Badge>
              {!item.isRead && (
                <Badge variant="default" className="text-xs">
                  未读
                </Badge>
              )}
              {item.isStarred && (
                <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  已收藏
                </Badge>
              )}
            </div>

            {/* 标题 - 双语显示 */}
            <h1 className={`font-bold leading-tight mb-3 ${isMobile ? 'text-xl' : 'text-3xl'}`}>
              {item.title}
            </h1>
            {cachedTranslation?.title && (
              <h2 className={`font-medium text-muted-foreground mb-3 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                {cachedTranslation.title}
              </h2>
            )}

            <div className={`flex flex-wrap items-center gap-3 text-sm text-muted-foreground ${isMobile ? 'text-xs' : ''}`}>
              {item.author && (
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span>{item.author}</span>
                </div>
              )}
              {item.pubDate && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>{formatDate(item.pubDate)}</span>
                </div>
              )}
            </div>

            {item.categories && item.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {item.categories.map((category, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {category}
                  </Badge>
                ))}
              </div>
            )}
          </header>

          <Separator className="my-4" />

          {/* 内容 - 双语对照显示 */}
          {showTranslation && cachedTranslation ? (
            <div className="space-y-6">
              {cachedTranslation.paragraphs.map((para, idx) => (
                <div key={idx} className="space-y-3">
                  {/* 原文 */}
                  <div className="text-muted-foreground text-sm border-l-2 border-muted pl-3">
                    {para.original}
                  </div>
                  {/* 译文 */}
                  <div className="text-foreground">
                    {para.translated}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="prose prose-slate max-w-none">
              {sanitizedContent ? (
                <div className={`rss-content ${isMobile ? 'text-sm' : ''}`}>
                  {parseHTML(sanitizedContent, {
                    replace: (domNode: DOMNode) => {
                      if (domNode instanceof Element && domNode.name === 'img' && domNode.attribs) {
                        return (
                          <img
                            src={domNode.attribs.src}
                            alt={domNode.attribs.alt}
                            className="max-w-full h-auto rounded-lg"
                            style={{ maxWidth: '100%' }}
                            loading="lazy"
                            onError={(e) => {
                              // 图片加载失败时隐藏
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        );
                      }
                    },
                  })}
                </div>
              ) : item.description ? (
                <p className={`leading-relaxed text-muted-foreground ${isMobile ? 'text-sm' : 'text-lg'}`}>
                  {item.description}
                </p>
              ) : (
                <p className="text-muted-italic">暂无内容</p>
              )}
            </div>
          )}

          {/* 底部 */}
          <Separator className="my-6" />
          
          <div className={`flex items-center justify-between ${isMobile ? 'flex-col gap-3' : ''}`}>
            <div className={`text-muted-foreground ${isMobile ? 'text-xs text-center' : 'text-sm'}`}>
              来源：{' '}
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {feed?.title || '原文链接'}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex gap-2">
              {cachedTranslation && (
                <Button variant="outline" size="sm" onClick={handleClearTranslation}>
                  <X className="h-4 w-4 mr-1" />
                  清除翻译
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleOpenOriginal} className={isMobile ? 'w-full' : ''}>
                在网站上阅读
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
