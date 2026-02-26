import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Star,
  EyeOff,
  CheckCheck,
  Search,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import type { RSSItem, RSSFeed } from '@/types';

interface ArticleListProps {
  items: RSSItem[];
  feeds: RSSFeed[];
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  onMarkAllAsRead: () => void;
  onToggleStar: (itemId: string) => void;
  isMobile?: boolean;
  onBack?: () => void;
}

export function ArticleList({
  items,
  feeds,
  selectedItemId,
  onSelectItem,
  onMarkAllAsRead,
  onToggleStar,
  isMobile,
  onBack,
}: ArticleListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFeedTitle = (feedId: string) => {
    return feeds.find((f) => f.id === feedId)?.title || '未知订阅';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  return (
    <div className={`${isMobile ? 'w-full' : 'w-80'} h-full border-r bg-background flex flex-col`}>
      {/* 头部 */}
      <div className="p-3 border-b space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {isMobile && onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 mr-2" onClick={onBack}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <h2 className="font-semibold text-sm flex-1">
            文章 ({filteredItems.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onMarkAllAsRead}
            disabled={filteredItems.length === 0}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            {!isMobile && '全部标为已读'}
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文章..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 文章列表 - 使用原生滚动 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="divide-y">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedItemId === item.id ? 'bg-muted' : ''
              } ${!item.isRead ? 'bg-primary/5' : ''}`}
              onClick={() => onSelectItem(item.id)}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <h3
                      className={`text-sm leading-tight line-clamp-2 ${
                        !item.isRead ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {item.title}
                    </h3>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="truncate max-w-[120px]">
                      {getFeedTitle(item.feedId)}
                    </span>
                    {item.pubDate && (
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDate(item.pubDate)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${
                      item.isStarred ? 'text-yellow-500' : 'opacity-0 group-hover:opacity-100'
                    } ${isMobile && !item.isStarred ? 'opacity-100' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar(item.id);
                    }}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={item.isStarred ? 'currentColor' : 'none'}
                    />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? (
                <>
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>未找到文章</p>
                </>
              ) : (
                <>
                  <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>暂无文章</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
