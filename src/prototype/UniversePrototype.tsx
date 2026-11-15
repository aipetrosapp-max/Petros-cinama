import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Compass,
  Download,
  Film,
  Globe2,
  Home,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Ticket,
  Tv
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import type {
  FeedbackRecord,
  LanguageCode,
  LibraryTab,
  OfflineDownloadRecord,
  PrototypeMediaItem,
  PrototypeRoute,
  SearchFilterState,
  TasteVector6D,
  UiSimulationState,
  UserAccountState,
  UserCollection,
  WatchProgressEntry
} from './types';
import { INITIAL_USER_STATE, PROTOTYPE_MEDIA_CATALOG } from './prototypeData';
import {
  blendVector,
  calibrateColdStartVector,
  DEFAULT_TASTE_VECTOR
} from './tasteEngine';
import {
  clearVaultSnapshot,
  getVaultByteSize,
  loadVaultFromIndexedDb,
  loadVaultSnapshot,
  saveVaultSnapshot
} from './localVault';
import {
  deleteOfflineMediaBlob,
  formatBytes,
  generateDownloadableMediaClip,
  loadOfflineMediaBlob,
  saveOfflineMediaBlob,
  triggerBrowserDownload
} from './downloadEngine';
import {
  getLanguageDirection,
  I18nProvider,
  LanguagePickerModal,
  useT
} from './i18n';
import type { BackendStreamQuality } from './filmDetailsClient';
import { StateBoundary, ToastBanner, ToastMessage } from './components/UiPrimitives';
import { EntryFlow } from './screens/EntryFlow';
import { LivingHomeScreen } from './screens/LivingHomeScreen';
import { DiscoveryUniverseScreen } from './screens/DiscoveryUniverseScreen';
import { IntelligentSearchScreen } from './screens/IntelligentSearchScreen';
import { ContentDetailModal } from './screens/ContentDetailModal';
import { CinematicPlayerScreen } from './screens/CinematicPlayerScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AipetrosLandingScreen } from './screens/AipetrosLandingScreen';
import { dynamicStreamSync, convertDynamicStreamToMediaItem, type DynamicStreamItem } from '../services/dynamicStreamSync';
import { autoUpdateService } from '../services/autoUpdateService';
import { aiAdOptimizationAgent, type OptimizedAdUnit } from '../services/aiAdOptimizationAgent';
import { tvRemote } from '../services/tvRemoteNavigation';
import { CryptoAdModal } from '../components/CryptoAdModal';
import { InstantInstallBanner } from './components/InstantInstallBanner';
import { InteractiveSpotlightTour } from '../components/InteractiveSpotlightTour';
import { OwnerSecretPortal } from '../components/OwnerSecretPortal';

const INITIAL_PROGRESS_SEED: Record<string, WatchProgressEntry> = {};

const INITIAL_COLLECTIONS_SEED: UserCollection[] = [];

const INITIAL_SEARCH_FILTERS: SearchFilterState = {
  query: '',
  mode: 'all',
  excludeTags: [],
  maxDurationMin: null,
  minQuality: 'all',
  unwatchedOnly: false,
  sortBy: 'relevance'
};

function sanitizeLoadedDownloads(
  raw?: Record<string, OfflineDownloadRecord>
): Record<string, OfflineDownloadRecord> {
  if (!raw) return {};
  const cleaned: Record<string, OfflineDownloadRecord> = {};
  for (const [id, rec] of Object.entries(raw)) {
    if (rec && rec.status === 'completed') {
      cleaned[id] = rec;
    }
  }
  return cleaned;
}

function buildDownloadFilename(item: PrototypeMediaItem, mimeType: string): string {
  const slug =
    item.titleEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || item.id;
  if (mimeType.includes('webm')) return `${slug}.webm`;
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return `${slug}.jpg`;
  if (mimeType.includes('png')) return `${slug}.png`;
  return `${slug}-offline.json`;
}

export function UniversePrototype() {
  const initialVault = useMemo(() => loadVaultSnapshot(), []);
  const [lang, setLang] = useState<LanguageCode>(() => initialVault?.lang ?? 'en');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = getLanguageDirection(lang);
  }, [lang]);

  return (
    <I18nProvider lang={lang} onChangeLang={setLang}>
      <UniversePrototypeShell initialVault={initialVault} lang={lang} setLang={setLang} />
    </I18nProvider>
  );
}

function UniversePrototypeShell({
  initialVault,
  lang,
  setLang
}: {
  initialVault: ReturnType<typeof loadVaultSnapshot>;
  lang: LanguageCode;
  setLang: React.Dispatch<React.SetStateAction<LanguageCode>>;
}) {
  const { t, languageInfo } = useT();

  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => true);
  const [route, setRoute] = useState<PrototypeRoute>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('cinema') || hash.includes('universe') || hash.includes('watch') || hash.includes('search')) {
        return 'universe';
      }
    }
    return 'landing';
  });
  const [uiState, setUiState] = useState<UiSimulationState>('normal');
  const [libraryTabRequest, setLibraryTabRequest] = useState<LibraryTab | undefined>(undefined);
  const [langPickerOpen, setLangPickerOpen] = useState(false);

  const [catalog, setCatalog] = useState<PrototypeMediaItem[]>(() => {
    const fromVault = initialVault?.catalog && initialVault.catalog.length > 0
      ? initialVault.catalog
      : [];
    const fromDynamic = dynamicStreamSync.getStreams().map(convertDynamicStreamToMediaItem);
    const combined = fromVault.length > 0 ? fromVault : fromDynamic.length > 0 ? fromDynamic : PROTOTYPE_MEDIA_CATALOG;
    const valid = combined.filter((item) => Boolean(
      (item.streamUrl && item.streamUrl.startsWith('http') && !item.streamUrl.includes('oceans.mp4')) ||
      (item.qualities && item.qualities.some((q) => q.url && q.url.startsWith('http') && !q.url.includes('oceans.mp4'))) ||
      item.streamUrl?.includes('t.me/') ||
      item.id?.startsWith('tg-')
    ));
    return valid.length > 0 ? valid : PROTOTYPE_MEDIA_CATALOG;
  });
  const [user, setUser] = useState<UserAccountState>(() => initialVault?.user ?? INITIAL_USER_STATE);
  const [userVector, setUserVector] = useState<TasteVector6D>(
    () => initialVault?.userVector ?? DEFAULT_TASTE_VECTOR
  );

  const [progressMap, setProgressMap] = useState<Record<string, WatchProgressEntry>>(
    () => initialVault?.progressMap ?? {}
  );
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(initialVault?.favoriteIds ?? [])
  );
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(
    () => new Set(initialVault?.hiddenIds ?? [])
  );
  const [recentIds, setRecentIds] = useState<string[]>(
    () => initialVault?.recentIds ?? []
  );
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackRecord>>(
    () => initialVault?.feedbackMap ?? {}
  );
  const [collections, setCollections] = useState<UserCollection[]>(
    () => initialVault?.collections ?? INITIAL_COLLECTIONS_SEED
  );
  const [downloadsMap, setDownloadsMap] = useState<Record<string, OfflineDownloadRecord>>(() =>
    sanitizeLoadedDownloads(initialVault?.downloads)
  );
  const downloadsMapRef = useRef(downloadsMap);
  downloadsMapRef.current = downloadsMap;

  const [searchFilters, setSearchFilters] = useState<SearchFilterState>(
    () => initialVault?.searchFilters ?? INITIAL_SEARCH_FILTERS
  );
  const [selectedDetailItem, setSelectedDetailItem] = useState<PrototypeMediaItem | null>(null);
  const [playingItem, setPlayingItem] = useState<PrototypeMediaItem | null>(null);
  const [playingQualityId, setPlayingQualityId] = useState<string | undefined>(undefined);
  const [playingPlaybackMode, setPlayingPlaybackMode] = useState<'movie' | 'trailer'>('movie');
  const [previousRouteBeforeWatch, setPreviousRouteBeforeWatch] =
    useState<PrototypeRoute>('universe');

  const [vaultSizeBytes, setVaultSizeBytes] = useState<number>(() => getVaultByteSize());
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string, undoLabel?: string, onUndo?: () => void) => {
    setToast({ id: `${Date.now()}`, text, undoLabel, onUndo });
  }, []);

  const navigateTo = useCallback((nextRoute: PrototypeRoute) => {
    if (nextRoute !== 'library') {
      setLibraryTabRequest(undefined);
    }
    setRoute(nextRoute);
  }, []);

  // Dynamic Stream Sync, AI Ad Agent, TV Navigation & Interactive Tour State
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [currentAd, setCurrentAd] = useState<OptimizedAdUnit | null>(null);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isTvMode, setIsTvMode] = useState(() => tvRemote.isTvModeEnabled());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isAppInitializing, setIsAppInitializing] = useState<boolean>(true);
  const [syncStatusText, setSyncStatusText] = useState<string>('در حال اتصال به سرور و همگام‌سازی ابری مخزن فیلم و سریال‌ها...');
  const [ownerPortalState, setOwnerPortalState] = useState<{
    isOpen: boolean;
    tab: 'wallets' | 'archive';
  }>({ isOpen: false, tab: 'wallets' });

  // Secret Owner URL Handler: Listens to confidential hash (#/owner-wallets or #/owner-archive)
  useEffect(() => {
    const checkSecretRoute = () => {
      const hash = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const portalParam = params.get('portal');

      if (hash.includes('owner-wallets') || portalParam === 'wallets') {
        setOwnerPortalState({ isOpen: true, tab: 'wallets' });
      } else if (hash.includes('owner-archive') || portalParam === 'archive') {
        setOwnerPortalState({ isOpen: true, tab: 'archive' });
      }
    };

    checkSecretRoute();
    window.addEventListener('hashchange', checkSecretRoute);
    return () => window.removeEventListener('hashchange', checkSecretRoute);
  }, []);

  // Zero-reinstall real-time update detector
  useEffect(() => {
    const unsub = autoUpdateService.onNewVersion((newVer) => {
      showToast(
        lang === 'fa'
          ? `نسخه جدید پتروس سینما بارگذاری شد (${newVer}). به‌روزرسانی آنی...`
          : `New Petros Cinema version loaded (${newVer}). Updating...`
      );
      setTimeout(() => {
        autoUpdateService.forceApplyUpdate();
      }, 1500);
    });
    return () => {
      unsub();
    };
  }, [lang, showToast]);

  // Dynamic Stream Sync & Initial Cloud Catalog Hydration
  useEffect(() => {
    let isMounted = true;
    dynamicStreamSync.startPeriodicSync();

    const unsubscribe = dynamicStreamSync.subscribe((dynamicStreams, meta) => {
      if (!isMounted) return;
      setLastSyncTime(meta.lastSyncedAt);
      if (dynamicStreams && dynamicStreams.length > 0) {
        const validConverted = dynamicStreams
          .filter((s) => Boolean(
            (s.defaultStreamUrl && s.defaultStreamUrl.startsWith('http') && !s.defaultStreamUrl.includes('oceans.mp4')) ||
            (s.qualities && s.qualities.some((q) => q.url && q.url.startsWith('http') && !q.url.includes('oceans.mp4')))
          ))
          .map(convertDynamicStreamToMediaItem);
        setCatalog(validConverted);
      }
    });

    // Mandatory startup sync: fetch and update streams from public cloud repository
    (async () => {
      try {
        setSyncStatusText(lang === 'fa' ? 'در حال دریافت تازه‌ترین فهرست فیلم‌ها و استریم‌ها از مخزن ابری...' : 'Fetching latest cloud cinema streams...');
        await dynamicStreamSync.syncNow(true);
        if (isMounted) {
          const validOnly = dynamicStreamSync.getStreams()
            .filter((s) => Boolean(
              (s.defaultStreamUrl && s.defaultStreamUrl.startsWith('http') && !s.defaultStreamUrl.includes('oceans.mp4')) ||
              (s.qualities && s.qualities.some((q) => q.url && q.url.startsWith('http') && !q.url.includes('oceans.mp4')))
            ))
            .map(convertDynamicStreamToMediaItem);
          if (validOnly.length > 0) {
            setCatalog(validOnly);
          }
          setSyncStatusText(lang === 'fa' ? 'مخزن فیلم و سریال با موفقیت به‌روزرسانی شد.' : 'Cinema catalog synchronized.');
        }
      } catch (err) {
        console.warn('Initial cloud sync error (falling back to cache):', err);
      } finally {
        // Smooth transition: brief pause so the user sees clean boot
        setTimeout(() => {
          if (isMounted) {
            setIsAppInitializing(false);
          }
        }, 650);
      }
    })();

    return () => {
      isMounted = false;
      unsubscribe();
      dynamicStreamSync.stopPeriodicSync();
    };
  }, [lang]);

  // Spatial Navigation & Android TV Remote Back Key Binding
  useEffect(() => {
    const unreg = tvRemote.registerBackHandler(() => {
      if (isAdModalOpen) {
        setIsAdModalOpen(false);
        return true;
      }
      if (isTourOpen) {
        setIsTourOpen(false);
        return true;
      }
      if (selectedDetailItem) {
        setSelectedDetailItem(null);
        return true;
      }
      if (route === 'watch') {
        // Exiting player triggers non-intrusive crypto ad strictly after watching 4 videos
        const res = aiAdOptimizationAgent.recordVideoPlayback();
        if (res.shouldTriggerAd && res.adUnit) {
          setCurrentAd(res.adUnit);
          setIsAdModalOpen(true);
        }
        navigateTo(previousRouteBeforeWatch);
        return true;
      }
      if (route !== 'universe') {
        navigateTo('universe');
        return true;
      }
      return false;
    });
    return unreg;
  }, [isAdModalOpen, isTourOpen, selectedDetailItem, route, previousRouteBeforeWatch, navigateTo]);

  // If localStorage was empty on boot, recover from IndexedDB backup if available
  useEffect(() => {
    if (initialVault) return;
    let active = true;
    void loadVaultFromIndexedDb().then((idbSnap) => {
      if (!active || !idbSnap) return;
      setLang(idbSnap.lang);
      setOnboardingDone(Boolean(idbSnap.onboardingDone || idbSnap.user?.ageVerified));
      if (idbSnap.onboardingDone || idbSnap.user?.ageVerified) {
        setRoute('universe');
      }
      setCatalog(idbSnap.catalog);
      setUser(idbSnap.user);
      setUserVector(idbSnap.userVector);
      setProgressMap(idbSnap.progressMap);
      setFavoriteIds(new Set(idbSnap.favoriteIds));
      setHiddenIds(new Set(idbSnap.hiddenIds));
      setRecentIds(idbSnap.recentIds);
      setFeedbackMap(idbSnap.feedbackMap);
      setCollections(idbSnap.collections);
      setDownloadsMap(sanitizeLoadedDownloads(idbSnap.downloads));
      setSearchFilters(idbSnap.searchFilters);
    });
    return () => {
      active = false;
    };
  }, [initialVault, setLang]);

  // Persist everything inside the application automatically on any change
  useEffect(() => {
    const snapshot = {
      version: 1,
      updatedAt: new Date().toISOString(),
      lang,
      onboardingDone,
      user,
      userVector,
      progressMap,
      favoriteIds: Array.from(favoriteIds),
      hiddenIds: Array.from(hiddenIds),
      recentIds,
      feedbackMap,
      collections,
      downloads: sanitizeLoadedDownloads(downloadsMap),
      searchFilters,
      catalog
    };
    void saveVaultSnapshot(snapshot).then(() => {
      setVaultSizeBytes(getVaultByteSize());
    });
  }, [
    lang,
    onboardingDone,
    user,
    userVector,
    progressMap,
    favoriteIds,
    hiddenIds,
    recentIds,
    feedbackMap,
    collections,
    downloadsMap,
    searchFilters,
    catalog
  ]);

  // Global keyboard shortcut: Cmd/Ctrl + K jumps directly to Intelligent Search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setRoute('search');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleUpdateUser = useCallback((patch: Partial<UserAccountState>) => {
    setUser((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleApplyOnboardingPresets = useCallback(
    (presets: string[], blockedTopics: string[]) => {
      setUserVector(calibrateColdStartVector(presets));
      setUser((prev) => ({ ...prev, blockedTopics }));
      setOnboardingDone(true);
    },
    []
  );

  const handleQuickEnterUniverse = useCallback(() => {
    setUser((prev) => ({
      ...prev,
      ageVerified: true
    }));
    setOnboardingDone(true);
    setRoute('universe');
  }, []);

  const handleOpenDetail = useCallback((item: PrototypeMediaItem) => {
    setSelectedDetailItem(item);
    setRecentIds((prev) => [item.id, ...prev.filter((x) => x !== item.id)].slice(0, 12));
  }, []);

  const handlePlayItem = useCallback(
    (item: PrototypeMediaItem, selectedQuality?: BackendStreamQuality) => {
      setSelectedDetailItem(null);
      if (route !== 'watch') {
        setPreviousRouteBeforeWatch(route);
      }
      setPlayingItem(item);
      setPlayingQualityId(selectedQuality?.id);
      setPlayingPlaybackMode('movie');
      setRecentIds((prev) => [item.id, ...prev.filter((x) => x !== item.id)].slice(0, 12));
      setRoute('watch');
      if (user.personalizationEnabled) {
        setUserVector((prev) => blendVector(prev, item.vector, 0.12));
      }
    },
    [route, user.personalizationEnabled]
  );

  const handleWatchTrailer = useCallback(
    (item: PrototypeMediaItem, selectedQuality?: BackendStreamQuality) => {
      setSelectedDetailItem(null);
      if (route !== 'watch') {
        setPreviousRouteBeforeWatch(route);
      }
      setPlayingItem(item);
      setPlayingQualityId(selectedQuality?.id);
      setPlayingPlaybackMode('trailer');
      setRoute('watch');
    },
    [route]
  );

  // Offline Download Engine (In-App IndexedDB Vault + Direct Save to Device)
  const handleDownloadItem = useCallback(
    async (
      item: PrototypeMediaItem,
      saveFileToDevice = false,
      selectedQuality?: BackendStreamQuality
    ) => {
      const existing = downloadsMapRef.current[item.id];
      if (existing?.status === 'downloading') return;
      const itemTitle = t(item.titleEn, item.titleFa);
      const effectiveQuality = selectedQuality?.resolution || item.quality;

      const hasDownloadUrl = Boolean(
        (item.streamUrl && item.streamUrl.startsWith('http')) ||
        (item.defaultStreamUrl && item.defaultStreamUrl.startsWith('http')) ||
        (item.qualities && item.qualities.some((q) => q.url && q.url.startsWith('http'))) ||
        item.id === 'petros-stream-xmen-apocalypse'
      );

      if (!hasDownloadUrl) {
        showToast(
          lang === 'fa'
            ? `«${itemTitle}» فاقد لینک مستقیم است؛ تنها آثار دارای لینک معتبر قابل دانلود هستند.`
            : `No download link for "${itemTitle}". Only titles with verified links can be downloaded.`
        );
        return;
      }

      if (existing?.status === 'completed') {
        const cachedBlob = await loadOfflineMediaBlob(item.id);
        if (cachedBlob) {
          if (saveFileToDevice) {
            triggerBrowserDownload(cachedBlob, buildDownloadFilename(item, existing.mimeType));
            showToast(`${itemTitle} — ${t('Saved to your device.', 'در دستگاه شما ذخیره شد.')}`);
          } else {
            showToast(
              `${itemTitle} — ${t('Already saved in Offline Library.', 'قبلاً در کتابخانه آفلاین ذخیره شده است.')}`,
              t('Open Downloads', 'مشاهده دانلودها'),
              () => {
                setLibraryTabRequest('downloads');
                setRoute('library');
              }
            );
          }
          return;
        }
      }

      setDownloadsMap((prev) => ({
        ...prev,
        [item.id]: {
          contentId: item.id,
          titleFa: item.titleFa,
          titleEn: item.titleEn,
          quality: effectiveQuality,
          fileSizeBytes: 0,
          mimeType: 'video/webm',
          downloadedAt: new Date().toISOString(),
          status: 'downloading',
          progressPct: 8
        }
      }));

      let lastPct = 8;
      const result = await generateDownloadableMediaClip(item, (pct) => {
        if (pct - lastPct < 10 && pct < 100) return;
        lastPct = pct;
        setDownloadsMap((prev) => {
          const cur = prev[item.id];
          if (!cur || cur.status !== 'downloading') return prev;
          return {
            ...prev,
            [item.id]: { ...cur, progressPct: pct }
          };
        });
      });

      await saveOfflineMediaBlob(item.id, result.blob);

      setDownloadsMap((prev) => ({
        ...prev,
        [item.id]: {
          contentId: item.id,
          titleFa: item.titleFa,
          titleEn: item.titleEn,
          quality: effectiveQuality,
          fileSizeBytes: result.blob.size,
          mimeType: result.mimeType,
          downloadedAt: new Date().toISOString(),
          status: 'completed',
          progressPct: 100
        }
      }));

      if (saveFileToDevice) {
        triggerBrowserDownload(result.blob, result.filename);
      }

      showToast(
        `${t('Downloaded', 'دانلود کامل شد')}: ${itemTitle} (${formatBytes(result.blob.size)})`,
        t('Downloads', 'دانلودهای من'),
        () => {
          setLibraryTabRequest('downloads');
          setRoute('library');
        }
      );
    },
    [showToast, t]
  );

  const handleSaveDownloadToDevice = useCallback(
    async (item: PrototypeMediaItem) => {
      const existing = downloadsMapRef.current[item.id];
      const blob = await loadOfflineMediaBlob(item.id);
      if (blob) {
        triggerBrowserDownload(blob, buildDownloadFilename(item, existing?.mimeType || blob.type));
        showToast(
          `${t(item.titleEn, item.titleFa)} — ${t('Saved file to device.', 'فایل روی دستگاه دانلود شد.')}`
        );
        return;
      }
      await handleDownloadItem(item, true);
    },
    [handleDownloadItem, showToast, t]
  );

  const handleDeleteDownload = useCallback(
    (contentId: string) => {
      void deleteOfflineMediaBlob(contentId);
      setDownloadsMap((prev) => {
        const next = { ...prev };
        delete next[contentId];
        return next;
      });
      showToast(t('Offline download deleted.', 'فایل آفلاین حذف شد.'));
    },
    [showToast, t]
  );

  const handleToggleFavorite = useCallback(
    (item: PrototypeMediaItem) => {
      const wasFavorite = favoriteIds.has(item.id);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
      if (wasFavorite) {
        showToast(t('Removed from Favorites', 'از علاقه‌مندی‌ها حذف شد'));
      } else {
        showToast(t('Added to Favorites', 'به علاقه‌مندی‌ها اضافه شد'));
        if (user.personalizationEnabled) {
          setUserVector((v) => blendVector(v, item.vector, 0.16));
        }
      }
    },
    [favoriteIds, showToast, t, user.personalizationEnabled]
  );

  const handleFeedback = useCallback(
    (item: PrototypeMediaItem, sentiment: 'like' | 'dislike' | 'less_like_this') => {
      const prevRecord = feedbackMap[item.id];
      const prevVec = userVector;
      setFeedbackMap((prev) => ({
        ...prev,
        [item.id]: { contentId: item.id, sentiment, updatedAt: new Date().toISOString() }
      }));

      if (user.personalizationEnabled) {
        if (sentiment === 'like') {
          setUserVector((v) => blendVector(v, item.vector, 0.24));
        } else {
          const invertedTarget: TasteVector6D = {
            tension: 1 - item.vector.tension,
            pace: 1 - item.vector.pace,
            surrealism: 1 - item.vector.surrealism,
            nocturnal: 1 - item.vector.nocturnal,
            intimacy: 1 - item.vector.intimacy,
            depth: 1 - item.vector.depth
          };
          setUserVector((v) => blendVector(v, invertedTarget, 0.18));
        }
      }

      showToast(
        sentiment === 'like'
          ? t('Taste calibrated (More like this)', 'سلیقه شما به‌روزرسانی شد (مشابه این بیشتر)')
          : t('Feed tuned down for this style', 'رتبه‌بندی تطبیق داده شد (کمتر از این سبک)'),
        t('Undo', 'بازگردانی'),
        () => {
          setFeedbackMap((curr) => {
            const copy = { ...curr };
            if (prevRecord) copy[item.id] = prevRecord;
            else delete copy[item.id];
            return copy;
          });
          setUserVector(prevVec);
        }
      );
    },
    [feedbackMap, userVector, user.personalizationEnabled, showToast, t]
  );

  const handleHideItem = useCallback(
    (item: PrototypeMediaItem) => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
      showToast(
        t('Item hidden from your feeds', 'این مورد از فید شما مخفی شد'),
        t('Undo', 'لغو مخفی‌سازی'),
        () => {
          setHiddenIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
        }
      );
    },
    [showToast, t]
  );

  const handleSaveProgress = useCallback(
    (contentId: string, positionSec: number, durationSec: number, completed: boolean) => {
      setProgressMap((prev) => ({
        ...prev,
        [contentId]: {
          contentId,
          positionSec,
          durationSec,
          completed,
          lastWatchedAt: new Date().toISOString()
        }
      }));
    },
    []
  );

  const handlePersonalizeTasteFromSearch = useCallback(
    (targetVector: TasteVector6D, alpha = 0.32) => {
      if (!user.personalizationEnabled) return;
      setUserVector((prev) => blendVector(prev, targetVector, alpha));
    },
    [user.personalizationEnabled]
  );

  const handleExportPersonalData = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      storageEngine: 'In-App Local Vault (localStorage + IndexedDB)',
      userAccount: user,
      tasteVector6D: userVector,
      watchProgress: progressMap,
      favoriteIds: Array.from(favoriteIds),
      collections,
      downloads: downloadsMap,
      feedbackMap
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `personal-universe-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      t('Personal JSON archive downloaded.', 'خروجی داده‌های شما در قالب فایل JSON دانلود شد.')
    );
  }, [user, userVector, progressMap, favoriteIds, collections, downloadsMap, feedbackMap, showToast, t]);

  const handleResetPrototype = useCallback(() => {
    Object.keys(downloadsMapRef.current).forEach((id) => {
      void deleteOfflineMediaBlob(id);
    });
    void clearVaultSnapshot();
    const validOnly = dynamicStreamSync.getStreams()
      .filter((s) => Boolean(
        (s.defaultStreamUrl && s.defaultStreamUrl.startsWith('http') && !s.defaultStreamUrl.includes('oceans.mp4')) ||
        (s.qualities && s.qualities.some((q) => q.url && q.url.startsWith('http') && !q.url.includes('oceans.mp4')))
      ))
      .map(convertDynamicStreamToMediaItem);
    setCatalog(validOnly);
    setUser(INITIAL_USER_STATE);
    setUserVector(DEFAULT_TASTE_VECTOR);
    setProgressMap({});
    setFavoriteIds(new Set());
    setHiddenIds(new Set());
    setRecentIds([]);
    setFeedbackMap({});
    setCollections(INITIAL_COLLECTIONS_SEED);
    setDownloadsMap({});
    setSearchFilters(INITIAL_SEARCH_FILTERS);
    setUiState('normal');
    setOnboardingDone(false);
    showToast(t('In-app memory wiped and reset cleanly.', 'حافظه داخل اپلیکیشن پاک‌سازی و بازنشانی شد.'));
  }, [showToast, t]);

  const effectiveNavItems: Array<{
    id: PrototypeRoute;
    fa: string;
    en: string;
    icon: React.ReactNode;
  }> = useMemo(
    () => [
      { id: 'universe', fa: 'سینما', en: 'Cinema', icon: <Ticket className="h-4 w-4" /> },
      { id: 'discover', fa: 'کاوش', en: 'Discover', icon: <Compass className="h-4 w-4" /> },
      { id: 'search', fa: 'جستجو', en: 'Search', icon: <Search className="h-4 w-4" /> },
      { id: 'library', fa: 'آرشیو', en: 'Archive', icon: <Film className="h-4 w-4" /> },
      { id: 'settings', fa: 'تنظیمات', en: 'Settings', icon: <Settings className="h-4 w-4" /> }
    ],
    []
  );

  // Entry Gate Routes render full-screen without main app chrome
  if (
    route === 'splash' ||
    route === 'welcome' ||
    route === 'age-gate' ||
    route === 'onboarding'
  ) {
    return (
      <MotionConfig reducedMotion={user.reducedMotion ? 'always' : 'user'}>
        <div className={user.highContrast ? 'contrast-125' : ''}>
          <EntryFlow
            route={route}
            lang={lang}
            user={user}
            onOpenLanguagePicker={() => setLangPickerOpen(true)}
            onNavigate={(nextRoute) => {
              if (nextRoute === 'universe') {
                setOnboardingDone(true);
              }
              navigateTo(nextRoute);
            }}
            onUpdateUser={handleUpdateUser}
            onApplyOnboardingPresets={handleApplyOnboardingPresets}
            onQuickEnterUniverse={handleQuickEnterUniverse}
          />
          <LanguagePickerModal
            isOpen={langPickerOpen}
            currentLang={lang}
            onSelect={setLang}
            onClose={() => setLangPickerOpen(false)}
          />
          <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
        </div>
      </MotionConfig>
    );
  }

  if (route === 'landing') {
    return (
      <MotionConfig reducedMotion={user.reducedMotion ? 'always' : 'user'}>
        <AipetrosLandingScreen
          onEnterCinema={() => {
            if (typeof window !== 'undefined') {
              window.location.hash = 'cinema';
            }
            navigateTo('universe');
          }}
        />
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion={user.reducedMotion ? 'always' : 'user'}>
      {/* Full-Screen Cinema Startup Loader */}
      <AnimatePresence>
        {isAppInitializing && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeInOut' } }}
            className="fixed inset-0 z-[500] flex flex-col items-center justify-center bg-[#06070C] text-white p-6 text-center select-none"
          >
            {/* Ambient Background Glow */}
            <div className="absolute w-80 h-80 rounded-full bg-[#F5B942]/10 blur-[100px] pointer-events-none animate-pulse" />
            
            <div className="relative z-10 flex flex-col items-center max-w-sm space-y-6">
              {/* Brand Emblem */}
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#F5B942]/20 via-[#F5B942]/10 to-transparent border border-[#F5B942]/40 flex items-center justify-center text-[#F5B942] font-black text-3xl shadow-2xl shadow-[#F5B942]/20">
                  P
                </div>
                <div className="absolute -inset-1 rounded-3xl border border-[#F5B942]/30 animate-ping opacity-30" />
              </div>

              {/* Title & Brand */}
              <div className="space-y-1.5">
                <h1 className="font-editorial text-2xl sm:text-3xl tracking-[0.16em] text-[#F5B942] font-bold">
                  ai petros
                </h1>
                <p className="text-xs uppercase tracking-widest text-[#A3AEC2]">
                  Petros Cinema · Aipetros-stream
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#F5B942] via-[#00F0FF] to-[#F5B942]"
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                />
              </div>

              {/* Dynamic Status Text */}
              <p className="text-xs font-medium text-slate-300 min-h-[32px] transition-all">
                {syncStatusText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`min-h-[100dvh] bg-[#06070C] text-[#F5F7FA] flex flex-col ${
          user.highContrast ? 'contrast-125' : ''
        } ${user.reducedMotion ? 'reduced-motion-mode' : ''}`}
      >
        {/* Top Clean 3-Zone Header */}
        <header className="sticky top-0 z-40 w-full border-b border-[rgba(212,175,55,0.18)] bg-[#050508]/85 backdrop-blur-2xl transition-all">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Zone 1: VIP Cinema Branding (AI PETROS) */}
            <button
              id="tour-step-brand"
              type="button"
              onClick={() => navigateTo('universe')}
              className="min-h-[44px] flex items-center gap-2.5 text-start cursor-pointer shrink-0 group"
              aria-label={t('Go to AI PETROS Cinema', 'رفتن به سینمای هوش مصنوعی پتروس')}
            >
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(212,175,55,0.4)] bg-gradient-to-br from-[#1a1710] via-[#0B0C10] to-[#050508] shadow-[0_0_16px_rgba(212,175,55,0.25)] group-hover:shadow-[0_0_24px_rgba(212,175,55,0.45)] transition-all">
                <Film className="h-5 w-5 text-[#D4AF37] group-hover:scale-110 transition-transform" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4AF37] animate-ping opacity-75" />
              </div>
              <div className="flex flex-col">
                <span className="font-cinzel text-lg sm:text-xl font-bold tracking-[0.22em] text-[#D4AF37] drop-shadow-[0_2px_12px_rgba(212,175,55,0.45)]">
                  AI PETROS
                </span>
                <span className="text-[9px] tracking-[0.28em] uppercase text-[#A3AEC2]/70 font-sans -mt-0.5">
                  VIP Cinema Space
                </span>
              </div>
              <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25 shadow-[0_0_10px_rgba(212,175,55,0.15)]">
                <Radio className="w-2.5 h-2.5 animate-pulse text-[#D4AF37]" />
                <span className="tracking-wider uppercase">VIP 4K HDR</span>
              </span>
            </button>

            {/* Zone 2: Desktop Single-Line Primary Links with Sliding Indicator */}
            <nav id="tour-step-desktop-nav" className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
              {effectiveNavItems.map((nav) => {
                const active = route === nav.id;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => navigateTo(nav.id)}
                    className={`relative min-h-[40px] inline-flex items-center gap-1.5 rounded-full px-4 text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                      active
                        ? 'text-[#050508] font-bold shadow-[0_0_18px_rgba(212,175,55,0.4)]'
                        : 'text-[#A3AEC2] hover:text-[#D4AF37] hover:bg-white/[0.04]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="desktopNavPill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#F5B942] to-[#D4AF37]"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1.5 font-sans">
                      {nav.icon}
                      <span>{t(nav.en, nav.fa)}</span>
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: Decluttered VIP Header Actions (Zero clutter) */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* App Landing & Download Portal Button */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.hash = 'landing';
                  }
                  navigateTo('landing');
                }}
                title={t('Download App & Platforms', 'دانلود اپلیکیشن و تمام پلتفرم‌ها')}
                className="min-h-[36px] px-3.5 inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] text-xs font-semibold text-[#D4AF37] hover:bg-[rgba(212,175,55,0.18)] hover:shadow-[0_0_16px_rgba(212,175,55,0.3)] cursor-pointer transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="text-[11px] font-sans tracking-wide">{t('Get App', 'دریافت اپ')}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 pt-5 sm:pt-6 pb-[calc(5.25rem+env(safe-area-inset-bottom))] md:pb-12">
          <StateBoundary
            uiState={uiState}
            lang={lang}
            onRetry={() => setUiState('normal')}
            onResetFilters={() => {
              setSearchFilters(INITIAL_SEARCH_FILTERS);
              setUiState('normal');
            }}
            onOpenDownloads={() => {
              setUiState('normal');
              setLibraryTabRequest('downloads');
              setRoute('library');
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={route}
                initial={route === 'watch' ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={route === 'watch' ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={route === 'watch' ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {route === 'universe' && (
                  <LivingHomeScreen
                    catalog={catalog}
                    lang={lang}
                    userVector={userVector}
                    personalizationEnabled={user.personalizationEnabled}
                    progressMap={progressMap}
                    favoriteIds={favoriteIds}
                    downloadsMap={downloadsMap}
                    hiddenIds={hiddenIds}
                    blockedTopics={user.blockedTopics}
                    feedbackMap={feedbackMap}
                    collections={collections}
                    onNavigate={navigateTo}
                    onOpenDetail={handleOpenDetail}
                    onPlay={handlePlayItem}
                    onWatchTrailer={(item) => handleWatchTrailer(item)}
                    onDownload={(item) => void handleDownloadItem(item, false)}
                    onToggleFavorite={handleToggleFavorite}
                    onFeedback={handleFeedback}
                    onHide={handleHideItem}
                    onEnablePersonalization={() =>
                      handleUpdateUser({ personalizationEnabled: true, consentPersonalization: true })
                    }
                  />
                )}

                {route === 'discover' && (
                  <DiscoveryUniverseScreen
                    catalog={catalog}
                    lang={lang}
                    userVector={userVector}
                    personalizationEnabled={user.personalizationEnabled}
                    liteMode={user.liteUniverseMode}
                    reducedMotion={user.reducedMotion}
                    favoriteIds={favoriteIds}
                    downloadsMap={downloadsMap}
                    hiddenIds={hiddenIds}
                    blockedTopics={user.blockedTopics}
                    progressMap={progressMap}
                    feedbackMap={feedbackMap}
                    onToggleLiteMode={(lite) => handleUpdateUser({ liteUniverseMode: lite })}
                    onOpenDetail={handleOpenDetail}
                    onPlay={handlePlayItem}
                    onDownload={(item) => void handleDownloadItem(item, false)}
                    onToggleFavorite={handleToggleFavorite}
                    onFeedback={handleFeedback}
                    onHide={handleHideItem}
                  />
                )}

                {route === 'search' && (
                  <IntelligentSearchScreen
                    catalog={catalog}
                    lang={lang}
                    userVector={userVector}
                    personalizationEnabled={user.personalizationEnabled}
                    progressMap={progressMap}
                    favoriteIds={favoriteIds}
                    downloadsMap={downloadsMap}
                    hiddenIds={hiddenIds}
                    blockedTopics={user.blockedTopics}
                    feedbackMap={feedbackMap}
                    filters={searchFilters}
                    onChangeFilters={setSearchFilters}
                    onPersonalizeTaste={handlePersonalizeTasteFromSearch}
                    onOpenDetail={handleOpenDetail}
                    onPlay={handlePlayItem}
                    onDownload={(item) => void handleDownloadItem(item, false)}
                    onToggleFavorite={handleToggleFavorite}
                    onFeedback={handleFeedback}
                    onHide={handleHideItem}
                  />
                )}

                {route === 'watch' && (
                  <CinematicPlayerScreen
                    item={playingItem || catalog[0]}
                    lang={lang}
                    initialProgress={progressMap[(playingItem || catalog[0]).id]}
                    downloadRecord={downloadsMap[(playingItem || catalog[0]).id]}
                    defaultQuality={user.preferredQuality}
                    defaultSubtitleLang={user.defaultSubtitleLang}
                    defaultSpeed={user.defaultSpeed}
                    initialSelectedQualityId={playingQualityId}
                    initialPlaybackMode={playingPlaybackMode}
                    onSaveProgress={handleSaveProgress}
                    onDownload={(item, saveFile, quality) =>
                      void handleDownloadItem(item, saveFile, quality)
                    }
                    onOpenLanguagePicker={() => setLangPickerOpen(true)}
                    onBack={() => {
                      const res = aiAdOptimizationAgent.recordVideoPlayback();
                      if (res.shouldTriggerAd && res.adUnit) {
                        setCurrentAd(res.adUnit);
                        setIsAdModalOpen(true);
                      }
                      navigateTo(previousRouteBeforeWatch);
                    }}
                  />
                )}

                {route === 'library' && (
                  <LibraryScreen
                    catalog={catalog}
                    lang={lang}
                    userVector={userVector}
                    personalizationEnabled={user.personalizationEnabled}
                    progressMap={progressMap}
                    favoriteIds={favoriteIds}
                    downloadsMap={downloadsMap}
                    hiddenIds={hiddenIds}
                    recentIds={recentIds}
                    feedbackMap={feedbackMap}
                    collections={collections}
                    initialTab={libraryTabRequest}
                    onOpenDetail={handleOpenDetail}
                    onPlay={handlePlayItem}
                    onDownload={(item, saveFile) => void handleDownloadItem(item, saveFile)}
                    onSaveDownloadToDevice={(item) => void handleSaveDownloadToDevice(item)}
                    onDeleteDownload={handleDeleteDownload}
                    onToggleFavorite={handleToggleFavorite}
                    onFeedback={handleFeedback}
                    onHide={handleHideItem}
                    onUnhide={(id) =>
                      setHiddenIds((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                      })
                    }
                    onCreateCollection={(name) => {
                      setCollections((prev) => [
                        { id: `col-${Date.now()}`, name, itemIds: [], createdAt: new Date().toISOString() },
                        ...prev
                      ]);
                      showToast(t('Collection created.', 'کلکسیون جدید ایجاد شد.'));
                    }}
                    onDeleteCollection={(id) => {
                      setCollections((prev) => prev.filter((c) => c.id !== id));
                      showToast(t('Collection deleted.', 'کلکسیون حذف شد.'));
                    }}
                    onRemoveFromCollection={(colId, contentId) => {
                      setCollections((prev) =>
                        prev.map((c) =>
                          c.id === colId ? { ...c, itemIds: c.itemIds.filter((x) => x !== contentId) } : c
                        )
                      );
                    }}
                    onClearHistory={() => {
                      setProgressMap({});
                      setRecentIds([]);
                      showToast(t('Watch history cleared.', 'تاریخچه تماشا پاک شد.'));
                    }}
                  />
                )}

                {route === 'settings' && (
                  <SettingsScreen
                    lang={lang}
                    user={user}
                    vaultSizeBytes={vaultSizeBytes}
                    userVector={userVector}
                    catalog={catalog}
                    progressMap={progressMap}
                    feedbackMap={feedbackMap}
                    favoriteIds={favoriteIds}
                    onChangeLang={setLang}
                    onOpenLanguagePicker={() => setLangPickerOpen(true)}
                    onUpdateUser={handleUpdateUser}
                    onUpdateUserVector={(v) => setUserVector(v)}
                    onWipeLocalMemory={() => {
                      handleResetPrototype();
                      navigateTo('universe');
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </StateBoundary>
        </main>

        {/* Mobile Floating VisionOS Spatial Dock with Frosted Glass Pill & Glowing Gold Indicator */}
        <nav
          id="tour-step-mobile-nav"
          className="md:hidden fixed bottom-3 inset-x-3 max-w-md mx-auto z-40 h-16 rounded-[28px] border border-[rgba(212,175,55,0.35)] bg-[#0B0C10]/95 backdrop-blur-2xl px-2 flex items-center justify-around shadow-[0_16px_40px_-8px_rgba(0,0,0,0.95),0_0_24px_-2px_rgba(212,175,55,0.2)]"
          aria-label="Mobile Navigation"
        >
          {effectiveNavItems.map((nav) => {
            const active = route === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => navigateTo(nav.id)}
                className={`relative min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium cursor-pointer transition-all ${
                  active ? 'text-[#D4AF37] font-bold' : 'text-[#A3AEC2] hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobileDockPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-1 rounded-2xl bg-gradient-to-b from-[rgba(212,175,55,0.24)] to-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.55)] shadow-[0_0_16px_rgba(212,175,55,0.3)]"
                  />
                )}
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <span className={`${active ? 'scale-110 text-[#D4AF37]' : 'text-[#A3AEC2]'} transition-transform`}>
                    {nav.icon}
                  </span>
                  <span className="text-[10px] tracking-tight whitespace-nowrap">{t(nav.en, nav.fa)}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Content Detail Modal / Bottom Sheet */}
        <ContentDetailModal
          item={selectedDetailItem}
          catalog={catalog}
          lang={lang}
          isFavorite={selectedDetailItem ? favoriteIds.has(selectedDetailItem.id) : false}
          downloadRecord={selectedDetailItem ? downloadsMap[selectedDetailItem.id] : undefined}
          progress={selectedDetailItem ? progressMap[selectedDetailItem.id] : undefined}
          feedback={selectedDetailItem ? feedbackMap[selectedDetailItem.id] : undefined}
          collections={collections}
          onClose={() => setSelectedDetailItem(null)}
          onPlay={handlePlayItem}
          onWatchTrailer={handleWatchTrailer}
          onDownload={(item, saveFile, quality) => void handleDownloadItem(item, saveFile, quality)}
          onSelectItem={handleOpenDetail}
          onToggleFavorite={handleToggleFavorite}
          onToggleCollectionItem={(colId, contentId) => {
            setCollections((prev) =>
              prev.map((c) => {
                if (c.id !== colId) return c;
                const exists = c.itemIds.includes(contentId);
                return {
                  ...c,
                  itemIds: exists
                    ? c.itemIds.filter((x) => x !== contentId)
                    : [...c.itemIds, contentId]
                };
              })
            );
          }}
          onFeedback={handleFeedback}
          onHide={handleHideItem}
          onSubmitReport={(item) => {
            handleHideItem(item);
          }}
          onOpenLanguagePicker={() => setLangPickerOpen(true)}
        />

        {/* World Languages Picker Modal */}
        <LanguagePickerModal
          isOpen={langPickerOpen}
          currentLang={lang}
          onSelect={setLang}
          onClose={() => setLangPickerOpen(false)}
        />

        {/* Smart Privacy-First Crypto Ad Modal (No KYC) - Handled by AI Ad Optimization Agent */}
        <CryptoAdModal
          isOpen={isAdModalOpen}
          ad={currentAd}
          onClose={() => {
            if (currentAd) {
              aiAdOptimizationAgent.registerImpressionCredit(currentAd);
            }
            setIsAdModalOpen(false);
          }}
          lang={lang === 'fa' ? 'fa' : 'en'}
        />

        {/* Interactive On-Screen Spotlight Tour */}
        <InteractiveSpotlightTour
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
          lang={lang}
          currentRoute={route}
          onNavigateToTab={(targetRoute) => navigateTo(targetRoute)}
        />

        {/* Undo / Notification Toast */}
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />

        {/* Confidential Owner Secret Portal (Zero public UI exposure, master key protected) */}
        {ownerPortalState.isOpen && (
          <OwnerSecretPortal
            initialTab={ownerPortalState.tab}
            onClose={() => {
              setOwnerPortalState({ isOpen: false, tab: 'wallets' });
              if (window.location.hash.includes('owner-')) {
                history.replaceState(null, '', window.location.pathname + window.location.search);
              }
            }}
            onRefreshCatalog={() => {
              const updatedStreams = dynamicStreamSync.getStreams()
                .filter((s) => Boolean(
                  (s.defaultStreamUrl && s.defaultStreamUrl.startsWith('http') && !s.defaultStreamUrl.includes('oceans.mp4')) ||
                  (s.qualities && s.qualities.some((q) => q.url && q.url.startsWith('http') && !q.url.includes('oceans.mp4')))
                ));
              if (updatedStreams.length > 0) {
                const converted = updatedStreams.map(convertDynamicStreamToMediaItem);
                setCatalog(converted);
                showToast(
                  lang === 'fa'
                    ? `کاتالوگ با ${converted.length} فیلم و سریال واقعی به‌روزرسانی شد!`
                    : `Catalog updated with ${converted.length} active streams!`
                );
              }
            }}
          />
        )}
        {/* PWA 2-Second Instant Install Prompt */}
        <InstantInstallBanner />
      </div>
    </MotionConfig>
  );
}
