import React, { useState, useEffect } from 'react';
import { AppData, Theme } from '../types';
import { ExternalLink, Share2, X } from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

interface PreviewProps {
  data: AppData;
  onLinkClick?: (linkId: string) => void;
}

// Global cache for reconstructed video blob URLs across component renders
const videoBlobCache = new Map<string, string>();

const getBackgroundStyle = (theme: Theme): React.CSSProperties => {
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
        backgroundPosition: 'center',
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

export const Preview: React.FC<PreviewProps> = ({ data, onLinkClick }) => {
  const { profile, theme, links } = data;
  const isAnimated = theme.backgroundType === 'animated-gradient';
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);

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
      className={`relative w-full h-full overflow-hidden ${isAnimated ? 'animated-gradient-bg' : ''}`} 
      style={{ ...getBackgroundStyle(theme), fontFamily: theme.fontFamily }}
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
        >
          <source src={resolvedVideoUrl} />
        </video>
      )}

      {/* Top right share button */}
      <button
        onClick={() => setIsShareModalOpen(true)}
        className="absolute top-6 right-6 p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md shadow-sm border border-white/20 transition-all z-40 group"
        style={{ color: theme.buttonTextColor }}
      >
        <Share2 className="w-5 h-5 opacity-80 group-hover:opacity-100" />
      </button>

      {/* Scrollable Content (keeps wallpaper static inside device while links scroll) */}
      <div className="w-full h-full overflow-y-auto no-scrollbar relative z-10">
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
          
          <h1 className="text-2xl font-bold mb-2" style={{ color: theme.buttonTextColor }}>
            {profile.name}
          </h1>
          <p className="text-base opacity-90" style={{ color: theme.buttonTextColor }}>
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
            const layoutClass = format === 'featured' ? 'flex flex-col' : format === 'banner' ? 'flex flex-col overflow-hidden' : format === 'compact' ? 'flex items-center p-2' : format === 'minimal' ? 'flex items-center justify-center p-4' : 'flex items-center p-3';

            return (
              <motion.a 
                onClick={() => onLinkClick?.(link.id)}
                variants={getAnimationVariants(link.animation)}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                key={link.id} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`${getButtonStyle(theme)} ${layoutClass}`}
                style={
                  theme.buttonStyle === 'solid' 
                    ? { backgroundColor: theme.buttonColor, color: theme.buttonTextColor }
                    : theme.buttonStyle === 'outline'
                      ? { borderColor: theme.buttonColor, color: theme.buttonTextColor }
                      : { color: theme.buttonTextColor }
                }
              >
                {format === 'featured' ? (
                  <>
                    {link.thumbnailUrl && (
                      <div className="w-full h-40 bg-black/5 flex-shrink-0">
                        <img src={link.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 w-full text-center">
                      <div className="font-semibold text-lg">{link.title}</div>
                      {link.description && <div className="text-sm opacity-80 mt-1">{link.description}</div>}
                    </div>
                  </>
                ) : format === 'compact' ? (
                  <>
                    {link.thumbnailUrl ? (
                      <img src={link.thumbnailUrl} alt="" className="w-8 h-8 rounded-full object-cover ml-2 mr-3 flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center ml-2 mr-3 flex-shrink-0">
                        <ExternalLink className="w-4 h-4 opacity-70" />
                      </div>
                    )}
                    <div className="flex-1 text-left pr-4">
                      <div className="font-medium text-sm">{link.title}</div>
                      {link.description && <div className="text-xs opacity-80 mt-0.5">{link.description}</div>}
                    </div>
                  </>
                ) : format === 'minimal' ? (
                  <div className="w-full text-center">
                    <div className="font-semibold text-lg">{link.title}</div>
                  </div>
                ) : format === 'banner' ? (
                  <div className="w-full relative h-32 flex flex-col justify-end overflow-hidden group-hover:scale-[1.02] transition-transform">
                    {link.thumbnailUrl ? (
                      <>
                         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-10" />
                         <img src={link.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover z-0" />
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10 z-10" />
                    )}
                    <div className="relative z-20 p-4 w-full text-left text-white">
                      <div className="font-bold text-xl drop-shadow-md">{link.title}</div>
                      {link.description && <div className="text-sm opacity-90 mt-0.5 drop-shadow-md">{link.description}</div>}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-black/5 rounded-full overflow-hidden mr-3">
                      {link.thumbnailUrl ? (
                        <img src={link.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ExternalLink className="w-5 h-5 opacity-70" />
                      )}
                    </div>
                    
                    <div className="flex-1 text-center pr-12">
                      <div className="font-semibold text-lg">{link.title}</div>
                      {link.description && <div className="text-sm opacity-80 mt-0.5">{link.description}</div>}
                    </div>
                  </>
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
    </div>
  );
};
