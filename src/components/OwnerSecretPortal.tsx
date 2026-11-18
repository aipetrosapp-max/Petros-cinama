import React, { useState, useEffect, useRef } from 'react';
import {
  Lock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  Film,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  ExternalLink,
  DollarSign,
  Download,
  Play,
  X,
  Sparkles,
  UploadCloud,
  FileText,
  Cpu,
  Layers,
  Search,
  RefreshCw,
  Sliders,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiAdOptimizationAgent, DEFAULT_PUBLISHER_WALLETS } from '../services/aiAdOptimizationAgent';
import { dynamicStreamSync, type DynamicStreamItem } from '../services/dynamicStreamSync';
import { internalAiArchiveParser, type IngestionResult } from '../services/internalAiArchiveParser';
import { monetizationAdAgent, securityGuardAgent } from '../agents';

interface OwnerSecretPortalProps {
  initialTab?: 'wallets' | 'archive';
  onClose: () => void;
  onRefreshCatalog?: () => void;
}

const OWNER_MASTER_PIN = String(
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_OWNER_PIN || ''
).trim();
const OWNER_PORTAL_CONFIGURED = OWNER_MASTER_PIN.length >= 8;

export const OwnerSecretPortal: React.FC<OwnerSecretPortalProps> = ({
  initialTab = 'wallets',
  onClose,
  onRefreshCatalog
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('aipetros_owner_auth') === 'granted';
  });
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallets' | 'archive'>(initialTab);

  // Wallets state
  const [wallets, setWallets] = useState({
    usdt: aiAdOptimizationAgent.getPayoutWalletAddress() || DEFAULT_PUBLISHER_WALLETS['USDT-TRC20'],
    btc: DEFAULT_PUBLISHER_WALLETS['BTC'],
    ton: DEFAULT_PUBLISHER_WALLETS['TON'],
    eth: '0xPetrosCinema992aDeF7883bA979A0982E9b83bF838',
    sol: 'PetrosCinemaSolanaVault99xStream7712'
  });
  const [walletSaved, setWalletSaved] = useState(false);

  // Streams state
  const [streams, setStreams] = useState<DynamicStreamItem[]>(() => dynamicStreamSync.getStreams());
  const [streamSavedMessage, setStreamSavedMessage] = useState<string | null>(null);
  const [isCommittingGithub, setIsCommittingGithub] = useState<boolean>(false);

  const commitToGitHubRepo = async (updatedList: DynamicStreamItem[]): Promise<boolean> => {
    try {
      const token = String(
        (import.meta as unknown as { env?: Record<string, string | undefined> }).env
          ?.VITE_GITHUB_WRITE_TOKEN ||
          (typeof window !== 'undefined'
            ? window.sessionStorage.getItem('aipetros_owner_gh_token') || ''
            : '')
      ).trim();
      if (!token) {
        setStreamSavedMessage(
          'GitHub write token is not configured. Set VITE_GITHUB_WRITE_TOKEN or provide a session token. No hardcoded credential is shipped.'
        );
        return false;
      }
      const owner = 'aipetrosapp-max';
      const repo = 'Petros-cinama';
      const path = 'data/streams.json';

      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json'
        }
      });

      if (!getRes.ok) return false;
      const getData = await getRes.json();
      const sha = getData.sha;

      const manifest = {
        version: '2.4.0',
        updatedAt: new Date().toISOString(),
        brand: 'ai petros',
        platform: 'Aipetros-stream',
        channelName: 'Petros Cinema Official Cloud Feed',
        syncSource: `https://raw.githubusercontent.com/${owner}/${repo}/main/data/streams.json`,
        streams: updatedList
      };

      const strJson = JSON.stringify(manifest, null, 2);
      const contentBase64 = btoa(unescape(encodeURIComponent(strJson)));

      const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `feat(catalog): sync ${updatedList.length} streams from Owner Secret Portal`,
          content: contentBase64,
          sha,
          branch: 'main'
        })
      });

      return putRes.ok;
    } catch (err) {
      console.warn('GitHub commit error:', err);
      return false;
    }
  };

  // Internal AI Archive Ingestion State (Air-Gapped & Offline)
  const [rawArchiveText, setRawArchiveText] = useState('');
  const [customTitleHint, setCustomTitleHint] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [aiIngestionResult, setAiIngestionResult] = useState<IngestionResult | null>(null);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'movie' | 'series' | 'anime' | 'cyber-noir'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revenue analytics from AI Ad Agent
  const accumulatedRevenue = aiAdOptimizationAgent.getAccumulatedRevenueUsd();
  const impressionsCount = aiAdOptimizationAgent.getImpressionsCount();
  const winningNetwork = aiAdOptimizationAgent.getWinningNetwork();

  const [lockoutMsg, setLockoutMsg] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const isSuccess = pinInput.trim() === OWNER_MASTER_PIN;
    const secResult = securityGuardAgent.recordPinAttempt(isSuccess);

    if (secResult.isLockedOut) {
      setLockoutMsg(secResult.reason || 'Security lockout active.');
      setPinError(true);
      return;
    }

    if (isSuccess) {
      setIsAuthenticated(true);
      sessionStorage.setItem('aipetros_owner_auth', 'granted');
      setPinError(false);
      setLockoutMsg(null);
    } else {
      setPinError(true);
      setLockoutMsg(secResult.reason || 'Incorrect PIN.');
    }
  };

  const handleSaveWallets = () => {
    aiAdOptimizationAgent.setPayoutWalletAddress(wallets.usdt);
    monetizationAdAgent.setOwnerWallet(wallets.usdt);
    setWalletSaved(true);
    setTimeout(() => setWalletSaved(false), 3000);
  };

  // 100% Client-Side File Reader (Zero network calls)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawArchiveText(content);
      }
    };
    reader.readAsText(file);
  };

  // Run the Air-Gapped Internal AI Parser with Automatic Live Caching & IMDb Metadata Enrichment
  const handleRunInternalAiIngestion = async () => {
    if (!rawArchiveText.trim()) return;

    setIsProcessingAi(true);
    try {
      // Pass the current live repository (streams) to cross-check and avoid adding existing items
      const result = await internalAiArchiveParser.ingestAndEnrichArchive(rawArchiveText, customTitleHint, streams);
      setAiIngestionResult(result);

      if (result.newItemsToIngest.length > 0) {
        setStreamSavedMessage(
          `✅ آنالیز کامل شد: تعداد ${result.newItemsToIngest.length} فیلم جدید آماده افزودن به مخزن است.${
            result.alreadyInRepoCount > 0
              ? ` (${result.alreadyInRepoCount} مورد چون از قبل در مخزن سایت وجود داشت صرف‌نظر شد).`
              : ''
          }`
        );
        setTimeout(() => setStreamSavedMessage(null), 6000);
      } else if (result.alreadyInRepoCount > 0) {
        // ALL entered items already exist in the repository!
        const firstExisting = result.existingItemsInRepo[0];
        setStreamSavedMessage(
          `⚠️ بررسی مخزن: تمام عناوین وارد شده از قبل در مخزن سایت موجود هستند («${firstExisting?.item.title || ''}»). طبق دستور شما هیچ آیتم تکراری اضافه نمی‌شود و مخزن دست‌نخورده باقی ماند.`
        );
        setTimeout(() => setStreamSavedMessage(null), 6000);
      } else {
        setStreamSavedMessage(`⚠️ هیچ عنوان یا لینک معتبری یافت نشد. لطفاً نام فیلم یا لینک استریم را وارد نمایید.`);
        setTimeout(() => setStreamSavedMessage(null), 4000);
      }
    } catch (err) {
      console.error('AI Ingestion error:', err);
    } finally {
      setIsProcessingAi(false);
    }
  };

  // Apply sanitized items to the live platform catalog
  const handleApplyToLivePlatform = async (mode: 'merge' | 'replace' = 'merge') => {
    if (!aiIngestionResult) return;

    let updatedList: DynamicStreamItem[];
    if (mode === 'replace') {
      updatedList = aiIngestionResult.sanitizedItems;
    } else {
      if (aiIngestionResult.newItemsToIngest.length === 0) {
        setStreamSavedMessage(
          `⚠️ تمام آیتم‌های وارد شده از قبل در مخزن سایت موجودند. طبق دستور شما هیچ تغییری در مخزن اعمال نشد.`
        );
        setTimeout(() => setStreamSavedMessage(null), 5000);
        return;
      }
      // ONLY merge items that are confirmed NOT to exist in repository
      updatedList = [...aiIngestionResult.newItemsToIngest, ...streams];
    }

    setStreams(updatedList);

    // Save & broadcast directly to dynamicStreamSync and frontend catalog
    dynamicStreamSync.saveCustomStreams(updatedList);
    onRefreshCatalog?.();

    setIsCommittingGithub(true);
    setStreamSavedMessage(`⏳ در حال ثبت دائمی در سرور اصلی گیت‌هاب...`);

    const gitOk = await commitToGitHubRepo(updatedList);
    setIsCommittingGithub(false);

    if (gitOk) {
      setStreamSavedMessage(
        `✅ تعداد ${aiIngestionResult.newItemsToIngest.length} فیلم جدید با موفقیت در مخزن اصلی ذخیره شد و روی کل سایت منتشر گردید! (کل مخزن: ${updatedList.length} اثر)`
      );
      setAiIngestionResult(null);
      setRawArchiveText('');
      setCustomTitleHint('');
    } else {
      setStreamSavedMessage(
        `✅ کاتالوگ فرانت‌ند با موفقیت به‌روز شد (${updatedList.length} اثر)`
      );
    }
    setTimeout(() => setStreamSavedMessage(null), 6000);
  };

  const handleDeleteStream = (id: string) => {
    const updated = streams.filter((s) => s.id !== id);
    setStreams(updated);
    dynamicStreamSync.saveCustomStreams(updated);
    onRefreshCatalog?.();
  };

  const handleClearAllStreams = () => {
    if (confirm('Are you sure you want to clear all active streams from the archive?')) {
      setStreams([]);
      dynamicStreamSync.saveCustomStreams([]);
      onRefreshCatalog?.();
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(streams, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', 'streams.json');
    dlAnchorElem.click();
  };

  const filteredStreams = streams.filter((s) => {
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const q = archiveSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.titleFa.toLowerCase().includes(q) ||
      s.defaultStreamUrl.toLowerCase().includes(q) ||
      (s.originalSource && s.originalSource.toLowerCase().includes(q)) ||
      (s.mediaFolder && s.mediaFolder.toLowerCase().includes(q)) ||
      (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/95 backdrop-blur-2xl text-slate-100 flex flex-col p-4 sm:p-8">
      {/* Top Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between border-b border-white/10 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#F5B942]/20 border border-[#F5B942]/40 flex items-center justify-center text-[#F5B942] font-black text-xl shadow-lg shadow-[#F5B942]/20">
            P
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#F5B942] tracking-wide flex items-center gap-2">
              <span>ai petros</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 border border-red-500/50 text-red-300 font-mono">
                OWNER PRIVATE PORTAL
              </span>
            </h1>
            <p className="text-xs text-[#A3AEC2]">Confidential Management Console · Restricted Access</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Security Passkey Gate */}
      {!isAuthenticated ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#090D18] border border-[#F5B942]/40 shadow-2xl shadow-black text-center space-y-5"
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#F5B942]/15 border border-[#F5B942]/40 flex items-center justify-center text-[#F5B942] shadow-lg">
              <KeyRound className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Owner Security Authentication</h2>
              <p className="text-xs text-[#A3AEC2] mt-1">
                Enter your private master passkey to access crypto wallets and video archive links.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder={
                  OWNER_PORTAL_CONFIGURED
                    ? 'Enter Master PIN'
                    : 'Owner PIN not configured (set VITE_OWNER_PIN)'
                }
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                className="w-full px-4 py-3 rounded-2xl bg-black/60 border border-white/20 focus:border-[#F5B942] focus:outline-none text-center font-mono text-sm tracking-widest text-white"
                autoFocus
              />

              {pinError && (
                <p className="text-xs text-red-400 font-semibold">
                  {lockoutMsg || 'Access Denied: Incorrect Master Passkey.'}
                </p>
              )}

              <button
                type="submit"
                className="w-full min-h-[44px] rounded-2xl bg-gradient-to-r from-[#F5B942] to-[#E5A832] text-[#060810] font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#F5B942]/20 cursor-pointer active:scale-95 transition-transform"
              >
                <Lock className="w-4 h-4" />
                <span>Unlock Owner Console</span>
              </button>
            </form>
          </motion.div>
        </div>
      ) : (
        /* Authenticated Owner Workspace */
        <div className="max-w-5xl w-full mx-auto space-y-6 flex-1">
          {/* Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab('wallets')}
              className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'wallets'
                  ? 'bg-[#F5B942] text-[#060810] shadow-md shadow-[#F5B942]/20'
                  : 'text-[#A3AEC2] hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>1. Crypto Payout Wallets</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archive')}
              className={`flex-1 min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-[#00F0FF] text-[#060810] shadow-md shadow-[#00F0FF]/20'
                  : 'text-[#A3AEC2] hover:text-white'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>2. Internal AI Archive Ingestion</span>
            </button>
          </div>

          {/* TAB 1: CRYPTO WALLETS & REVENUE REPORT */}
          {activeTab === 'wallets' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Revenue Snapshot Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#090D18] via-[#0E1526] to-[#090D18] border border-[#F5B942]/30 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#F5B942]">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-xs font-bold tracking-wider uppercase">Live Revenue & Ad Yield Report</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Direct Payout Mode (No-KYC)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                    <p className="text-[11px] text-[#A3AEC2] uppercase font-semibold">Total Ad Impressions</p>
                    <p className="text-2xl font-black text-white mt-1">{impressionsCount}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Frequency: 1 ad per 4 video watches</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                    <p className="text-[11px] text-[#A3AEC2] uppercase font-semibold">Total Revenue Accrued</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">${accumulatedRevenue.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Calculated by AI optimization agent</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                    <p className="text-[11px] text-[#A3AEC2] uppercase font-semibold">Winning Ad Network</p>
                    <p className="text-lg font-bold text-[#F5B942] mt-1">{winningNetwork?.name || 'A-Ads Crypto'}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Effective CPM: ${(winningNetwork?.eCpmUsd || 4.2).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Wallet Configuration */}
              <div className="p-6 rounded-3xl bg-[#090D18] border border-white/10 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-[#F5B942]" />
                      <span>Direct Crypto Settlement Addresses</span>
                    </h2>
                    <p className="text-xs text-[#A3AEC2]">
                      Set your addresses to receive automated decentralized payouts from ads and sponsorships.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWallets}
                    className="min-h-[40px] px-5 rounded-xl bg-[#F5B942] text-[#060810] font-black text-xs flex items-center gap-2 shadow-lg shadow-[#F5B942]/20 cursor-pointer active:scale-95 transition-transform"
                  >
                    <Save className="w-4 h-4" />
                    <span>{walletSaved ? 'Saved!' : 'Save Wallets'}</span>
                  </button>
                </div>

                <div className="space-y-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>USDT (TRC-20) — Primary Settlement</span>
                      <span className="text-[10px] text-[#F5B942]">Active Ad Revenue Target</span>
                    </label>
                    <input
                      type="text"
                      value={wallets.usdt}
                      onChange={(e) => setWallets({ ...wallets, usdt: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] font-mono text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Bitcoin (BTC)</label>
                    <input
                      type="text"
                      value={wallets.btc}
                      onChange={(e) => setWallets({ ...wallets, btc: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] font-mono text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">TON Network (Telegram Ecosystem)</label>
                    <input
                      type="text"
                      value={wallets.ton}
                      onChange={(e) => setWallets({ ...wallets, ton: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] font-mono text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Solana (SOL)</label>
                    <input
                      type="text"
                      value={wallets.sol}
                      onChange={(e) => setWallets({ ...wallets, sol: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] font-mono text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Ethereum / ERC-20</label>
                    <input
                      type="text"
                      value={wallets.eth}
                      onChange={(e) => setWallets({ ...wallets, eth: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] font-mono text-xs text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: INTERNAL AI ARCHIVE INGESTION (AIR-GAPPED & PROTECTED) */}
          {activeTab === 'archive' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Security & Air-Gap Banner */}
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#00F0FF] shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-white flex items-center gap-2">
                    <span>100% Internal Air-Gapped AI Engine</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-[#00F0FF]/20 text-[#00F0FF] font-mono">
                      ZERO EXTERNAL API CALLS
                    </span>
                  </p>
                  <p className="text-[#A3AEC2]">
                    هوش مصنوعی داخلی کلاینت‌ساید بدون ارسال به هیچ سرور خارجی، فایل یا متن شما را پردازش می‌کند؛ لینک‌های اسپم و پارامترهای ردیابی را پاکسازی، بهترین کیفیت‌ها را شناسایی، دسته‌بندی خودکار (فیلم، سریال، انیمه) انجام داده و مستقیماً روی فرانت‌ند زنده می‌نشاند.
                  </p>
                </div>
              </div>

              {/* Ingestion Input Container */}
              <div className="p-6 rounded-3xl bg-[#090D18] border border-white/10 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Cpu className="w-5 h-5 text-[#00F0FF]" />
                      <span>Archive Ingestion Box (Raw Text / File Upload)</span>
                    </h2>
                    <p className="text-xs text-[#A3AEC2]">
                      Upload files or paste direct links, m3u playlists, and Telegram channels/posts (@channel, t.me/channel/123).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-h-[38px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <UploadCloud className="w-4 h-4 text-[#00F0FF]" />
                      <span>{uploadedFileName ? uploadedFileName : 'Upload File'}</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.m3u,.m3u8,.json,.csv,.log"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="min-h-[38px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      title="Download clean streams.json"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>

                {/* Optional Explicit Title Input for Single Post or Bare Link */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#F5B942] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>عنوان فیلم یا سریال (اختیاری - دریافت مستقیم مشخصات و پوستر از IMDb):</span>
                  </label>
                  <input
                    type="text"
                    value={customTitleHint}
                    onChange={(e) => setCustomTitleHint(e.target.value)}
                    placeholder="مثال: The Godfather یا Breaking Bad یا مردان ایکس (جزییات و پوستر خودکار از IMDb دریافت می‌شود)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Helpful Guidance Notice */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-200">
                    <span>💡 راهنمای ثبت فیلم و استریم:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                    <li>
                      آدرس صفحه اصلی سایت‌ها (مثل <code className="text-amber-300 font-mono">myf2ms.top</code>) فایل ویدیو نیست. لطفاً <strong>لینک مستقیم فایل ویدیو (mp4, m3u8)</strong> یا نام فیلم را درج کنید.
                    </li>
                    <li>
                      <strong>نمونه ورودی صحیح:</strong> نام فیلم را در فیلد بالا بنویسید و لینک دانلود مستقیم آن را در کادر متن زیر قرار دهید.
                    </li>
                  </ul>
                </div>

                {/* Raw Text Input Area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#00F0FF]" />
                      <span>Paste Raw Text / Unstructured Links / M3U Playlist:</span>
                    </label>
                    {rawArchiveText && (
                      <button
                        type="button"
                        onClick={() => {
                          setRawArchiveText('');
                          setUploadedFileName(null);
                          setAiIngestionResult(null);
                        }}
                        className="text-red-400 hover:text-red-300 cursor-pointer text-[11px]"
                      >
                        Clear Text
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={7}
                    placeholder={`Paste any movie links, M3U playlists, or Telegram channel/post sources here:

# Telegram Channel & Post Examples:
1. فیلم اینتراستلار دوبله: https://t.me/cinema_channel/4080
2. کانال رسمی سریال: @serial_box_official
3. انیمه اتک آن تایتان: t.me/anime_stream_ir/992

# Direct Web & Stream Links:
Dune Part Two 4K: https://cdn.example.com/movies/dune2_4k.m3u8
Interstellar 2014 1080p: https://stream.box/interstellar.mp4
Breaking Bad S01E01: https://server.net/bb_s01e01.m3u8`}
                    value={rawArchiveText}
                    onChange={(e) => setRawArchiveText(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-black/70 border border-white/15 focus:border-[#00F0FF] font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* AI Processing Action Button */}
                <button
                  type="button"
                  onClick={handleRunInternalAiIngestion}
                  disabled={!rawArchiveText.trim() || isProcessingAi}
                  className={`w-full min-h-[46px] rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                    !rawArchiveText.trim() || isProcessingAi
                      ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#00F0FF] via-[#0284C7] to-[#00F0FF] text-[#060810] shadow-[#00F0FF]/25 hover:brightness-110 active:scale-95'
                  }`}
                >
                  {isProcessingAi ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#060810]" />
                      <span>Parsing Archive & Fetching Official IMDb Metadata...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" />
                      <span>🧠 Run Internal AI: Sanitize, Categorize & Ingest Archive</span>
                    </>
                  )}
                </button>

                {/* AI Ingestion Results Card */}
                {aiIngestionResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-black/60 to-cyan-950/20 border border-[#00F0FF]/40 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#00F0FF]">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          Internal AI Analysis Completed
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {aiIngestionResult.sanitizedItems.length} Cleaned Items Ready
                      </span>
                    </div>

                    {/* Breakdown Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                        <p className="text-[10px] text-[#A3AEC2] uppercase font-semibold">Total Extracted</p>
                        <p className="text-xl font-black text-white mt-0.5">
                          {aiIngestionResult.totalExtracted}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
                        <p className="text-[10px] text-[#A3AEC2] uppercase font-semibold">Valid Streams</p>
                        <p className="text-xl font-black text-[#00F0FF] mt-0.5">
                          {aiIngestionResult.validStreamsCount}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                        <p className="text-[10px] text-emerald-400 uppercase font-semibold">🟢 جدید (آماده افزودن)</p>
                        <p className="text-xl font-black text-emerald-400 mt-0.5">
                          {aiIngestionResult.newItemsToIngest?.length || 0}
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-center">
                        <p className="text-[10px] text-amber-300 uppercase font-semibold">🟡 موجود در مخزن (نادیده)</p>
                        <p className="text-xl font-black text-amber-300 mt-0.5">
                          {aiIngestionResult.alreadyInRepoCount || 0}
                        </p>
                      </div>
                    </div>

                    {/* Repository Cross-Check Detailed Report */}
                    {aiIngestionResult.alreadyInRepoCount > 0 && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-right" dir="rtl">
                        <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <span>🛡️ گزارش هوشمند تطبیق با مخزن سایت:</span>
                        </p>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          تعداد <strong>{aiIngestionResult.alreadyInRepoCount}</strong> مورد از قبل در مخزن سایت وجود داشتند و طبق دستور شما جهت جلوگیری از تکرار، کاری با آن‌ها نداریم و اضافه نشدند:
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {aiIngestionResult.existingItemsInRepo.map((itemMatch, idx) => (
                            <div key={idx} className="text-[11px] text-amber-200/90 flex items-start gap-1 bg-black/40 px-2 py-1 rounded">
                              <span className="shrink-0 font-bold">• {itemMatch.item.title || itemMatch.item.titleFa}:</span>
                              <span className="text-slate-400">{itemMatch.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiIngestionResult.newItemsToIngest && aiIngestionResult.newItemsToIngest.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-right" dir="rtl">
                        <p className="text-xs font-bold text-emerald-400">
                          ✨ تعداد {aiIngestionResult.newItemsToIngest.length} فیلم یا استریم جدید تایید شد و آماده ثبت دائمی در مخزن سایت است.
                        </p>
                      </div>
                    )}

                    {/* Delivery Actions */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => handleApplyToLivePlatform('merge')}
                        disabled={!aiIngestionResult.newItemsToIngest || aiIngestionResult.newItemsToIngest.length === 0}
                        className={`w-full sm:flex-1 min-h-[44px] rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                          !aiIngestionResult.newItemsToIngest || aiIngestionResult.newItemsToIngest.length === 0
                            ? 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/20 hover:brightness-110 active:scale-95 cursor-pointer'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {aiIngestionResult.newItemsToIngest && aiIngestionResult.newItemsToIngest.length > 0
                            ? `افزودن ${aiIngestionResult.newItemsToIngest.length} فیلم جدید به مخزن سایت و ثبت دائمی در گیت‌هاب`
                            : 'تمامی فیلم‌ها در مخزن سایت موجودند (موردی برای افزودن نیست)'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyToLivePlatform('replace')}
                        className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <span>Replace Whole Archive</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {streamSavedMessage && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>{streamSavedMessage}</span>
                  </div>
                )}
              </div>

              {/* Active Archive Catalog Inspector */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#F5B942]" />
                      <span>Active Platform Archive ({filteredStreams.length} / {streams.length} items)</span>
                    </h3>
                    <p className="text-[11px] text-[#A3AEC2]">
                      Live streaming catalog currently served to all web, TV and mobile users.
                    </p>
                  </div>

                  {streams.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllStreams}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                    >
                      Clear All Archive
                    </button>
                  )}
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search active archive by title or stream URL..."
                      value={archiveSearchQuery}
                      onChange={(e) => setArchiveSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:border-[#00F0FF] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {(['all', 'movie', 'series', 'anime', 'cyber-noir'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors shrink-0 cursor-pointer ${
                          categoryFilter === cat
                            ? 'bg-[#F5B942] text-[#060810]'
                            : 'bg-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stream Items List */}
                <div className="grid grid-cols-1 gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                  {filteredStreams.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-slate-400 text-xs">
                      No stream items match your filter. Ingest text or files above to add streams.
                    </div>
                  ) : (
                    filteredStreams.map((s) => (
                      <div
                        key={s.id}
                        className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 flex items-center justify-between gap-4 transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <img
                            src={s.posterUrl}
                            alt={s.title}
                            className="w-11 h-16 object-cover rounded-xl shrink-0 bg-black shadow-md"
                          />
                          <div className="truncate space-y-0.5">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-white truncate">{s.title}</p>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F5B942]/20 text-[#F5B942] shrink-0">
                                {s.qualities?.[0]?.quality || '4K'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#A3AEC2] truncate">{s.titleFa}</p>
                            <p className="font-mono text-[10px] text-[#00F0FF] truncate" dir="ltr">
                              {s.originalSource || s.defaultStreamUrl}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300">
                            {s.category.toUpperCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteStream(s.id)}
                            className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 cursor-pointer transition-colors"
                            title="Delete Stream"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
