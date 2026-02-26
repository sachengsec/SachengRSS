import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ArticleList } from '@/components/ArticleList';
import { ArticleViewer } from '@/components/ArticleViewer';
import { MobileNav } from '@/components/MobileNav';
import { useRSS } from '@/hooks/useRSS';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import './App.css';

type MobileView = 'sidebar' | 'list' | 'article';

function App() {
  const [mobileView, setMobileView] = useState<MobileView>('sidebar');
  const [isInitialized, setIsInitialized] = useState(false);
  
  const {
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
  } = useRSS();

  // 初始化完成标记
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Show error toast
  useEffect(() => {
    if (error && isInitialized) {
      toast.error(error);
    }
  }, [error, isInitialized]);

  // Get selected item from all items (not filteredItems) to avoid disappearing when marked as read
  const selectedItem = selectedItemId
    ? items.find((i) => i.id === selectedItemId) || null
    : null;

  // Get feed for selected item
  const selectedItemFeed = selectedItem
    ? feeds.find((f) => f.id === selectedItem.feedId) || null
    : null;

  // Handle item selection - mark as read when selected
  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    markAsRead(itemId, true);
    setMobileView('article');
  };

  // Handle feed selection
  const handleSelectFeed = (feedId: string | null) => {
    setSelectedFeedId(feedId);
    setMobileView('list');
  };

  // Handle view mode change
  const handleViewModeChange = (mode: typeof viewMode) => {
    setViewMode(mode);
    setSelectedFeedId(null);
    setMobileView('list');
  };

  // 如果没有初始化完成，显示加载状态
  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 bg-background border rounded-lg px-6 py-4 shadow-lg min-w-[200px]">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">
                {refreshProgress ? `加载中 (${refreshProgress.current}/${refreshProgress.total})...` : '加载中...'}
              </span>
            </div>
            {refreshProgress && (
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:flex w-full h-full">
        {/* Sidebar */}
        <Sidebar
          feeds={feeds}
          viewMode={viewMode}
          selectedFeedId={selectedFeedId}
          unreadCount={unreadCount}
          starredCount={starredCount}
          isLoading={isLoading}
          onViewModeChange={setViewMode}
          onSelectFeed={setSelectedFeedId}
          onAddFeed={addFeed}
          onCancelAddFeed={cancelAddFeed}
          onRemoveFeed={removeFeed}
          onRefreshFeed={refreshFeed}
          onRefreshAll={refreshAllFeeds}
          onAddFeedsBatch={addFeedsBatch}
        />

        {/* Article List */}
        <ArticleList
          items={filteredItems}
          feeds={feeds}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onMarkAllAsRead={() => markAllAsRead(selectedFeedId || undefined)}
          onToggleStar={toggleStar}
        />

        {/* Article Viewer */}
        <ArticleViewer
          item={selectedItem}
          feed={selectedItemFeed}
          translationCache={translationCache}
          onMarkAsRead={markAsRead}
          onToggleStar={toggleStar}
          onAddTranslation={addTranslation}
          onClearTranslation={clearTranslation}
        />
      </div>

      {/* Mobile Layout */}
      <div className="flex md:hidden w-full h-full flex-col">
        {/* Mobile Content Area - 使用固定高度计算 */}
        <div className="flex-1 relative" style={{ height: 'calc(100vh - 64px)' }}>
          {/* Sidebar View */}
          {mobileView === 'sidebar' && (
            <div className="absolute inset-0">
              <Sidebar
                feeds={feeds}
                viewMode={viewMode}
                selectedFeedId={selectedFeedId}
                unreadCount={unreadCount}
                starredCount={starredCount}
                isLoading={isLoading}
                onViewModeChange={handleViewModeChange}
                onSelectFeed={handleSelectFeed}
                onAddFeed={addFeed}
                onCancelAddFeed={cancelAddFeed}
                onRemoveFeed={removeFeed}
                onRefreshFeed={refreshFeed}
                onRefreshAll={refreshAllFeeds}
                onAddFeedsBatch={addFeedsBatch}
                isMobile
              />
            </div>
          )}

          {/* Article List View */}
          {mobileView === 'list' && (
            <div className="absolute inset-0">
              <ArticleList
                items={filteredItems}
                feeds={feeds}
                selectedItemId={selectedItemId}
                onSelectItem={handleSelectItem}
                onMarkAllAsRead={() => markAllAsRead(selectedFeedId || undefined)}
                onToggleStar={toggleStar}
                isMobile
                onBack={() => setMobileView('sidebar')}
              />
            </div>
          )}

          {/* Article Viewer View */}
          {mobileView === 'article' && selectedItem && (
            <div className="absolute inset-0">
              <ArticleViewer
                item={selectedItem}
                feed={selectedItemFeed}
                translationCache={translationCache}
                onMarkAsRead={markAsRead}
                onToggleStar={toggleStar}
                onAddTranslation={addTranslation}
                onClearTranslation={clearTranslation}
                onBack={() => setMobileView('list')}
                isMobile
              />
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <MobileNav
          currentView={mobileView}
          onViewChange={setMobileView}
          unreadCount={unreadCount}
        />
      </div>

      <Toaster position="bottom-center" className="md:bottom-right" />
    </div>
  );
}

export default App;
