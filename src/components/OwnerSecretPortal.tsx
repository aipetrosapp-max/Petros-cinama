import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  ShieldAlert,
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
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiAdOptimizationAgent, DEFAULT_PUBLISHER_WALLETS } from '../services/aiAdOptimizationAgent';
import { dynamicStreamSync, type DynamicStreamItem } from '../services/dynamicStreamSync';

interface OwnerSecretPortalProps {
  initialTab?: 'wallets' | 'archive';
  onClose: () => void;
  onRefreshCatalog?: () => void;
}

const OWNER_MASTER_PIN = 'petros7788'; // Owner secret passkey

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
  const [newTitle, setNewTitle] = useState('');
  const [newTitleFa, setNewTitleFa] = useState('');
  const [newStreamUrl, setNewStreamUrl] = useState('');
  const [newPosterUrl, setNewPosterUrl] = useState('');
  const [newCategory, setNewCategory] = useState<'movie' | 'series' | 'anime' | 'cyber-noir'>('movie');
  const [newQuality, setNewQuality] = useState<'4K' | '1080p'>('4K');
  const [streamSavedMessage, setStreamSavedMessage] = useState<string | null>(null);

  // Revenue analytics from AI Ad Agent
  const accumulatedRevenue = aiAdOptimizationAgent.getAccumulatedRevenueUsd();
  const impressionsCount = aiAdOptimizationAgent.getImpressionsCount();
  const winningNetwork = aiAdOptimizationAgent.getWinningNetwork();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === OWNER_MASTER_PIN) {
      setIsAuthenticated(true);
      sessionStorage.setItem('aipetros_owner_auth', 'granted');
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  const handleSaveWallets = () => {
    aiAdOptimizationAgent.setPayoutWalletAddress(wallets.usdt);
    setWalletSaved(true);
    setTimeout(() => setWalletSaved(false), 3000);
  };

  const handleAddStream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newStreamUrl.trim()) return;

    const newItem: DynamicStreamItem = {
      id: `stream-custom-${Date.now()}`,
      title: newTitle.trim(),
      titleFa: newTitleFa.trim() || newTitle.trim(),
      category: newCategory,
      year: 2026,
      durationSec: 3600,
      posterUrl: newPosterUrl.trim() || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop',
      synopsis: `Stream archive added via Owner Portal: ${newTitle}`,
      synopsisFa: `استریم جدید اضافه شده در آرشیو اختصاصی: ${newTitleFa || newTitle}`,
      defaultStreamUrl: newStreamUrl.trim(),
      qualities: [
        { quality: newQuality, resolution: newQuality === '4K' ? '3840x2160' : '1920x1080', streamUrl: newStreamUrl.trim(), bitrateKbps: newQuality === '4K' ? 14000 : 6000 }
      ],
      tags: ['Archive', newCategory, newQuality]
    };

    const updated = [newItem, ...streams];
    setStreams(updated);

    // Save into dynamicStreamSync local cache
    try {
      localStorage.setItem('aipetros_dynamic_stream_cache_v1', JSON.stringify(updated));
    } catch {}

    setNewTitle('');
    setNewTitleFa('');
    setNewStreamUrl('');
    setNewPosterUrl('');
    setStreamSavedMessage(`Stream "${newItem.title}" added to active archive!`);
    onRefreshCatalog?.();
    setTimeout(() => setStreamSavedMessage(null), 4000);
  };

  const handleDeleteStream = (id: string) => {
    const updated = streams.filter(s => s.id !== id);
    setStreams(updated);
    try {
      localStorage.setItem('aipetros_dynamic_stream_cache_v1', JSON.stringify(updated));
    } catch {}
    onRefreshCatalog?.();
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(streams, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', 'streams.json');
    dlAnchorElem.click();
  };

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
                placeholder="Enter Master PIN (Default: petros7788)"
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
                  Access Denied: Incorrect Master Passkey.
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
                  ? 'bg-[#F5B942] text-[#060810] shadow-md shadow-[#F5B942]/20'
                  : 'text-[#A3AEC2] hover:text-white'
              }`}
            >
              <Film className="w-4 h-4" />
              <span>2. Film & Series Stream Archive</span>
            </button>
          </div>

          {/* TAB 1: CRYPTO WALLETS & REVENUE REPORT */}
          {activeTab === 'wallets' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Live Revenue Analytics Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-[#0E1322] border border-emerald-500/30 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Total Estimated Ad Revenue
                  </span>
                  <p className="text-2xl font-black text-white font-mono">
                    ${accumulatedRevenue.toFixed(4)} USD
                  </p>
                  <p className="text-[10px] text-[#A3AEC2]">Directly credited to your destination wallet</p>
                </div>

                <div className="p-5 rounded-3xl bg-[#0E1322] border border-blue-500/30 space-y-1">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                    Total Ad Impressions
                  </span>
                  <p className="text-2xl font-black text-white font-mono">
                    {impressionsCount} Views
                  </p>
                  <p className="text-[10px] text-[#A3AEC2]">Triggered strictly every 4 video playbacks</p>
                </div>

                <div className="p-5 rounded-3xl bg-[#0E1322] border border-[#F5B942]/30 space-y-1">
                  <span className="text-[11px] font-bold text-[#F5B942] uppercase tracking-wider">
                    AI Top Network & eCPM
                  </span>
                  <p className="text-xl font-black text-white truncate">
                    {winningNetwork.shortName} (${winningNetwork.eCpmUsd.toFixed(2)} eCPM)
                  </p>
                  <p className="text-[10px] text-[#A3AEC2]">100% No-KYC verified ad settlement</p>
                </div>
              </div>

              {/* Wallet Configuration Form */}
              <div className="p-6 rounded-3xl bg-[#090D18] border border-white/10 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-[#F5B942]" />
                      <span>Owner Crypto Payout Addresses</span>
                    </h2>
                    <p className="text-xs text-[#A3AEC2]">
                      Set your wallet addresses here. Ad revenue generated by viewers will be routed directly to these accounts.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveWallets}
                    className="min-h-[40px] px-5 rounded-2xl bg-[#F5B942] hover:bg-[#E5A832] text-[#060810] font-black text-xs flex items-center gap-2 shadow-lg shadow-[#F5B942]/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Wallets</span>
                  </button>
                </div>

                {walletSaved && (
                  <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Wallets successfully saved! AI Ad Agent is routing all earnings to your updated addresses.</span>
                  </div>
                )}

                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>USDT (TRON TRC-20) — Primary Settlement</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Zero Fee Fast Rail</span>
                    </label>
                    <input
                      type="text"
                      value={wallets.usdt}
                      onChange={(e) => setWallets({ ...wallets, usdt: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] font-mono text-xs text-[#00F0FF]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Bitcoin (BTC SegWit / Taproot)</label>
                    <input
                      type="text"
                      value={wallets.btc}
                      onChange={(e) => setWallets({ ...wallets, btc: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#F5B942] font-mono text-xs text-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">TON (The Open Network)</label>
                    <input
                      type="text"
                      value={wallets.ton}
                      onChange={(e) => setWallets({ ...wallets, ton: e.target.value })}
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

          {/* TAB 2: FILM & SERIES STREAM ARCHIVE MANAGEMENT */}
          {activeTab === 'archive' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Add New Stream Form */}
              <div className="p-6 rounded-3xl bg-[#090D18] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Plus className="w-5 h-5 text-[#00F0FF]" />
                      <span>Add Movie / Series / Anime Stream URL</span>
                    </h2>
                    <p className="text-xs text-[#A3AEC2]">
                      Paste any HLS (.m3u8), MP4, or cloud video URL to immediately publish it to your platform.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="min-h-[38px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export streams.json</span>
                  </button>
                </div>

                {streamSavedMessage && (
                  <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{streamSavedMessage}</span>
                  </div>
                )}

                <form onSubmit={handleAddStream} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">English Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Dune: Part Two"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Persian Title (عنوان فارسی)</label>
                    <input
                      type="text"
                      placeholder="مثلاً: تل‌ماسه بخش ۲"
                      value={newTitleFa}
                      onChange={(e) => setNewTitleFa(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-[#00F0FF]">
                      Video Stream Direct URL (.m3u8 / .mp4 / CDN)
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/stream/master.m3u8"
                      value={newStreamUrl}
                      onChange={(e) => setNewStreamUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-[#00F0FF]/40 font-mono text-xs text-[#00F0FF]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Poster Image URL</label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={newPosterUrl}
                      onChange={(e) => setNewPosterUrl(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/80 border border-white/15 text-xs text-white"
                      >
                        <option value="movie">Movie</option>
                        <option value="series">TV Series</option>
                        <option value="anime">Anime</option>
                        <option value="cyber-noir">Cyber Noir</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Quality</label>
                      <select
                        value={newQuality}
                        onChange={(e) => setNewQuality(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl bg-black/80 border border-white/15 text-xs text-white"
                      >
                        <option value="4K">4K Ultra HD</option>
                        <option value="1080p">1080p Full HD</option>
                      </select>
                    </div>
                  </div>

                  <div className="sm:col-span-2 pt-2">
                    <button
                      type="submit"
                      className="w-full min-h-[42px] rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0284C7] text-[#060810] font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00F0FF]/20 cursor-pointer active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Publish Video Stream to Platform</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Stream List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Active Archive Streams ({streams.length})</span>
                </h3>

                <div className="grid grid-cols-1 gap-2.5">
                  {streams.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img
                          src={s.posterUrl}
                          alt={s.title}
                          className="w-10 h-14 object-cover rounded-lg shrink-0 bg-black"
                        />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">{s.title}</p>
                          <p className="text-[11px] text-[#A3AEC2] truncate">{s.titleFa}</p>
                          <p className="font-mono text-[10px] text-[#00F0FF] truncate mt-0.5" dir="ltr">
                            {s.defaultStreamUrl}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F5B942]/20 text-[#F5B942]">
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
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
