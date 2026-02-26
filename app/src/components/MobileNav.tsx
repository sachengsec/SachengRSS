import { Button } from '@/components/ui/button';
import { List, FileText, Settings } from 'lucide-react';

type MobileView = 'sidebar' | 'list' | 'article';

interface MobileNavProps {
  currentView: MobileView;
  onViewChange: (view: MobileView) => void;
  unreadCount: number;
}

export function MobileNav({ currentView, onViewChange, unreadCount }: MobileNavProps) {
  return (
    <div className="border-t bg-background px-2 py-2 flex items-center justify-around">
      <Button
        variant={currentView === 'sidebar' ? 'default' : 'ghost'}
        size="sm"
        className="flex flex-col items-center gap-1 h-auto py-2 px-3"
        onClick={() => onViewChange('sidebar')}
      >
        <Settings className="h-5 w-5" />
        <span className="text-xs">订阅</span>
      </Button>

      <Button
        variant={currentView === 'list' ? 'default' : 'ghost'}
        size="sm"
        className="flex flex-col items-center gap-1 h-auto py-2 px-3 relative"
        onClick={() => onViewChange('list')}
      >
        <List className="h-5 w-5" />
        <span className="text-xs">文章</span>
        {unreadCount > 0 && currentView !== 'list' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      <Button
        variant={currentView === 'article' ? 'default' : 'ghost'}
        size="sm"
        className="flex flex-col items-center gap-1 h-auto py-2 px-3"
        onClick={() => onViewChange('article')}
        disabled={currentView === 'sidebar' || currentView === 'list'}
      >
        <FileText className="h-5 w-5" />
        <span className="text-xs">阅读</span>
      </Button>
    </div>
  );
}
