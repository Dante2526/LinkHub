import React, { useState, useEffect, useRef } from 'react';
import { AppData, Theme, BackgroundPosition } from '../types';
import { Share2, X, ShoppingBag, ExternalLink, Clock, ShieldCheck, Sparkles, Move, Check, RotateCcw, Truck, Flame, Tag } from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

interface PreviewProps {
  data: AppData;
  onLinkClick?: (linkId: string) => void;
  previewMode?: 'mobile' | 'desktop';
  isRepositioning?: boolean;
  onRepositionEnd?: () => void;
  onPositionChange?: (pos: BackgroundPosition) => void;
}

// Global cache for reconstructed video blob URLs across component renders
const videoBlobCache = new Map<string, string>();

const getBackgroundStyle = (theme: Theme, position: BackgroundPosition = { x: 50, y: 50 }): React.CSSProperties => {
  switch (theme.backgroundType) {
    case 'color':
      return { backgroundColor: theme.backgroundColor };
    case 'gradient':
      return { background: theme.backgroundGradient };
    case 'animated-gradient':
      return { 
        background: theme.backgroundGradient,
        backgroundSize: '300% 300%'
      };
    case 'image':
      return { 
        backgroundImage: `url(${theme.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: `${position.x}% ${position.y}%`,
        backgroundColor: theme.backgroundColor || '#111827'
      };
    case 'video':
      return { 
        backgroundColor: theme.backgroundColor || '#0f172a',
        background: theme.backgroundGradient || theme.backgroundColor || '#0f172a'
      };
    default:
      return { backgroundColor: theme.backgroundColor || '#f2f2f2' };
  }
};

const getAnimationVariants = (animation?: string) => {
  const baseVisible = { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } };
  
  if (!animation || animation === 'none') {
    return {
      hidden: { opacity: 0, y: 20 },
      visible: baseVisible
    };
  }

  const loopTransition = { 
    repeat: Infinity, 
    repeatType: 'reverse' as const, 
    duration: 1.5 
  };

  switch (animation) {
    case 'pulse':
      return {
        hidden: { opacity: 0, y: 20 },
        visible: {
          ...baseVisible,
          scale: [1, 1.05, 1],
          transition: {
            ...baseVisible.transition,
            scale: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
          }
        }
      };
    case 'bounce':
      return {
        hidden: { opacity: 0, y: 20 },
        visible: {
          ...baseVisible,
          y: [0, -8, 0],
          transition: {
            ...baseVisible.transition,
            y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
          }
        }
      };
    case 'shake':
      return {
        hidden: { opacity: 0, y: 20 },
        visible: {
          ...baseVisible,
          x: [0, -5, 5, -5, 5, 0],
          transition: {
            ...baseVisible.transition,
            x: { repeat: Infinity, duration: 2, ease: "easeInOut" }
          }
        }
      };
    case 'glow':
      return {
        hidden: { opacity: 0, y: 20 },
        visible: {
          ...baseVisible,
          boxShadow: ['0px 0px 0px rgba(255,255,255,0)', '0px 0px 20px rgba(255,255,255,0.6)', '0px 0px 0px rgba(255,255,255,0)'],
          transition: {
            ...baseVisible.transition,
            boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" }
          }
        }
      };
    default:
      return {
        hidden: { opacity: 0, y: 20 },
        visible: baseVisible
      };
  }
};

const getButtonStyle = (theme: Theme): string => {
  const base = "relative w-full transition-colors duration-300 overflow-hidden block";
  
  let radiusClass = "";
  switch (theme.buttonRadius) {
    case 'none': radiusClass = "rounded-none"; break;
    case 'sm': radiusClass = "rounded-md"; break;
    case 'md': radiusClass = "rounded-xl"; break;
    case 'lg': radiusClass = "rounded-2xl"; break;
    case 'xl': radiusClass = "rounded-[2rem]"; break;
    case 'full': radiusClass = "rounded-full"; break;
    case 'leaf': radiusClass = "rounded-tl-3xl rounded-br-3xl rounded-tr-md rounded-bl-md"; break;
  }

  let styleClass = "";
  switch (theme.buttonStyle) {
    case 'solid':
      styleClass = "";
      break;
    case 'outline':
      styleClass = "border-2 bg-transparent";
      break;
    case 'glass':
      styleClass = "bg-white/20 backdrop-blur-md border border-white/30";
      break;
  }

  const shadowClass = theme.buttonShadow ? "shadow-lg" : "";

  return `${base} ${radiusClass} ${styleClass} ${shadowClass}`;
};

export const Preview: React.FC<PreviewProps> = ({ 
  data, 
  onLinkClick,
  previewMode,
  isRepositioning = false,
  onRepositionEnd,
  onPositionChange,
}) => {
  const { profile, theme, links, ad } = data;
  const isAnimated = theme.backgroundType === 'animated-gradient';
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);

  // Responsive device mode detection for PublicView or dynamic window sizes
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveMode: 'mobile' | 'desktop' = previewMode || (windowWidth < 768 ? 'mobile' : 'desktop');

  const activePosition: BackgroundPosition = (effectiveMode === 'mobile'
    ? (theme.backgroundPositionMobile || theme.backgroundPositionDesktop)
    : (theme.backgroundPositionDesktop || theme.backgroundPositionMobile)) || { x: 50, y: 50 };

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startPointerRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef<BackgroundPosition>({ x: 50, y: 50 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...activePosition };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const deltaX = e.clientX - startPointerRef.current.x;
    const deltaY = e.clientY - startPointerRef.current.y;

    const newX = startPosRef.current.x - (deltaX / rect.width) * 100;
    const newY = startPosRef.current.y - (deltaY / rect.height) * 100;

    const clampedX = Math.min(100, Math.max(0, Math.round(newX)));
    const clampedY = Math.min(100, Math.max(0, Math.round(newY)));

    onPositionChange?.({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Advertisement / Shopee Promo Modal State
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [adCountdown, setAdCountdown] = useState<number>(ad?.timerSeconds || 5);

  // Check frequency (3 hours by default) and display ad if appropriate
  useEffect(() => {
    const checkAndShowAd = () => {
      if (!ad || !ad.enabled || !ad.buttonUrl) {
        setIsAdOpen(false);
        return;
      }

      const freqHours = ad.frequencyHours ?? 3;
      const freqMs = freqHours * 60 * 60 * 1000;
      const lastSeenStr = localStorage.getItem('linkhub_last_ad_seen');
      const lastUpdatedStr = localStorage.getItem('linkhub_last_ad_updated_at');

      const now = Date.now();
      const hasExpired = !lastSeenStr || (now - Number(lastSeenStr) >= freqMs);
      const isNewAdVersion = Boolean(ad.updatedAt && (!lastUpdatedStr || Number(lastUpdatedStr) < ad.updatedAt));

      if (hasExpired || isNewAdVersion) {
        setIsAdOpen(true);
        setAdCountdown(ad.timerSeconds || 5);
        if (ad.updatedAt) {
          localStorage.setItem('linkhub_last_ad_updated_at', ad.updatedAt.toString());
        }
      }
    };

    checkAndShowAd();

    // Listen for manual preview test triggers from Admin Editor
    const handleTriggerPreview = () => {
      setIsAdOpen(true);
      setAdCountdown(ad?.timerSeconds || 5);
    };

    window.addEventListener('linkhub_trigger_ad_preview', handleTriggerPreview);
    return () => {
      window.removeEventListener('linkhub_trigger_ad_preview', handleTriggerPreview);
    };
  }, [ad]);

  // 5-second countdown timer
  useEffect(() => {
    if (!isAdOpen || adCountdown <= 0) return;
    const timer = setTimeout(() => {
      setAdCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [isAdOpen, adCountdown]);

  const handleCloseAd = () => {
    if (adCountdown > 0) return;
    localStorage.setItem('linkhub_last_ad_seen', Date.now().toString());
    setIsAdOpen(false);
  };

  const handleAdCtaClick = () => {
    localStorage.setItem('linkhub_last_ad_seen', Date.now().toString());
    setIsAdOpen(false);
  };

  useEffect(() => {
    const url = theme.backgroundVideoUrl;
    let objectUrl: string | null = null;
    let isMounted = true;
    
    if (url && url.startsWith('firestore_chunked|')) {
      if (!isFirebaseConfigured) {
        setResolvedVideoUrl(null);
        return;
      }

      // Check cache first for instant 0ms playback
      if (videoBlobCache.has(url)) {
        setResolvedVideoUrl(videoBlobCache.get(url)!);
        return;
      }

      const [, fileId, chunksStr] = url.split('|');
      const totalChunks = parseInt(chunksStr, 10);
      
      const loadVideo = async () => {
        try {
          // Download ALL chunks in parallel with Promise.all (cuts time by 80-90%)
          const chunkPromises = Array.from({ length: totalChunks }, (_, i) => 
            getDoc(doc(db, 'media_chunks', `${fileId}_chunk_${i}`))
          );
          const snaps = await Promise.all(chunkPromises);

          let base64String = '';
          for (const snap of snaps) {
            if (snap.exists()) {
              base64String += snap.data().data;
            }
          }

          if (isMounted && base64String) {
             const res = await fetch(base64String);
             const blob = await res.blob();
             objectUrl = URL.createObjectURL(blob);
             videoBlobCache.set(url, objectUrl);
             setResolvedVideoUrl(objectUrl);
          }
        } catch (err) {
          console.error("Erro ao remontar video", err);
        }
      };
      loadVideo();
      
      return () => {
        isMounted = false;
      };
    } else {
      setResolvedVideoUrl(url || null);
    }
  }, [theme.backgroundVideoUrl]);

  const publicUrl = typeof window !== 'undefined' ? window.location.origin : 'https://linkhub.com';

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${isAnimated ? 'animated-gradient-bg' : ''}`} 
      style={{ ...getBackgroundStyle(theme, activePosition), fontFamily: theme.fontFamily }}
    >
      {/* Video Background Layer (strictly contained within the preview frame) */}
      {theme.backgroundType === 'video' && resolvedVideoUrl && (
        <video 
          key={resolvedVideoUrl}
          autoPlay 
          loop 
          muted 
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
          style={{ objectPosition: `${activePosition.x}% ${activePosition.y}%` }}
        >
          <source src={resolvedVideoUrl} />
        </video>
      )}

      {/* Repositioning Overlay and Control Bar */}
      {isRepositioning && (
        <>
          {/* Top floating control bar */}
          <div className="absolute top-4 inset-x-3 sm:inset-x-4 z-50 flex items-center justify-between gap-2 p-2 px-3 sm:px-4 rounded-2xl bg-gray-900/90 backdrop-blur-md border border-white/20 text-white shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg">
                <Move className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-tight">
                  Enquadramento {effectiveMode === 'mobile' ? 'Mobile' : 'Desktop'}
                </span>
                <span className="text-[10px] text-gray-300 font-mono">
                  X: {activePosition.x}% • Y: {activePosition.y}%
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPositionChange?.({ x: 50, y: 50 });
                }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                title="Restaurar ao centro (50% 50%)"
              >
                <RotateCcw className="w-3 h-3" />
                Centro
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRepositionEnd?.();
                }}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Concluir
              </button>
            </div>
          </div>

          {/* Interactive Drag Overlay */}
          <div
            className="absolute inset-0 z-40 cursor-grab active:cursor-grabbing touch-none select-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div className="w-full h-full flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full border-2 border-white/70 flex items-center justify-center bg-black/35 backdrop-blur-xs shadow-xl">
                <Move className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Top right share button */}
      {!isRepositioning && (
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="absolute top-6 right-6 p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md shadow-sm border border-white/20 transition-all z-40 group"
          style={{ color: theme.profileTextColor || '#ffffff' }}
        >
          <Share2 className="w-5 h-5 opacity-80 group-hover:opacity-100" />
        </button>
      )}

      {/* Scrollable Content (keeps wallpaper static inside device while links scroll) */}
      <div className={`w-full h-full overflow-y-auto no-scrollbar relative z-10 transition-opacity duration-300 ${isRepositioning ? 'opacity-25 pointer-events-none select-none' : 'opacity-100'}`}>
        <div className="max-w-xl mx-auto px-6 py-12 flex flex-col items-center min-h-full">
          {/* Profile */}
          <motion.div 
            className="flex flex-col items-center text-center mb-10 w-full"
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
          {profile.avatarUrl ? (
            <img 
              src={profile.avatarUrl} 
              alt={profile.name}
              decoding="async"
              loading="eager"
              className={`w-24 h-24 object-cover shadow-lg border-2 border-white/50 mb-4 ${
                theme.avatarShape === 'round' ? 'rounded-full' : 
                theme.avatarShape === 'rounded' ? 'rounded-3xl' : 'rounded-none'
              }`}
            />
          ) : (
            <div className={`w-24 h-24 bg-gray-200 shadow-lg mb-4 flex items-center justify-center ${
                theme.avatarShape === 'round' ? 'rounded-full' : 
                theme.avatarShape === 'rounded' ? 'rounded-3xl' : 'rounded-none'
              }`}>
              <span className="text-gray-400 text-sm">No Image</span>
            </div>
          )}
          
          <h1 
            className="text-2xl font-bold mb-2 tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" 
            style={{ color: theme.profileTextColor || '#ffffff' }}
          >
            {profile.name}
          </h1>
          <p 
            className="text-base opacity-95 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" 
            style={{ color: theme.profileTextColor || '#ffffff' }}
          >
            {profile.bio}
          </p>
        </motion.div>

        {/* Links */}
        <motion.div 
          className="w-full flex flex-col gap-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
        >
          {links.filter(l => l.isVisible).map(link => {
            const format = theme.linkFormat || 'classic';
            const linkTextColor = link.textColor || theme.buttonTextColor || '#000000';
            const linkBgColor = link.buttonColor || theme.buttonColor || '#ffffff';

            return (
              <motion.a 
                onClick={() => onLinkClick?.(link.id)}
                variants={getAnimationVariants(link.animation)}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                key={link.id} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`${getButtonStyle(theme)} overflow-hidden transition-all`}
                style={
                  theme.buttonStyle === 'solid' 
                    ? { backgroundColor: linkBgColor, color: linkTextColor }
                    : theme.buttonStyle === 'outline'
                      ? { borderColor: linkBgColor, color: linkTextColor }
                      : { color: linkTextColor }
                }
              >
                {format === 'featured' ? (
                  <div className="flex flex-col w-full">
                    {link.thumbnailUrl && (
                      <div className="w-full h-40 bg-black/5 flex-shrink-0">
                        <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 w-full text-center">
                      <div className="font-semibold text-lg leading-snug">{link.title}</div>
                      {link.description && <div className="text-sm opacity-80 mt-1 leading-snug">{link.description}</div>}
                    </div>
                  </div>
                ) : format === 'compact' ? (
                  <div className="relative w-full flex items-center justify-center min-h-[46px] py-2 px-3 text-center">
                    {link.thumbnailUrl && (
                      <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    )}
                    <div className={`w-full ${link.thumbnailUrl ? 'px-9' : 'px-2'} flex flex-col items-center justify-center text-center`}>
                      <div className="font-medium text-sm leading-snug break-words">{link.title}</div>
                      {link.description && <div className="text-xs opacity-80 mt-0.5 leading-snug break-words">{link.description}</div>}
                    </div>
                  </div>
                ) : format === 'minimal' ? (
                  <div className="w-full p-4 text-center">
                    <div className="font-semibold text-lg leading-snug">{link.title}</div>
                    {link.description && <div className="text-xs opacity-80 mt-1 leading-snug">{link.description}</div>}
                  </div>
                ) : format === 'banner' ? (
                  <div className="w-full relative h-32 flex flex-col justify-end overflow-hidden group-hover:scale-[1.01] transition-transform">
                    {link.thumbnailUrl ? (
                      <>
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
                         <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover z-0" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10 z-10" />
                    )}
                    <div className="relative z-20 p-4 w-full text-center text-white">
                      <div className="font-bold text-xl drop-shadow-md">{link.title}</div>
                      {link.description && <div className="text-sm opacity-90 mt-0.5 drop-shadow-md">{link.description}</div>}
                    </div>
                  </div>
                ) : (
                  // Formato Classic (Padrão) - Centralizado
                  <div className="relative w-full flex items-center justify-center min-h-[58px] py-3.5 px-4 text-center">
                    {link.thumbnailUrl && (
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full overflow-hidden flex-shrink-0">
                        <img src={link.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    
                    <div className={`w-full ${link.thumbnailUrl ? 'px-12' : 'px-2'} flex flex-col items-center justify-center text-center`}>
                      <div className="font-semibold text-base sm:text-lg leading-snug break-words">{link.title}</div>
                      {link.description && <div className="text-xs sm:text-sm opacity-80 mt-0.5 leading-snug break-words">{link.description}</div>}
                    </div>
                  </div>
                )}
              </motion.a>
            );
          })}
        </motion.div>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative"
              style={{ color: '#000', fontFamily: 'system-ui, sans-serif' }}
            >
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex flex-col items-center pt-2">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                  <Share2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">Compartilhar</h3>
                <p className="text-sm text-gray-500 text-center mb-6">Escaneie o QR Code abaixo para acessar o perfil facilmente.</p>
                
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-center w-full">
                  <QRCodeSVG 
                    value={publicUrl} 
                    size={200}
                    level="Q"
                    includeMargin={false}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centralized Advertisement / Shopee Promo Modal */}
      <AnimatePresence>
        {isAdOpen && ad && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="bg-white rounded-[28px] overflow-hidden w-full max-w-[340px] sm:max-w-sm shadow-2xl relative border border-gray-100 flex flex-col my-auto max-h-[92vh] overflow-y-auto"
              style={{ color: '#000', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            >
              {/* Top Bar with Badge and Countdown / Close Button */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-orange-50/80 via-white to-orange-50/80 border-b border-orange-100/80 flex-shrink-0">
                {/* Badge à esquerda com respiro */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ee4d2d] text-white text-[10px] sm:text-[11px] font-black rounded-full shadow-xs uppercase tracking-wider whitespace-nowrap flex-shrink-0">
                  <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse flex-shrink-0" />
                  <span className="whitespace-nowrap">{ad.badgeText || 'Oferta Relâmpago'}</span>
                </div>

                {/* Contador circular compacto (não quebra nem corta na tela) */}
                <div className="flex items-center flex-shrink-0">
                  {adCountdown > 0 ? (
                    <div 
                      className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-black shadow-xs select-none border border-gray-700 flex-shrink-0"
                      title={`Aguarde ${adCountdown}s para poder fechar`}
                    >
                      {adCountdown}s
                    </div>
                  ) : (
                    <button
                      onClick={handleCloseAd}
                      title="Fechar anúncio"
                      className="flex items-center justify-center w-7 h-7 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-full transition-all cursor-pointer shadow-xs active:scale-95 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Product Image / Banner - Adaptável 100% sem cortes e sem sobreposição */}
              {ad.imageUrl && (
                <div className="relative w-full bg-gradient-to-b from-orange-50/20 via-white to-gray-50/40 flex items-center justify-center p-3 sm:p-4 border-b border-gray-100 overflow-hidden flex-shrink-0">
                  <img 
                    src={ad.imageUrl} 
                    alt={ad.title} 
                    loading="eager"
                    decoding="async"
                    className="w-full max-h-[250px] sm:max-h-[280px] object-contain rounded-2xl drop-shadow-sm transition-transform duration-300 hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Body Content */}
              <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
                {/* Bloco de Preço & Economia (Layout à prova de overflow em qualquer tela) */}
                {(ad.price || ad.originalPrice) && (
                  <div className="bg-gradient-to-r from-orange-50 via-amber-50/50 to-orange-50 p-3 rounded-2xl border border-orange-200/80 shadow-xs flex flex-col gap-2">
                    {/* Linha 1: Tag de Oferta e Selo Frete Grátis com espaço de sobra */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-[#ee4d2d] uppercase tracking-wider whitespace-nowrap">
                        <Tag className="w-3 h-3 text-[#ee4d2d] flex-shrink-0" />
                        <span>Preço Especial</span>
                      </span>

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] sm:text-[11px] font-black rounded-lg whitespace-nowrap shadow-2xs">
                        <Truck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                        <span>Frete Grátis</span>
                      </span>
                    </div>

                    {/* Linha 2: Valores do Preço com largura total e destaque */}
                    <div className="flex items-baseline gap-2">
                      {ad.price && (
                        <span className="text-2xl sm:text-3xl font-black text-[#ee4d2d] tracking-tight whitespace-nowrap">
                          {ad.price}
                        </span>
                      )}
                      {ad.originalPrice && (
                        <span className="text-xs sm:text-sm text-gray-400 font-semibold line-through whitespace-nowrap">
                          {ad.originalPrice}
                        </span>
                      )}
                    </div>

                    {/* Linha 3: Prova social e volume de vendas */}
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 pt-1 border-t border-orange-200/50 font-medium">
                      <span className="text-amber-500 font-bold">★ 4.9</span>
                      <span className="text-gray-500 whitespace-nowrap">• Mais de 1.000 vendidos</span>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                    {ad.title}
                  </h3>
                  {ad.description && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                      {ad.description}
                    </p>
                  )}
                </div>

                {/* Selos de Confiança (Sem quebra de linha) */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                    <span className="text-emerald-500 font-bold text-xs flex-shrink-0">✓</span>
                    <span className="whitespace-nowrap">Em Estoque</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-semibold text-gray-700 whitespace-nowrap">
                    <span className="text-orange-500 font-bold text-xs flex-shrink-0">⚡</span>
                    <span className="whitespace-nowrap">Envio Imediato</span>
                  </div>
                </div>

                {/* CTA Affiliate Link Button */}
                <a
                  href={ad.buttonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleAdCtaClick}
                  className="w-full mt-1 py-3.5 px-4 bg-gradient-to-r from-[#ee4d2d] via-[#ff5722] to-[#ee4d2d] hover:brightness-105 text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all transform active:scale-[0.98] text-center cursor-pointer whitespace-nowrap"
                >
                  <ShoppingBag className="w-5 h-5 flex-shrink-0" />
                  <span className="whitespace-nowrap truncate">{ad.buttonText || 'Aproveitar Oferta na Shopee'}</span>
                  <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-85" />
                </a>

                {/* Safe Link Disclaimer */}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 pt-0.5 whitespace-nowrap">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="whitespace-nowrap">Link Oficial • Compra 100% Protegida</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
