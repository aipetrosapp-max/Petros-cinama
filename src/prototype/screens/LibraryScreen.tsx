import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FolderHeart,
  HardDriveDownload,
  History,
  ListChecks,
  Play,
  Plus,
  Sparkles,
  Trash2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  ExplainedRecommendation,
  FeedbackRecord,
  LanguageCode,
  LibraryTab,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  TasteVector6D,
  UserCollection,
  WatchProgressEntry
} from '../types';
import { cosineSimilarity6D } from '../tasteEngine';
import { formatBytes } from '../downloadEngine';
import { useT } from '../i18n';
import { Button, MediaCard, formatDuration, cleanCinemaTitle, generateCinemaPosterSvg } from '../components/UiPrimitives';

interface LibraryScreenProps {
  catalog: PrototypeMediaItem[];
  lang: LanguageCode;
  userVector: TasteVector6D;
  personalizationEnabled: boolean;
  progressMap: Record<string, WatchProgressEntry>;
  favoriteIds: Set<string>;
  downloadsMap: Record<string, OfflineDownloadRecord>;
  hiddenIds: Set<string>;
  recentIds: string[];
  feedbackMap: Record<string, FeedbackRecord>;
  collections: UserCollection[];
  initialTab?: LibraryTab;
  onOpenDetail: (item: PrototypeMediaItem) => void;
  onPlay: (item: PrototypeMediaItem) => void;
  onDownload: (item: PrototypeMediaItem, saveFileToDevice?: boolean) => void;
  onSaveDownloadToDevice: (item: PrototypeMediaItem) => void;
  onDeleteDownload: (contentId: string) => void;
  onToggleFavorite: (item: PrototypeMediaItem) => void;
  onFeedback: (item: PrototypeMediaItem, sentiment: 'like' | 'dislike' | 'less_like_this') => void;
  onHide: (item: PrototypeMediaItem) => void;
  onUnhide: (id: string) => void;
  onCreateCollection: (name: string) => void;
  onDeleteCollection: (id: string) => void;
  onRemoveFromCollection: (colId: string, contentId: string) => void;
  onClearHistory: () => void;
}

const LIBRARY_TABS: Array<{ id: LibraryTab; fa: string; en: string; icon: React.ReactNode }> = [
  { id: 'all', fa: 'کل فیلم‌ها و سریال‌ها', en: 'All Movies & Series', icon: <Play className="h-3.5 w-3.5" /> },
  { id: 'continue', fa: 'ادامه تماشا', en: 'Continue Watching', icon: <Clock className="h-3.5 w-3.5" /> },
  { id: 'downloads', fa: 'دانلودهای آفلاین', en: 'Offline Downloads', icon: <Download className="h-3.5 w-3.5" /> },
  { id: 'history', fa: 'تاریخچه تماشا', en: 'Watch History', icon: <History className="h-3.5 w-3.5" /> },
  { id: 'favorites', fa: 'علاقه‌مندی‌ها', en: 'Favorites', icon: <Bookmark className="h-3.5 w-3.5" /> },
  { id: 'collections', fa: 'کلکسیون‌ها', en: 'Saved Collections', icon: <FolderHeart className="h-3.5 w-3.5" /> },
  { id: 'recent', fa: 'مشاهده‌شده اخیر', en: 'Recently Viewed', icon: <Eye className="h-3.5 w-3.5" /> },
  { id: 'hidden', fa: 'موارد مخفی‌شده', en: 'Hidden Items', icon: <ListChecks className="h-3.5 w-3.5" /> },
  { id: 'lists', fa: 'فهرست‌های شخصی‌سازی‌شده', en: 'Personalized Lists', icon: <Sparkles className="h-3.5 w-3.5" /> }
];

export function LibraryScreen({
  catalog,
  lang,
  userVector,
  personalizationEnabled,
  progressMap,
  favoriteIds,
  downloadsMap,
  hiddenIds,
  recentIds,
  feedbackMap,
  collections,
  initialTab,
  onOpenDetail,
  onPlay,
  onDownload,
  onSaveDownloadToDevice,
  onDeleteDownload,
  onToggleFavorite,
  onFeedback,
  onHide,
  onUnhide,
  onCreateCollection,
  onDeleteCollection,
  onRemoveFromCollection,
  onClearHistory
}: LibraryScreenProps) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab ?? 'all');
  const [newColName, setNewColName] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title'>('recent');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const toRec = (item: PrototypeMediaItem, reasonFa: string, reasonEn: string): ExplainedRecommendation => ({
    item,
    score: Math.max(
      55,
      Math.min(99, Math.round((personalizationEnabled ? cosineSimilarity6D(userVector, item.vector) : 0.74) * 100))
    ),
    reasonFa,
    reasonEn
  });

  const downloadEntries = useMemo(() => {
    return Object.values(downloadsMap)
      .sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt))
      .map((record) => ({
        record,
        item: catalog.find((c) => c.id === record.contentId)
      }))
      .filter((entry): entry is { record: OfflineDownloadRecord; item: PrototypeMediaItem } =>
        Boolean(entry.item)
      );
  }, [downloadsMap, catalog]);

  const activeItems = useMemo(() => {
    let list: ExplainedRecommendation[] = [];
    if (activeTab === 'all') {
      list = catalog
        .filter((c) => !hiddenIds.has(c.id))
        .map((item) => toRec(item, 'موجود در مخزن سینما پتروس', 'Available in Petros Cinema Vault'));
    } else if (activeTab === 'continue') {
      list = Object.values(progressMap)
        .filter((p) => !p.completed && p.positionSec > 5)
        .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
        .map((p) => catalog.find((c) => c.id === p.contentId))
        .filter((x): x is PrototypeMediaItem => Boolean(x))
        .map((item) => toRec(item, 'دارای پیشرفت ذخیره‌شده برای ادامه تماشا', 'Saved playback position'));
    } else if (activeTab === 'history') {
      list = Object.values(progressMap)
        .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
        .map((p) => catalog.find((c) => c.id === p.contentId))
        .filter((x): x is PrototypeMediaItem => Boolean(x))
        .map((item) => toRec(item, 'ثبت‌شده در تاریخچه تماشای شما', 'Recorded in your watch history'));
    } else if (activeTab === 'favorites') {
      list = catalog
        .filter((c) => favoriteIds.has(c.id))
        .map((item) => toRec(item, 'نشان‌شده توسط شما', 'Bookmarked in Favorites'));
    } else if (activeTab === 'recent') {
      list = recentIds
        .map((id) => catalog.find((c) => c.id === id))
        .filter((x): x is PrototypeMediaItem => Boolean(x))
        .map((item) => toRec(item, 'بازدیدشده در همین نشست', 'Recently opened'));
    } else if (activeTab === 'hidden') {
      list = catalog
        .filter((c) => hiddenIds.has(c.id))
        .map((item) => toRec(item, 'مخفی‌شده از فید اصلی', 'Hidden from discovery feeds'));
    } else if (activeTab === 'lists') {
      list = catalog
        .filter((c) => !hiddenIds.has(c.id))
        .map((item) => toRec(item, 'پیشنهاد مبتنی بر بردار سلیقه ۶بعدی', 'Generated from 6D taste vector'))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
    }

    if (sortBy === 'title') {
      return [...list].sort((a, b) =>
        t(a.item.titleEn, a.item.titleFa).localeCompare(t(b.item.titleEn, b.item.titleFa))
      );
    }
    return list;
  }, [activeTab, progressMap, catalog, favoriteIds, recentIds, hiddenIds, sortBy, t, personalizationEnabled, userVector]);

  return (
    <div className="space-y-6 sm:space-y-7 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#F5F7FA]">
            {t('Personal Library & Offline Vault', 'کتابخانه شخصی و دانلودهای آفلاین')}
          </h1>
          <p className="text-xs sm:text-sm text-[#A3AEC2]">
            {t(
              'Manage watch progress, offline downloads, favorites, custom collections, and hidden items',
              'مدیریت تاریخچه، دانلودهای ذخیره‌شده، علاقه‌مندی‌ها، کلکسیون‌های سفارشی و موارد مخفی‌شده'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'title')}
            className="min-h-[40px] rounded-full border border-white/12 bg-[#0D101A] px-3.5 text-base sm:text-xs text-[#F5F7FA]"
          >
            <option value="recent">{t('Sort: Recent', 'مرتب‌سازی: پیش‌فرض / اخیر')}</option>
            <option value="title">{t('Sort: Title A-Z', 'مرتب‌سازی: حروف الفبا')}</option>
          </select>
          {activeTab === 'history' && Object.keys(progressMap).length > 0 && (
            <Button variant="danger" size="sm" onClick={onClearHistory}>
              <Trash2 className="h-3.5 w-3.5" />
              {t('Clear History', 'پاک‌سازی تاریخچه')}
            </Button>
          )}
        </div>
      </div>

      {/* Responsive Scrollable Tab Strip with Sliding Indicator */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap">
        {LIBRARY_TABS.map((tabItem) => {
          const active = activeTab === tabItem.id;
          return (
            <button
              key={tabItem.id}
              type="button"
              onClick={() => setActiveTab(tabItem.id)}
              className={`relative min-h-[40px] shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 rounded-full px-4 text-xs font-medium transition-colors cursor-pointer border ${
                active
                  ? 'border-[#F5B942]/80 text-[#06070C]'
                  : 'border-white/12 bg-[#0D101A] text-[#A3AEC2] hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="libraryActiveTab"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-full bg-[#F5B942]"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {tabItem.icon}
                <span>
                  {t(tabItem.en, tabItem.fa)}
                  {tabItem.id === 'downloads' && downloadEntries.length > 0
                    ? ` (${downloadEntries.length})`
                    : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Offline Downloads Manager */}
          {activeTab === 'downloads' ? (
            downloadEntries.length === 0 ? (
              <div className="relative overflow-hidden rounded-[28px] border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#13141C] to-[#08090E] p-6 sm:p-10 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(212,175,55,0.1)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.35)] shadow-[0_0_24px_rgba(212,175,55,0.3)]">
                  <Download className="h-7 w-7" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="font-cinzel text-lg sm:text-xl font-bold text-[#F5F7FA]">
                    {t('VIP Ticket Booth & Offline Vault', 'گیشه بلیت و سالن دانلودهای آفلاین')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A3AEC2] leading-relaxed">
                    {t(
                      'No movies are saved in your offline vault yet. Choose any film from Petros Cinema to download directly or save for high-speed offline projection.',
                      'هنوز اثری در سالن آفلاین شما ذخیره نشده است. می‌توانید هر فیلمی را با دکمه دانلود به‌صورت مستقیم روی دستگاه ذخیره یا در حافظه پرسرعت درون‌برنامه‌ای ذخیره کنید.'
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {downloadEntries.map(({ record, item }) => {
                  const completed = record.status === 'completed';
                  const itemTitle = cleanCinemaTitle(t(item.titleEn, item.titleFa));
                  return (
                    <div
                      key={record.contentId}
                      className="relative overflow-hidden rounded-[24px] border border-[rgba(212,175,55,0.3)] bg-gradient-to-r from-[#0B0C10] via-[#10121A] to-[#0B0C10] p-4 flex flex-col sm:flex-row gap-4 justify-between shadow-[0_12px_36px_rgba(0,0,0,0.8),0_0_16px_rgba(212,175,55,0.08)] group"
                    >
                      {/* Ticket notches */}
                      <div className="hidden sm:block absolute -top-3 start-40 h-6 w-6 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.3)]" />
                      <div className="hidden sm:block absolute -bottom-3 start-40 h-6 w-6 rounded-full bg-[#050508] border border-[rgba(212,175,55,0.3)]" />
                      <div className="hidden sm:block absolute top-3 bottom-3 start-43 border-e border-dashed border-[rgba(212,175,55,0.25)]" />

                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={item.posterUrl || generateCinemaPosterSvg(itemTitle, item.accentHex)}
                            alt={itemTitle}
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.src = generateCinemaPosterSvg(itemTitle, item.accentHex);
                            }}
                            className="h-24 w-18 rounded-xl object-cover border border-[rgba(212,175,55,0.25)] shadow-lg"
                          />
                          <div className="absolute top-1 start-1 rounded bg-[#D4AF37] px-1 py-0.5 text-[8px] font-bold text-black font-mono">
                            4K HDR
                          </div>
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-[#D4AF37] tracking-wider uppercase">
                            <span>VIP PASS</span>
                            <span>•</span>
                            <span>DOLBY 5.1</span>
                          </div>
                          <h2 className="truncate text-base font-bold text-[#F5F7FA] font-cinzel">{itemTitle}</h2>
                          <p className="text-xs text-[#A3AEC2]">
                            {record.quality} ·{' '}
                            <span dir="ltr" className="font-mono-tabular">
                              {formatBytes(record.fileSizeBytes)}
                            </span>
                          </p>
                          <p className="inline-flex items-center gap-1 text-[11px] text-[#34D399]">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {completed
                                ? `${t('Ready Offline in Vault', 'آماده در سالن آفلاین')} (${record.mimeType})`
                                : `${record.progressPct}%`}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-col items-center sm:items-end justify-center gap-2 shrink-0 sm:ps-6">
                        <button
                          type="button"
                          onClick={() => onPlay(item)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F59E0B] px-4 py-2.5 text-xs font-bold text-black shadow-[0_0_18px_rgba(212,175,55,0.4)] hover:shadow-[0_0_26px_rgba(212,175,55,0.7)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                          <Play className="h-3.5 w-3.5 fill-black" />
                          {t('Play in VIP Hall', 'ورود به سالن اکران')}
                        </button>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onSaveDownloadToDevice(item)}
                          >
                            <HardDriveDownload className="h-3.5 w-3.5 text-[#D4AF37]" />
                            <span>{t('Save File', 'ذخیره در دستگاه')}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => onDeleteDownload(item.id)}
                            aria-label="Delete offline copy"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeTab === 'collections' ? (
            <div className="space-y-6">
              <form
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#0D101A] p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newColName.trim()) return;
                  onCreateCollection(newColName.trim());
                  setNewColName('');
                }}
              >
                <input
                  type="text"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder={t(
                    'New collection name...',
                    'نام کلکسیون جدید (مثلاً: شب‌های بارانی)...'
                  )}
                  className="flex-1 min-w-[200px] min-h-[44px] rounded-full border border-white/12 bg-[#06070C] px-4 text-base sm:text-sm text-[#F5F7FA]"
                />
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                  {t('Create Collection', 'ایجاد کلکسیون')}
                </Button>
              </form>

              {collections.length === 0 ? (
                <p className="text-sm text-[#A3AEC2]">
                  {t('No custom collections created yet.', 'هنوز کلکسیونی ایجاد نشده است.')}
                </p>
              ) : (
                <div className="space-y-5">
                  {collections.map((col) => {
                    const items = col.itemIds
                      .map((id) => catalog.find((c) => c.id === id))
                      .filter((x): x is PrototypeMediaItem => Boolean(x));
                    return (
                      <div
                        key={col.id}
                        className="rounded-[24px] border border-white/10 bg-[#0D101A] p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h2 className="text-base font-semibold text-[#F5F7FA]">{col.name}</h2>
                            <p className="text-xs text-[#A3AEC2]">
                              {items.length} {t('items saved', 'مورد ذخیره‌شده')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteCollection(col.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[#FCA5A5]" />
                            {t('Delete Collection', 'حذف کلکسیون')}
                          </Button>
                        </div>

                        {items.length === 0 ? (
                          <p className="text-xs text-[#8E9BB3]">
                            {t(
                              'Open any item Detail modal to assign it to this collection.',
                              'از پنجره جزئیات هر فیلم می‌توانید آن را به این کلکسیون اضافه کنید.'
                            )}
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {items.map((item) => {
                              const itemTitle = cleanCinemaTitle(t(item.titleEn, item.titleFa));
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#06070C]/65 p-3"
                                >
                                  <button
                                    type="button"
                                    onClick={() => onOpenDetail(item)}
                                    className="flex items-center gap-3 min-w-0 text-start cursor-pointer"
                                  >
                                    <img
                                      src={item.posterUrl}
                                      alt={itemTitle}
                                      className="h-12 w-16 rounded-lg object-cover shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-semibold text-[#F5F7FA]">
                                        {itemTitle}
                                      </p>
                                      <p dir="ltr" className="text-[11px] font-mono-tabular text-[#A3AEC2]">
                                        {formatDuration(item.durationSec)}
                                      </p>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRemoveFromCollection(col.id, item.id)}
                                    aria-label="Remove from collection"
                                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full text-[#A3AEC2] hover:text-[#FCA5A5] cursor-pointer"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'hidden' ? (
            activeItems.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0D101A] p-8 text-center text-sm text-[#A3AEC2]">
                {t('You have not hidden any items.', 'هیچ موردی توسط شما مخفی نشده است.')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeItems.map(({ item }) => {
                  const itemTitle = cleanCinemaTitle(t(item.titleEn, item.titleFa));
                  const itemCat = t(item.categoryEn, item.categoryFa);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0D101A] p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={item.posterUrl}
                          alt={itemTitle}
                          className="h-14 w-20 rounded-xl object-cover shrink-0 opacity-70"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#F5F7FA]">{itemTitle}</p>
                          <p className="truncate text-xs text-[#A3AEC2]">{itemCat}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => onUnhide(item.id)}>
                        {t('Unhide', 'بازگردانی')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )
          ) : activeItems.length === 0 ? (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-[28px] border border-[rgba(212,175,55,0.3)] bg-gradient-to-b from-[#13141C] to-[#08090E] p-6 sm:p-10 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(212,175,55,0.1)]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.35)] shadow-[0_0_24px_rgba(212,175,55,0.3)]">
                  <Bookmark className="h-7 w-7" />
                </div>
                <div className="max-w-lg mx-auto space-y-1.5">
                  <h3 className="font-cinzel text-lg sm:text-xl font-bold text-[#F5F7FA]">
                    {t("VIP Collector's Vault is Empty", 'گیشه بلیت و آرشیو خصوصی شما خالی است')}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A3AEC2] leading-relaxed">
                    {t(
                      'Your personal projection vault is waiting for its first screening ticket. Bookmark or watch any film to archive it here with full 4K master audio/visual specs.',
                      'سالن اختصاصی شما در انتظار نخستین اکران است. هر اثری را با دکمه نشان‌گذاری یا تماشا به گیشه شخصی خود انتقال دهید تا شناسنامه کامل و بلیت VIP آن ثبت شود.'
                    )}
                  </p>
                </div>
              </div>

              {/* Instant Quick-Add Showcase from Catalog */}
              {catalog.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.2)] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#D4AF37] animate-ping" />
                      <h4 className="text-sm sm:text-base font-semibold text-[#D4AF37]">
                        {t('Featured VIP Masterpieces to Add to Your Vault', 'شاهکارهای پیشنهادی سینما پتروس برای افزودن به آرشیو')}
                      </h4>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
                    {catalog.slice(0, 5).map((item) => (
                      <MediaCard
                        key={`vault-rec-${item.id}`}
                        recommendation={toRec(item, 'پیشنهاد اختصاصی برای آرشیو شما', 'Curated recommendation for your vault')}
                        lang={lang}
                        isFavorite={favoriteIds.has(item.id)}
                        downloadRecord={downloadsMap[item.id]}
                        progress={progressMap[item.id]}
                        feedback={feedbackMap[item.id]}
                        onOpenDetail={onOpenDetail}
                        onPlay={onPlay}
                        onDownload={(itm) => onDownload(itm, false)}
                        onToggleFavorite={onToggleFavorite}
                        onFeedback={onFeedback}
                        onHide={onHide}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
              {activeItems.map((rec) => (
                <MediaCard
                  key={rec.item.id}
                  recommendation={rec}
                  lang={lang}
                  isFavorite={favoriteIds.has(rec.item.id)}
                  downloadRecord={downloadsMap[rec.item.id]}
                  progress={progressMap[rec.item.id]}
                  feedback={feedbackMap[rec.item.id]}
                  onOpenDetail={onOpenDetail}
                  onPlay={onPlay}
                  onDownload={(item) => onDownload(item, false)}
                  onToggleFavorite={onToggleFavorite}
                  onFeedback={onFeedback}
                  onHide={onHide}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
