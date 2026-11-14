import type {
  PrototypeMediaItem,
  UserAccountState
} from './types';

// The entire catalog is now 100% sourced dynamically from authentic verified stream archives
export const PROTOTYPE_MEDIA_CATALOG: PrototypeMediaItem[] = [];

export const INITIAL_USER_STATE: UserAccountState = {
  profileId: 'local-device-vault',
  displayName: 'فضای شخصی شما',
  ageVerified: true,
  jurisdiction: 'global-standard',
  consentEssential: true,
  consentPersonalization: true,
  personalizationEnabled: true,
  blockedTopics: [],
  preferredQuality: 'auto',
  defaultSubtitleLang: 'fa',
  defaultSpeed: 1,
  reducedMotion: false,
  highContrast: false,
  liteUniverseMode: false,
  notificationsEnabled: true,
  digestAlertsEnabled: false,
  sessions: [
    {
      id: 'sess-current',
      deviceLabel: 'حافظه محلی همین دستگاه (In-App Vault)',
      locationLabel: 'Local Device Storage',
      lastActive: 'هم‌اکنون · ذخیره خودکار',
      isCurrent: true
    }
  ]
};
