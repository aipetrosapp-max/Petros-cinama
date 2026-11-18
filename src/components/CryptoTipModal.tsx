import React, { useEffect, useState } from 'react';
import { Check, Copy, Heart, Shield, X, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OFFICIAL_CRYPTO_WALLETS, type CryptoTipWallet } from '../services/cryptoAdNetwork';
import { platformConfigSync } from '../services/platformConfigSync';

/**
 * Live wallets pushed by the Master Admin Panel (Zero-Client-Update). When no
 * panel config has loaded yet, the built-in defaults are used.
 */
function effectiveWallets(): CryptoTipWallet[] {
  const live = platformConfigSync.getWallets();
  if (!live || live.length === 0) return OFFICIAL_CRYPTO_WALLETS;
  return live.map((w) => ({
    symbol: w.network,
    name: w.label || w.network,
    address: w.address,
    networkName: w.network
  }));
}

interface CryptoTipModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'fa' | 'en';
}

export const CryptoTipModal: React.FC<CryptoTipModalProps> = ({
  isOpen,
  onClose,
  lang = 'fa'
}) => {
  const [wallets, setWallets] = useState<CryptoTipWallet[]>(() => effectiveWallets());
  const [selectedWallet, setSelectedWallet] = useState<CryptoTipWallet>(wallets[0]);
  const [copied, setCopied] = useState(false);

  useEffect(
    () =>
      platformConfigSync.subscribe(() => {
        const next = effectiveWallets();
        setWallets(next);
        setSelectedWallet((prev) => next.find((w) => w.symbol === prev.symbol) || next[0]);
      }),
    []
  );

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  const isFa = lang === 'fa';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-label="Crypto Support Vault"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#F5B942]/30 bg-[#0A0D18] p-6 shadow-2xl shadow-black/80"
          dir={isFa ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center text-[#F5B942]">
                <Heart className="w-4 h-4 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isFa ? 'صندوق حمایت کریپتویی پتروس سینما' : 'Petros Cinema Crypto Vault'}
                </h3>
                <p className="text-[11px] text-[#A3AEC2]">
                  {isFa ? 'حمایت مستقیم بدون واسطه، بدون احراز هویت (Zero KYC)' : 'Direct peer-to-peer donation with no KYC'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[#A3AEC2] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Wallet Selector Tabs */}
          <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {wallets.map((w) => {
              const active = selectedWallet.symbol === w.symbol;
              return (
                <button
                  key={w.symbol}
                  type="button"
                  onClick={() => {
                    setSelectedWallet(w);
                    setCopied(false);
                  }}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    active
                      ? 'border-[#F5B942] bg-[#F5B942]/15 text-[#F5B942] font-bold shadow-sm'
                      : 'border-white/10 bg-white/[0.03] text-[#A3AEC2] hover:text-white hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="text-xs font-mono font-bold">{w.symbol}</div>
                  <div className="text-[10px] text-[#A3AEC2] truncate mt-0.5">{w.networkName}</div>
                </button>
              );
            })}
          </div>

          {/* Wallet Address Box */}
          <div className="rounded-xl border border-white/10 bg-black/50 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-[#A3AEC2]">
              <span>{isFa ? `آدرس کیف‌پول ${selectedWallet.name}` : `${selectedWallet.name} Address`}:</span>
              <span className="text-[10px] text-[#F5B942] font-semibold">{selectedWallet.networkName}</span>
            </div>

            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-[#060810] border border-white/10">
              <span className="font-mono text-xs text-white break-all select-all">
                {selectedWallet.address}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(selectedWallet.address)}
                className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-[#F5B942] text-[#060810] hover:brightness-110 active:scale-95'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isFa ? 'کپی شد' : 'Copied!') : (isFa ? 'کپی' : 'Copy')}</span>
              </button>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-[#A3AEC2]">
            <Shield className="w-4 h-4 text-[#F5B942] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {isFa
                ? 'پلتفرم ai petros کاملاً متن‌باز و غیرمتمرکز است. مبالغ حمایتی صرف زیرساخت‌های سرور استریم، توزیع پهنای باند و بهبود الگوریتم‌های سینمایی می‌شود.'
                : 'ai petros is open-source and decentralized. Donations fund high-bitrate streaming nodes and cinema AI algorithms.'}
            </p>
          </div>

          {/* Close Button */}
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] px-5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
            >
              {isFa ? 'بستن' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
