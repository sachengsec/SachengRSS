import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Rss,
  Plus,
  Trash2,
  RefreshCw,
  Inbox,
  Star,
  Eye,
  Loader2,
  Upload,
  FileUp,
  X,
  Settings,
} from 'lucide-react';
import type { RSSFeed, ViewMode, AIConfig } from '@/types';
import { readOPMLFile } from '@/lib/opmlParser';
import { loadAIConfig, saveAIConfig } from '@/lib/storage';
import { toast } from 'sonner';

interface SidebarProps {
  feeds: RSSFeed[];
  viewMode: ViewMode;
  selectedFeedId: string | null;
  unreadCount: number;
  starredCount: number;
  isLoading: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onSelectFeed: (feedId: string | null) => void;
  onAddFeed: (url: string) => Promise<boolean>;
  onCancelAddFeed: () => void;
  onRemoveFeed: (feedId: string) => void;
  onRefreshFeed: (feedId: string) => void;
  onRefreshAll: () => void;
  onAddFeedsBatch?: (urls: string[]) => Promise<{ success: number; failed: number; skipped: number; errors: string[] }>;
  isMobile?: boolean;
}

export function Sidebar({
  feeds,
  viewMode,
  selectedFeedId,
  unreadCount,
  starredCount,
  isLoading,
  onViewModeChange,
  onSelectFeed,
  onAddFeed,
  onCancelAddFeed,
  onRemoveFeed,
  onRefreshFeed,
  onRefreshAll,
  onAddFeedsBatch,
  isMobile,
}: SidebarProps) {
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [feedToDelete, setFeedToDelete] = useState<string | null>(null);

  // OPML 导入相关状态
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<{ success: number; failed: number; skipped: number } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedFeeds, setParsedFeeds] = useState<{ title: string; xmlUrl: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI 设置状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '',
    model: 'deepseek-ai/DeepSeek-V3.2',
  });

  // 打开设置时加载当前配置
  const handleOpenSettings = () => {
    const config = loadAIConfig();
    if (config) {
      setAiConfig(config);
    }
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    saveAIConfig(aiConfig);
    setIsSettingsOpen(false);
    toast.success('AI 设置已保存');
  };

  const handleAddFeed = async () => {
    if (!newFeedUrl.trim()) return;
    const success = await onAddFeed(newFeedUrl);
    if (success) {
      setNewFeedUrl('');
      setIsAddDialogOpen(false);
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    // 如果正在加载且要关闭对话框，先取消请求
    if (!open && isLoading) {
      onCancelAddFeed();
    }
    setIsAddDialogOpen(open);
    if (!open) {
      setNewFeedUrl('');
    }
  };

  const handleCancel = () => {
    if (isLoading) {
      onCancelAddFeed();
    }
    setIsAddDialogOpen(false);
    setNewFeedUrl('');
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportStats(null);

    try {
      const feeds = await readOPMLFile(file);
      setParsedFeeds(feeds);
      toast.success(`解析成功，找到 ${feeds.length} 个订阅源`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '解析失败';
      toast.error(message);
      setSelectedFile(null);
      setParsedFeeds([]);
    }
  };

  // 进度控制引用
  const abortImportRef = useRef<(() => void) | null>(null);

  // 开始导入
  const handleStartImport = async () => {
    if (!onAddFeedsBatch || parsedFeeds.length === 0) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportStats(null);

    const urls = parsedFeeds.map(f => f.xmlUrl);

    try {
      const results = await onAddFeedsBatch(urls, (current, total) => {
        setImportProgress(Math.floor((current / total) * 100));
      });

      setImportProgress(100);
      setImportStats(results);

      toast.success(`导入完成：成功 ${results.success} 个，失败 ${results.failed} 个，跳过 ${results.skipped} 个`);

      // 不要自动关闭，让用户查看结果
    } catch (err) {
      if (err instanceof Error && err.message === '已取消') {
        toast.info('导入已取消');
        setIsImportDialogOpen(false);
        resetImportState();
      } else {
        toast.error('导入过程出错');
      }
    } finally {
      setIsImporting(false);
    }
  };

  // 重置导入状态
  const resetImportState = useCallback(() => {
    setSelectedFile(null);
    setParsedFeeds([]);
    setImportProgress(0);
    setImportStats(null);
    setIsImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 取消导入或关闭对话框
  const handleCloseImportDialog = () => {
    if (isImporting) {
      // 触发取消
      onCancelAddFeed();
      return;
    }
    setIsImportDialogOpen(false);
    resetImportState();
  };

  return (
    <div className={`${isMobile ? 'w-full' : 'w-64'} h-full border-r bg-muted/30 flex flex-col`}>
      <div className="p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <Rss className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">RSS 阅读器</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 justify-start gap-2"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            添加订阅
          </Button>
          {onAddFeedsBatch && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsImportDialogOpen(true)}
              title="导入 OPML"
            >
              <Upload className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 使用原生滚动 */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="p-2 space-y-1">
          {/* 视图模式按钮 */}
          <Button
            variant={viewMode === 'all' && !selectedFeedId ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2"
            onClick={() => {
              onViewModeChange('all');
              onSelectFeed(null);
            }}
          >
            <Inbox className="h-4 w-4" />
            <span className="flex-1 text-left">全部文章</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </Button>

          <Button
            variant={viewMode === 'unread' && !selectedFeedId ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2"
            onClick={() => {
              onViewModeChange('unread');
              onSelectFeed(null);
            }}
          >
            <Eye className="h-4 w-4" />
            <span className="flex-1 text-left">未读</span>
          </Button>

          <Button
            variant={viewMode === 'starred' && !selectedFeedId ? 'secondary' : 'ghost'}
            className="w-full justify-start gap-2"
            onClick={() => {
              onViewModeChange('starred');
              onSelectFeed(null);
            }}
          >
            <Star className="h-4 w-4" />
            <span className="flex-1 text-left">收藏</span>
            {starredCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {starredCount}
              </Badge>
            )}
          </Button>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              订阅源
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefreshAll}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="px-2 space-y-1 pb-4">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                selectedFeedId === feed.id
                  ? 'bg-secondary'
                  : 'hover:bg-muted'
              }`}
              onClick={() => onSelectFeed(feed.id)}
            >
              <Rss className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 text-sm truncate">{feed.title}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefreshFeed(feed.id);
                  }}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFeedToDelete(feed.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          {feeds.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              还没有订阅源
              <br />
              点击"添加订阅"开始使用
            </div>
          )}
        </div>
      </div>

      {/* 底部设置按钮 */}
      <div className="p-3 border-t mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={handleOpenSettings}
        >
          <Settings className="h-4 w-4" />
          AI 翻译设置
        </Button>
      </div>

      {/* 添加订阅对话框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle>添加 RSS 订阅</DialogTitle>
            <DialogDescription>
              输入 RSS 订阅源的 URL 地址
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">订阅地址</Label>
              <Input
                id="url"
                placeholder="https://example.com/feed.xml"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddFeed()}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={isLoading}
            >
              {isLoading ? '取消' : '关闭'}
            </Button>
            <Button 
              onClick={handleAddFeed} 
              disabled={isLoading || !newFeedUrl.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  添加中...
                </>
              ) : (
                '添加'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!feedToDelete} onOpenChange={() => setFeedToDelete(null)}>
        <AlertDialogContent className="mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle>移除订阅</AlertDialogTitle>
            <AlertDialogDescription>
              确定要移除此订阅源吗？相关的所有文章也将被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (feedToDelete) {
                  onRemoveFeed(feedToDelete);
                  setFeedToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OPML 导入对话框 */}
      <Dialog open={isImportDialogOpen} onOpenChange={handleCloseImportDialog}>
        <DialogContent className="sm:max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              导入 OPML 文件
            </DialogTitle>
            <DialogDescription>
              从 OPML 文件批量导入 RSS 订阅源
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 文件选择 */}
            {!isImporting && !importStats && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".opml,.xml"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <FileUp className="h-4 w-4 text-primary" />
                        <span className="font-medium">{selectedFile.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setParsedFeeds([]);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        共 {parsedFeeds.length} 个订阅源
                      </p>
                    </div>
                  ) : (
                    <div className="w-full space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        点击选择 .opml 或 .xml 文件
                      </p>
                    </div>
                  )}
                </div>

                {/* 预览列表 */}
                {parsedFeeds.length > 0 && (
                  <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      待导入的订阅源：
                    </p>
                    <ul className="space-y-1">
                      {parsedFeeds.map((feed, idx) => (
                        <li key={idx} className="text-sm truncate" title={feed.xmlUrl}>
                          {feed.title || feed.xmlUrl}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* 导入进度 */}
            {isImporting && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">正在导入...{importProgress}%</span>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <Progress value={importProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  请稍候，正在逐个验证和添加订阅源
                </p>
              </div>
            )}

            {/* 导入结果 */}
            {importStats && (
              <div className="space-y-3">
                <p className="font-medium text-center">导入完成</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-green-50 rounded p-2">
                    <p className="text-2xl font-bold text-green-600">{importStats.success}</p>
                    <p className="text-xs text-muted-foreground">成功</p>
                  </div>
                  <div className="bg-yellow-50 rounded p-2">
                    <p className="text-2xl font-bold text-yellow-600">{importStats.skipped}</p>
                    <p className="text-xs text-muted-foreground">已存在</p>
                  </div>
                  <div className="bg-red-50 rounded p-2">
                    <p className="text-2xl font-bold text-red-600">{importStats.failed}</p>
                    <p className="text-xs text-muted-foreground">失败</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseImportDialog}
              disabled={isImporting}
            >
              {importStats ? '关闭' : '取消'}
            </Button>
            {!importStats && (
              <Button
                onClick={handleStartImport}
                disabled={isImporting || parsedFeeds.length === 0}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>导入 {parsedFeeds.length > 0 && `(${parsedFeeds.length})`}</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* AI 设置对话框 */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI 翻译设置
            </DialogTitle>
            <DialogDescription>
              配置用于文章翻译的 AI 模型参数。这些配置将保存在您的浏览器中。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">API 地址 (Base URL)</Label>
              <Input
                id="apiUrl"
                placeholder="例如: https://api.siliconflow.cn/v1/chat/completions"
                value={aiConfig.apiUrl}
                onChange={(e) => setAiConfig({ ...aiConfig, apiUrl: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">兼容 OpenAI 格式的 API 接口地址</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">如果留空，将尝试使用环境变量配置</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">模型名称</Label>
              <Input
                id="model"
                placeholder="例如: deepseek-ai/DeepSeek-V3.2"
                value={aiConfig.model}
                onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveSettings}>
              保存设置
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
