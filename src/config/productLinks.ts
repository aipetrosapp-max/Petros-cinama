/**
 * Product client builds are not attached to the GitHub release yet. The old UI
 * linked to /releases/latest/download/... which returned HTTP 404. Until the
 * binaries are uploaded, the UI must say "coming soon" instead of sending users
 * to a dead page.
 */
export const PRODUCT_RELEASES_READY = false;

export const PRODUCT_RELEASES_PAGE =
  'https://github.com/aipetrosapp-max/Petros-cinama/releases';

export const PRODUCT_CLIENTS = [
  {
    id: 'android',
    nameEn: 'Android Mobile',
    nameFa: 'اندروید موبایل',
    detailEn: 'APK • coming soon',
    detailFa: 'APK • به‌زودی',
    ready: PRODUCT_RELEASES_READY
  },
  {
    id: 'tv',
    nameEn: 'Android TV',
    nameFa: 'تلویزیون هوشمند',
    detailEn: 'TV APK • coming soon',
    detailFa: 'APK تلویزیون • به‌زودی',
    ready: PRODUCT_RELEASES_READY
  },
  {
    id: 'windows',
    nameEn: 'Windows 11',
    nameFa: 'ویندوز دسکتاپ',
    detailEn: 'EXE • coming soon',
    detailFa: 'EXE • به‌زودی',
    ready: PRODUCT_RELEASES_READY
  }
] as const;
