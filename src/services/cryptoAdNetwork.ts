/**
 * Smart Advertising & Crypto Monetization Engine (No-KYC)
 * ai petros / Petros Cinema (Aipetros-stream)
 * 
 * Implements non-intrusive crypto advertising networks that require
 * zero KYC (Know Your Customer) and preserve complete user privacy.
 * - Primary: A-Ads (Anonymous Ads) - Oldest Bitcoin ad network with no cookies & no KYC
 * - Secondary: Web3 / CoinTraffic / Direct Crypto Sponsorship & Vault
 */

export interface CryptoAdUnit {
  id: string;
  network: 'a-ads' | 'coinzilla' | 'cointraffic' | 'direct-crypto';
  unitType: 'interstitial' | 'banner-728x90' | 'banner-300x250' | 'native-card';
  title: string;
  sponsorName: string;
  description: string;
  ctaText: string;
  targetUrl: string;
  badgeText: string;
  adCodeHtml?: string;
  bannerImageUrl?: string;
}

export interface CryptoTipWallet {
  symbol: 'BTC' | 'USDT-TRC20' | 'ETH' | 'TON';
  name: string;
  address: string;
  qrCodeUrl?: string;
  networkName: string;
}

const STORAGE_AD_CONFIG_KEY = 'aipetros_crypto_ad_config_v1';
const STORAGE_WATCH_COUNT_KEY = 'aipetros_watch_counter_v1';

export const OFFICIAL_CRYPTO_WALLETS: CryptoTipWallet[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin (SegWit)',
    address: 'bc1qpetros94m8k3e7782x4k2streamcinema9802aipetros',
    networkName: 'Bitcoin Mainnet'
  },
  {
    symbol: 'USDT-TRC20',
    name: 'USDT (TRON TRC-20)',
    address: 'TXPetrosCinemaAiStreamNoKycVault7792Xm',
    networkName: 'TRON'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum / USDT ERC-20',
    address: '0xPetrosCinema992aDeF7883bA979A0982E9b83bF838',
    networkName: 'Ethereum Mainnet'
  },
  {
    symbol: 'TON',
    name: 'TON (The Open Network)',
    address: 'EQCPetrosCinemaAiStreamNoKycTonWallet88912',
    networkName: 'TON'
  }
];

// Curated verified No-KYC Crypto Sponsors
export const CURATED_CRYPTO_SPONSORS: CryptoAdUnit[] = [
  {
    id: 'aads-sponsor-01',
    network: 'a-ads',
    unitType: 'interstitial',
    title: 'A-Ads Anonymous Advertising',
    sponsorName: 'A-Ads.com (Since 2011)',
    description: 'Promote your project across Web3 with complete anonymity. Zero KYC, no tracking cookies, direct Bitcoin settlement.',
    ctaText: 'Explore A-Ads',
    targetUrl: 'https://a-ads.com?partner=aipetros',
    badgeText: 'Crypto Sponsor • No KYC',
    bannerImageUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?q=80&w=900&auto=format&fit=crop'
  },
  {
    id: 'aads-sponsor-02',
    network: 'direct-crypto',
    unitType: 'interstitial',
    title: 'Hardware Cold Storage & Privacy VPN',
    sponsorName: 'Trezor & Mullvad Privacy Alliance',
    description: 'Protect your digital sovereignty with audited open-source cold storage and zero-logging privacy nodes.',
    ctaText: 'Verify Privacy Tools',
    targetUrl: 'https://aipetros.stream/privacy-vault',
    badgeText: 'Decentralized Security',
    bannerImageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=900&auto=format&fit=crop'
  },
  {
    id: 'aads-sponsor-03',
    network: 'a-ads',
    unitType: 'banner-728x90',
    title: 'Decentralized Cloud & High-Bitrate Media Nodes',
    sponsorName: 'Akash Network & Filecoin DePIN',
    description: 'Serverless peer-to-peer compute for high-bitrate 4K streaming and decentralized censorship resistance.',
    ctaText: 'Learn More',
    targetUrl: 'https://a-ads.com?partner=aipetros',
    badgeText: 'DePIN Cloud Sponsor',
    bannerImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=900&auto=format&fit=crop'
  }
];

type AdEventListener = (event: 'ad_trigger' | 'ad_close' | 'ad_skip', adUnit: CryptoAdUnit) => void;

class CryptoAdNetworkService {
  private adFrequency = 2; // Show interstitial after every 2-3 videos watched
  private watchCount = 0;
  private listeners: Set<AdEventListener> = new Set();
  private isModalActive = false;
  private currentActiveAd: CryptoAdUnit | null = null;
  private adsEnabled = true;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const storedCount = localStorage.getItem(STORAGE_WATCH_COUNT_KEY);
        if (storedCount) {
          this.watchCount = parseInt(storedCount, 10) || 0;
        }
        const cfg = localStorage.getItem(STORAGE_AD_CONFIG_KEY);
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.adFrequency === 'number') this.adFrequency = parsed.adFrequency;
          if (typeof parsed.adsEnabled === 'boolean') this.adsEnabled = parsed.adsEnabled;
        }
      } catch {
        // ignore
      }
    }
  }

  public getAdFrequency(): number {
    return this.adFrequency;
  }

  public setAdFrequency(frequency: number) {
    this.adFrequency = Math.max(1, Math.min(10, frequency));
    this.saveConfig();
  }

  public isAdsEnabled(): boolean {
    return this.adsEnabled;
  }

  public setAdsEnabled(enabled: boolean) {
    this.adsEnabled = enabled;
    this.saveConfig();
  }

  private saveConfig() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_AD_CONFIG_KEY, JSON.stringify({
        adFrequency: this.adFrequency,
        adsEnabled: this.adsEnabled
      }));
    } catch {}
  }

  public getWatchCount(): number {
    return this.watchCount;
  }

  /**
   * Called when a user starts or finishes watching a video.
   * Increments the watch count and returns true if an interstitial ad should be triggered.
   */
  public recordVideoPlayback(): boolean {
    if (!this.adsEnabled) return false;

    this.watchCount += 1;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_WATCH_COUNT_KEY, String(this.watchCount));
      } catch {}
    }

    if (this.watchCount >= this.adFrequency) {
      this.watchCount = 0;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_WATCH_COUNT_KEY, '0');
        } catch {}
      }
      return true;
    }
    return false;
  }

  public getRandomAd(unitType?: CryptoAdUnit['unitType']): CryptoAdUnit {
    const list = unitType 
      ? CURATED_CRYPTO_SPONSORS.filter(ad => ad.unitType === unitType)
      : CURATED_CRYPTO_SPONSORS;
    const pool = list.length > 0 ? list : CURATED_CRYPTO_SPONSORS;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  public triggerAdModal(ad?: CryptoAdUnit): CryptoAdUnit {
    const chosenAd = ad || this.getRandomAd('interstitial');
    this.currentActiveAd = chosenAd;
    this.isModalActive = true;
    this.notify('ad_trigger', chosenAd);
    return chosenAd;
  }

  public closeAdModal(skipped = false) {
    if (this.currentActiveAd) {
      this.notify(skipped ? 'ad_skip' : 'ad_close', this.currentActiveAd);
    }
    this.isModalActive = false;
    this.currentActiveAd = null;
  }

  public subscribe(listener: AdEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(event: 'ad_trigger' | 'ad_close' | 'ad_skip', ad: CryptoAdUnit) {
    for (const listener of this.listeners) {
      try {
        listener(event, ad);
      } catch (err) {
        console.error('Error in ad listener:', err);
      }
    }
  }
}

export const cryptoAdNetwork = new CryptoAdNetworkService();
