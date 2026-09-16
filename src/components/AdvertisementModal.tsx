import React, { useState, useEffect, useRef } from 'react';
import { Advertisement } from '../types';
import { Sparkles, X, Tag, Truck, ShoppingBag, ExternalLink, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sanitizeUrl } from '../lib/sanitize';

interface EllipseRipple {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  border: string;
}

interface AdvertisementModalProps {
  ad: Advertisement;
  isOpen: boolean;
  onClose: () => void;
  onAdClick?: (linkId: string) => void;
  onTriggerCircleTransition?: (params: {
    clientX: number;
    clientY: number;
    color: string;
    background?: string;
    borderColor?: string;
    textColor?: string;
    url?: string;
  }) => void;
}

export const AdvertisementModal: React.FC<AdvertisementModalProps> = React.memo(({
  ad,
  isOpen,
  onClose,
  onAdClick,
  onTriggerCircleTransition,
}) => {
  const [countdown, setCountdown] = useState<number>(ad.timerSeconds || 5);
  const [adRipples, setAdRipples] = useState<EllipseRipple[]>([]);
  const isAdOpeningRef = useRef(false);

  // Reset countdown whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setCountdown(ad.timerSeconds || 5);
    }
  }, [isOpen, ad.timerSeconds]);

  // Internal 1-second countdown timer isolated to this modal
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;
    const timer = setTimeout(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [isOpen, countdown]);

  const triggerAdRipple = (clientX: number, clientY: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const x = clientX ? clientX - rect.left : rect.width / 2;
    const y = clientY ? clientY - rect.top : rect.height / 2;

    const distX = Math.max(x, rect.width - x);
    const distY = Math.max(y, rect.height - y);
    const maxRadius = Math.hypot(distX, distY);

    const width = Math.max(maxRadius * 2.4, rect.width * 1.3);
    const height = Math.max(maxRadius * 1.6, rect.height * 2.2);

    const id = Date.now() + Math.random();
    setAdRipples(prev => [
      ...prev,
      {
        id,
        x,
        y,
        width,
        height,
        fill: 'rgba(255, 255, 255, 0.45)',
        border: 'rgba(255, 255, 255, 0.85)',
      }
    ]);
  };

  const handleAdPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    triggerAdRipple(e.clientX, e.clientY, e.currentTarget);
  };

  const handleAdCtaClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX || (rect.left + rect.width / 2);
    const clientY = e.clientY || (rect.top + rect.height / 2);
    triggerAdRipple(clientX, clientY, e.currentTarget);

    if (isAdOpeningRef.current) return;
    isAdOpeningRef.current = true;

    // Track intent
    if (onAdClick) {
      onAdClick('__advertisement__');
    }

    try {
      localStorage.setItem('linkhub_last_ad_seen', Date.now().toString());
    } catch {}

    const targetUrl = sanitizeUrl(ad.buttonUrl || '');
    let popup: Window | null = null;
    if (targetUrl && targetUrl !== '#') {
      popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }

    onClose();

    if (onTriggerCircleTransition) {
      onTriggerCircleTransition({
        clientX,
        clientY,
        color: '#ee4d2d',
        background: 'linear-gradient(135deg, #ee4d2d 0%, #ff6433 100%)',
        borderColor: '#ff7a45',
        textColor: '#ffffff',
        url: targetUrl,
      });
    }

    setTimeout(() => {
      isAdOpeningRef.current = false;
      if (!popup && targetUrl && targetUrl !== '#') {
        window.location.href = targetUrl;
      }
    }, 450);
  };

  const handleClose = () => {
    if (countdown > 0) return;
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-hidden"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[24px] sm:rounded-[28px] overflow-hidden w-full max-w-[340px] sm:max-w-[360px] shadow-2xl relative border border-gray-100 flex flex-col my-auto max-h-[94%]"
            style={{ color: '#000', fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Top Bar with Badge and Countdown / Close Button */}
            <div className="flex items-center justify-between px-3.5 py-2.5 bg-linear-to-r from-orange-50/80 via-white to-orange-50/80 border-b border-orange-100/80 flex-shrink-0 gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ee4d2d] text-white text-[10px] sm:text-[11px] font-black rounded-full shadow-xs uppercase tracking-wider min-w-0 max-w-[calc(100%-38px)]">
                <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse flex-shrink-0" />
                <span className="truncate">{ad.badgeText || 'Oferta Relâmpago'}</span>
              </div>

              <div className="flex items-center flex-shrink-0">
                {countdown > 0 ? (
                  <div 
                    className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-black shadow-xs select-none border border-gray-700 flex-shrink-0"
                    title={`Aguarde ${countdown}s para poder fechar`}
                  >
                    {countdown}s
                  </div>
                ) : (
                  <button
                    onClick={handleClose}
                    title="Fechar anúncio"
                    className="flex items-center justify-center w-7 h-7 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-full transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Product Image / Banner */}
            {ad.imageUrl && (
              <div className="relative w-full bg-linear-to-b from-orange-50/20 via-white to-gray-50/40 flex items-center justify-center p-2.5 sm:p-3 border-b border-gray-100 overflow-hidden flex-shrink-0">
                <img 
                  src={ad.imageUrl} 
                  alt={ad.title} 
                  loading="eager"
                  decoding="async"
                  className="w-full max-h-[140px] sm:max-h-[175px] object-contain rounded-xl drop-shadow-sm transition-transform duration-300 hover:scale-[1.02]"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {/* Body Content */}
            <div className="p-3 sm:p-3.5 flex flex-col gap-2.5 flex-1 overflow-y-auto min-h-0">
              {/* Bloco de Preço & Economia */}
              {(ad.price || ad.originalPrice) && (
                <div className="bg-linear-to-r from-orange-50 via-amber-50/50 to-orange-50 px-3 py-2 rounded-xl border border-orange-200/80 shadow-xs flex flex-col gap-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#ee4d2d] uppercase tracking-wider">
                      <Tag className="w-3 h-3 text-[#ee4d2d] flex-shrink-0" />
                      <span>Preço Especial</span>
                    </span>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-bold rounded-md shadow-2xs">
                      <Truck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <span>Frete Grátis</span>
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 flex-wrap">
                    {ad.price && (
                      <span className="text-xl sm:text-2xl font-black text-[#ee4d2d] tracking-tight">
                        {ad.price}
                      </span>
                    )}
                    {ad.originalPrice && (
                      <span className="text-xs text-gray-400 font-semibold line-through">
                        {ad.originalPrice}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-gray-500 pt-1 border-t border-orange-200/50 font-medium flex-wrap">
                    <span className="text-amber-500 font-bold">★ 4.9</span>
                    <span className="text-gray-500">• Mais de 1.000 vendidos</span>
                  </div>
                </div>
              )}

              <div className="space-y-0.5">
                <h3 className="text-sm sm:text-base font-bold text-gray-900 leading-snug break-words">
                  {ad.title}
                </h3>
                {ad.description && (
                  <p className="text-[11px] sm:text-xs text-gray-600 leading-snug break-words">
                    {ad.description}
                  </p>
                )}
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-gray-50 border border-gray-100 text-[10px] sm:text-[11px] font-semibold text-gray-700 min-w-0">
                  <span className="text-emerald-500 font-bold text-xs flex-shrink-0">✓</span>
                  <span className="truncate">Em Estoque</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-gray-50 border border-gray-100 text-[10px] sm:text-[11px] font-semibold text-gray-700 min-w-0">
                  <span className="text-orange-500 font-bold text-xs flex-shrink-0">⚡</span>
                  <span className="truncate">Envio Imediato</span>
                </div>
              </div>

              {/* CTA Affiliate Link Button */}
              <a
                href={sanitizeUrl(ad.buttonUrl || '') || '#'}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={handleAdPointerDown}
                onClick={handleAdCtaClick}
                className="w-full relative overflow-hidden py-2.5 sm:py-3 px-3 bg-linear-to-r from-[#ee4d2d] via-[#ff5722] to-[#ee4d2d] hover:brightness-105 text-white font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-500/25 transition-all select-none cursor-pointer"
              >
                <AnimatePresence>
                  {adRipples.map(ripple => (
                    <motion.span
                      key={ripple.id}
                      initial={{
                        scaleX: 0,
                        scaleY: 0,
                        opacity: 0.9,
                      }}
                      animate={{
                        scaleX: [0, 0.45, 1],
                        scaleY: [0, 0.65, 1],
                        opacity: [0.9, 0.75, 0],
                      }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.55,
                        times: [0, 0.35, 1],
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      onAnimationComplete={() => {
                        setAdRipples(prev => prev.filter(r => r.id !== ripple.id));
                      }}
                      className="absolute pointer-events-none z-30"
                      style={{
                        left: ripple.x - ripple.width / 2,
                        top: ripple.y - ripple.height / 2,
                        width: ripple.width,
                        height: ripple.height,
                        borderRadius: '50%',
                        backgroundColor: ripple.fill,
                        border: `2px solid ${ripple.border}`,
                        transformOrigin: 'center center',
                      }}
                    />
                  ))}
                </AnimatePresence>
                <ShoppingBag className="w-4 h-4 flex-shrink-0" />
                <span className="leading-tight text-center truncate">{ad.buttonText || 'Aproveitar Oferta na Shopee'}</span>
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-85" />
              </a>

              {/* Safe Link Disclaimer */}
              <div className="flex items-center justify-center gap-1 text-[10px] text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span>Link Oficial • Compra 100% Protegida</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
