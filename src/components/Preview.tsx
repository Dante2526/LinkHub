import React, { useState, useEffect, useRef, useCallback } from 'react';
import FullscreenCircleTransition, { CircleTransitionData } from './FullscreenCircleTransition';
import { AppData, Theme, BackgroundPosition, ThumbnailShape, ButtonRadius, LinkItem } from '../types';
import { Share2, Move, Check, RotateCcw, X } from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { getCachedVideoBlob, setCachedVideoBlob } from '../lib/videoCache';
import { sanitizeCssUrl, sanitizeUrl, isPrivateUrl } from '../lib/sanitize';
import { AdvertisementModal } from './AdvertisementModal';

interface PreviewProps {
  data: AppData;
  onLinkClick?: (linkId: string) => void;
  previewMode?: 'mobile' | 'desktop';
  isRepositioning?: boolean;
  onRepositionEnd?: () => void;
  onPositionChange?: (pos: BackgroundPosition) => void;
  publicProfileUrl?: string;
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
      if (isPrivateUrl(theme.backgroundImageUrl || '')) {
        return { backgroundColor: theme.backgroundColor || '#111827' };
      }
      return { 
        backgroundImage: sanitizeCssUrl(theme.backgroundImageUrl || ''),
        backgroundSize: 'cover',
        backgroundPosition: `${position.x}% ${position.y}%`,
        backgroundColor: theme.backgroundColor || '#111827'
      };
    case 'video':
      return { 
        backgroundColor: '#0a0a0a',
        background: '#0a0a0a'
      };
    default:
      return { backgroundColor: theme.backgroundColor || '#f2f2f2' };
  }
};

const getAnimationVariants = (animation?: string): Variants => {
  const baseVisible = { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } };
  
  if (!animation || animation === 'none') {
    return {
      hidden: { opacity: 0, y: 20 },
      visible: baseVisible
    };
  }

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

const getThumbnailShapeClass = (shape?: ThumbnailShape, buttonRadius?: ButtonRadius): string => {
  const effectiveShape = shape || 'round';

  if (effectiveShape === 'match-card') {
    switch (buttonRadius) {
      case 'none': return 'rounded-none';
      case 'sm': return 'rounded-sm';
      case 'md': return 'rounded-lg';
      case 'lg': return 'rounded-xl';
      case 'xl': return 'rounded-2xl';
      case 'full': return 'rounded-full';
      case 'leaf': return 'rounded-tl-2xl rounded-br-2xl rounded-tr-xs rounded-bl-xs';
      default: return 'rounded-full';
    }
  }

  switch (effectiveShape) {
    case 'square': return 'rounded-none';
    case 'rounded': return 'rounded-xl';
    case 'round': 
    default:
      return 'rounded-full';
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

interface EllipseRipple {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  border: string;
}

const hexToRgba = (color: string | undefined, alpha: number, fallback: string) => {
  if (!color) return fallback;
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.length === 4 
      ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` 
      : c;
    if (hex.length === 7) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (c.startsWith('rgb')) {
    return c.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  return fallback;
};

const getAppliedThemeColors = (theme: Theme, link?: LinkItem) => {
  // 1. Se o link individual possuir cor personalizada definida e não for branco/transparente
  const linkCustomColor = link?.buttonColor?.trim();
  const isLinkCustom = !!(
    linkCustomColor &&
    linkCustomColor !== 'transparent' &&
    linkCustomColor.toLowerCase() !== '#ffffff' &&
    linkCustomColor.toLowerCase() !== '#fff'
  );

  // 2. Se a cor dos botões no tema for personalizada e não for branca/transparente
  const themeButtonCustom = theme.buttonColor?.trim();
  const isThemeButtonCustom = !!(
    themeButtonCustom &&
    themeButtonCustom !== 'transparent' &&
    themeButtonCustom.toLowerCase() !== '#ffffff' &&
    themeButtonCustom.toLowerCase() !== '#fff'
  );

  // 3. Extrair cores do tema aplicado no momento (gradiente ou cor sólida)
  let themeBaseColor = '#18181b';
  let themeBackground = '';
  let themeAccent = '#2563eb';

  if (theme.backgroundType === 'gradient' || theme.backgroundType === 'animated-gradient') {
    themeBackground = theme.backgroundGradient || 'linear-gradient(135deg, #18181b 0%, #09090b 100%)';
    const matches = themeBackground.match(/#([A-Fa-f0-9]{6,8}|[A-Fa-f0-9]{3,4})|(rgba?|hsla?|oklch)\([^)]+\)/gi);
    if (matches && matches.length > 0) {
      themeBaseColor = matches[0];
      themeAccent = matches.length > 1 ? matches[1] : matches[0];
    }
  } else if (theme.backgroundType === 'color') {
    themeBaseColor = theme.backgroundColor || '#18181b';
    themeBackground = themeBaseColor;
    themeAccent = themeBaseColor;
  } else {
    // image ou video
    themeBaseColor = theme.backgroundColor || '#18181b';
    themeBackground = themeBaseColor;
    themeAccent = '#2563eb';
  }

  // 4. Seleção da cor e fundo da transição
  let finalColor = themeBaseColor;
  let finalBackground = themeBackground || themeBaseColor;
  let finalBorder = themeAccent;

  if (isLinkCustom) {
    finalColor = linkCustomColor!;
    finalBackground = linkCustomColor!;
    finalBorder = linkCustomColor!;
  } else if (isThemeButtonCustom) {
    finalColor = themeButtonCustom!;
    finalBackground = themeButtonCustom!;
    finalBorder = themeButtonCustom!;
  }

  // Se por acaso finalColor for branco ou quase transparente,
  // busca a primeira cor do gradiente ou destaque para garantir que NUNCA aconteça em branco
  if (
    finalColor.toLowerCase() === '#ffffff' ||
    finalColor.toLowerCase() === '#fff' ||
    finalColor === 'transparent'
  ) {
    if (theme.backgroundGradient) {
      const matches = theme.backgroundGradient.match(/#([A-Fa-f0-9]{6,8}|[A-Fa-f0-9]{3,4})|(rgba?|hsla?|oklch)\([^)]+\)/gi);
      const nonWhite = matches?.find(m => m.toLowerCase() !== '#ffffff' && m.toLowerCase() !== '#fff');
      if (nonWhite) {
        finalColor = nonWhite;
        finalBackground = theme.backgroundGradient;
        finalBorder = nonWhite;
      } else {
        finalColor = '#18181b';
        finalBackground = '#18181b';
        finalBorder = '#3b82f6';
      }
    } else if (theme.buttonTextColor && theme.buttonTextColor.toLowerCase() !== '#000000' && theme.buttonTextColor.toLowerCase() !== '#ffffff' && theme.buttonTextColor.toLowerCase() !== '#fff') {
      finalColor = theme.buttonTextColor;
      finalBackground = theme.buttonTextColor;
      finalBorder = theme.buttonTextColor;
    } else {
      finalColor = '#18181b';
      finalBackground = '#18181b';
      finalBorder = '#3b82f6';
    }
  }

  return {
    color: finalColor,
    background: finalBackground,
    borderColor: finalBorder,
    textColor: link?.textColor || theme.buttonTextColor || '#ffffff',
    rippleFill: hexToRgba(finalColor, 0.28, 'rgba(37, 99, 235, 0.25)'),
    rippleBorder: hexToRgba(finalBorder || finalColor, 0.65, 'rgba(37, 99, 235, 0.6)'),
  };
};

interface LinkItemCardProps {
  link: LinkItem;
  theme: Theme;
  onLinkClick?: (id: string) => void;
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

const LinkItemCard: React.FC<LinkItemCardProps> = React.memo(({ 
  link, 
  theme, 
  onLinkClick,
  onTriggerCircleTransition,
}) => {
  const [ripples, setRipples] = useState<EllipseRipple[]>([]);
  const isNavigatingRef = useRef(false);
  const format = theme.linkFormat || 'classic';
  const linkTextColor = link.textColor || theme.buttonTextColor || '#000000';
  const linkBgColor = link.buttonColor || theme.buttonColor || '#ffffff';
  const thumbPos = link.thumbnailPosition || theme.linkThumbnailPosition || 'left';
  const isRight = thumbPos === 'right';
  const thumbShape = link.thumbnailShape || theme.linkThumbnailShape || 'round';
  const thumbShapeClass = getThumbnailShapeClass(thumbShape, theme.buttonRadius);
  const normalizedUrl = link.url?.trim() 
    ? (/^(https?:\/\/|mailto:|tel:)/i.test(link.url.trim()) ? link.url.trim() : `https://${link.url.trim()}`) 
    : '#';

  const triggerRipple = (clientX: number, clientY: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const x = clientX ? clientX - rect.left : rect.width / 2;
    const y = clientY ? clientY - rect.top : rect.height / 2;

    // Distância máxima do ponto do clique até o canto mais distante do botão
    const distX = Math.max(x, rect.width - x);
    const distY = Math.max(y, rect.height - y);
    const maxRadius = Math.hypot(distX, distY);

    // Geometria em elipse calculada para o tamanho real do botão
    const width = Math.max(maxRadius * 2.5, rect.width * 1.35);
    const height = Math.max(maxRadius * 1.6, rect.height * 2.2);

    const themeColors = getAppliedThemeColors(theme, link);

    const id = Date.now() + Math.random();
    setRipples(prev => [...prev.slice(-1), {
      id,
      x,
      y,
      width,
      height,
      fill: themeColors.rippleFill,
      border: themeColors.rippleBorder,
    }]);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.button !== 0) return;
    triggerRipple(e.clientX, e.clientY, e.currentTarget);
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();

    // Dispara a onda caso não tenha sido disparada pelo pointerdown
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX || (rect.left + rect.width / 2);
    const clientY = e.clientY || (rect.top + rect.height / 2);
    triggerRipple(clientX, clientY, e.currentTarget);

    onLinkClick?.(link.id);

    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    const targetUrl = sanitizeUrl(normalizedUrl);
    if (!targetUrl || targetUrl === '#') {
      isNavigatingRef.current = false;
      return;
    }

    const isMailOrTel = targetUrl.startsWith('mailto:') || targetUrl.startsWith('tel:');
    let popup: Window | null = null;
    
    // Abre a aba AGORA - ainda temos user activation
    if (!isMailOrTel) {
      popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }

    const themeColors = getAppliedThemeColors(theme, link);

    if (onTriggerCircleTransition) {
      onTriggerCircleTransition({
        clientX,
        clientY,
        color: themeColors.color,
        background: themeColors.background,
        borderColor: themeColors.borderColor,
        textColor: themeColors.textColor,
        url: targetUrl,
      });
    }

    // Fallback: popup bloqueado -> mesma aba
    setTimeout(() => {
      isNavigatingRef.current = false;
      if (!popup && !isMailOrTel) {
        window.location.href = targetUrl;
      } else if (isMailOrTel) {
        window.location.href = targetUrl;
      }
    }, 450);
  };

  const animationVariants = React.useMemo(() => getAnimationVariants(link.animation), [link.animation]);

  return (
    <motion.a 
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      variants={animationVariants}
      whileHover={{ scale: 1.015, y: -1 }}
      href={normalizedUrl} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`${getButtonStyle(theme)} overflow-hidden transition-all relative select-none`}
      style={
        theme.buttonStyle === 'solid' 
          ? { backgroundColor: linkBgColor, color: linkTextColor }
          : theme.buttonStyle === 'outline'
            ? { borderColor: linkBgColor, color: linkTextColor }
            : { color: linkTextColor }
      }
    >
      {/* Dynamic Wavefront: surge circular exatamente no ponto do clique e desabrocha em elipse */}
      <AnimatePresence>
        {ripples.map(ripple => (
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
              setRipples(prev => prev.filter(r => r.id !== ripple.id));
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

      {format === 'featured' ? (
        <div className="flex flex-col w-full">
          {link.thumbnailUrl && !isPrivateUrl(link.thumbnailUrl) && (
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
          {link.thumbnailUrl && !isPrivateUrl(link.thumbnailUrl) && (
            <img 
              src={link.thumbnailUrl} 
              alt="" 
              loading="lazy" 
              decoding="async" 
              className={`absolute ${isRight ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 w-8 h-8 ${thumbShapeClass} object-cover flex-shrink-0`} 
            />
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
          {link.thumbnailUrl && !isPrivateUrl(link.thumbnailUrl) ? (
            <>
               <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-transparent z-10" />
               <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover z-0" />
            </>
          ) : (
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-black/10 z-10" />
          )}
          <div className="relative z-20 p-4 w-full text-center text-white">
            <div className="font-bold text-xl drop-shadow-md">{link.title}</div>
            {link.description && <div className="text-sm opacity-90 mt-0.5 drop-shadow-md">{link.description}</div>}
          </div>
        </div>
      ) : (
        // Formato Classic (Padrão) - Centralizado
        <div className="relative w-full flex items-center justify-center min-h-[58px] py-3.5 px-4 text-center">
          {link.thumbnailUrl && !isPrivateUrl(link.thumbnailUrl) && (
            <div className={`absolute ${isRight ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center ${thumbShapeClass} overflow-hidden flex-shrink-0`}>
              <img src={link.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            </div>
          )}
          
          <div className={`w-full ${link.thumbnailUrl ? 'px-14' : 'px-2'} flex flex-col items-center justify-center text-center`}>
            <div className="font-semibold text-base sm:text-lg leading-snug break-words">{link.title}</div>
            {link.description && <div className="text-xs sm:text-sm opacity-80 mt-0.5 leading-snug break-words">{link.description}</div>}
          </div>
        </div>
      )}
    </motion.a>
  );
});

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
  const [circleTransition, setCircleTransition] = useState<CircleTransitionData | null>(null);
  const pendingNavigationUrlRef = useRef<string | null>(null);

  const handleTriggerCircleTransition = useCallback(({
    clientX,
    clientY,
    color,
    background,
    borderColor,
    textColor,
    url,
  }: {
    clientX: number;
    clientY: number;
    color: string;
    background?: string;
    borderColor?: string;
    textColor?: string;
    url?: string;
  }) => {
    let relativeX = clientX;
    let relativeY = clientY;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      relativeX = clientX - rect.left;
      relativeY = clientY - rect.top;
    }

    pendingNavigationUrlRef.current = url || null;

    setCircleTransition({
      x: relativeX,
      y: relativeY,
      color,
      background,
      borderColor,
      textColor,
    });
  }, []);

  const handleCircleReadyToNavigate = useCallback(() => {
    // A navegação real (window.open) agora é feita de forma síncrona no handleClick
    // para evitar bloqueio pelo navegador. Aqui mantemos apenas para efeitos colaterais
    // caso necessário no futuro.
  }, []);

  const handleCircleFinished = useCallback(() => {
    setCircleTransition(null);
    pendingNavigationUrlRef.current = null;
  }, []);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  const [isBackgroundReady, setIsBackgroundReady] = useState(() => {
    return theme.backgroundType !== 'image' && theme.backgroundType !== 'video';
  });

  useEffect(() => {
    let safetyTimer: NodeJS.Timeout | null = null;

    if (theme.backgroundType === 'image' && theme.backgroundImageUrl) {
      setIsBackgroundReady(false);
      const img = new Image();
      img.src = theme.backgroundImageUrl;
      if (img.complete) {
        setIsBackgroundReady(true);
      } else {
        img.onload = () => setIsBackgroundReady(true);
        img.onerror = () => setIsBackgroundReady(true);
      }
      safetyTimer = setTimeout(() => {
        setIsBackgroundReady(true);
      }, 3000);
    } else if (theme.backgroundType === 'video') {
      if (!theme.backgroundVideoUrl) {
        // Se a URL do vídeo estiver vazia, libera imediatamente sem bloquear
        setIsBackgroundReady(true);
      } else {
        setIsBackgroundReady(isVideoReady);
        // Timeout de segurança: no máximo 3s de loading
        safetyTimer = setTimeout(() => {
          setIsBackgroundReady(true);
        }, 3000);
      }
    } else {
      setIsBackgroundReady(true);
    }

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [theme.backgroundType, theme.backgroundImageUrl, theme.backgroundVideoUrl, isVideoReady]);

  // Responsive device mode detection using matchMedia to prevent constant resize repaints
  const [isMobileDevice, setIsMobileDevice] = useState(() => 
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsMobileDevice(e.matches);
    };
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  const effectiveMode: 'mobile' | 'desktop' = previewMode || (isMobileDevice ? 'mobile' : 'desktop');

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

  // Advertisement / Shopee Promo Modal State (display logic and frequency check)
  const [isAdOpen, setIsAdOpen] = useState(false);

  // Check frequency (3 hours by default) and display ad if appropriate
  useEffect(() => {
    const checkAndShowAd = () => {
      if (!ad || !ad.enabled || !ad.buttonUrl) {
        setIsAdOpen(false);
        return;
      }

      const freqHours = ad.frequencyHours ?? 3;
      const freqMs = freqHours * 60 * 60 * 1000;
      try {
        const lastSeenStr = localStorage.getItem('linkhub_last_ad_seen');
        const lastUpdatedStr = localStorage.getItem('linkhub_last_ad_updated_at');

        const now = Date.now();
        const hasExpired = !lastSeenStr || (now - Number(lastSeenStr) >= freqMs);
        const isNewAdVersion = Boolean(ad.updatedAt && (!lastUpdatedStr || Number(lastUpdatedStr) < ad.updatedAt));

        if (hasExpired || isNewAdVersion) {
          setIsAdOpen(true);
          if (ad.updatedAt) {
            localStorage.setItem('linkhub_last_ad_updated_at', ad.updatedAt.toString());
          }
        }
      } catch (e) {
        // Fallback gracefully in incognito mode
        console.warn('localStorage is not available for ad tracking.');
      }
    };

    checkAndShowAd();

    // Listen for manual preview test triggers from Admin Editor
    const handleTriggerPreview = () => {
      setIsAdOpen(true);
    };

    window.addEventListener('linkhub_trigger_ad_preview', handleTriggerPreview);
    return () => {
      window.removeEventListener('linkhub_trigger_ad_preview', handleTriggerPreview);
    };
  }, [ad]);

  const handleCloseAd = useCallback(() => {
    try {
      localStorage.setItem('linkhub_last_ad_seen', Date.now().toString());
    } catch {}
    setIsAdOpen(false);
  }, []);

  const publicUrl = typeof window !== 'undefined' ? window.location.href : 'https://linkhub.com';

  const objectUrlsThisRunRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const url = theme.backgroundVideoUrl;
    let objectUrl: string | null = null;
    let isMounted = true;
    setIsVideoReady(false);
    const cleanup = () => {
      isMounted = false;
      objectUrlsThisRunRef.current.forEach(u => {
        URL.revokeObjectURL(u);
        for (const [key, val] of videoBlobCache.entries()) {
          if (val === u) videoBlobCache.delete(key);
        }
      });
      objectUrlsThisRunRef.current.clear();
    };

    if (url && url.startsWith('firestore_chunked|')) {
      if (!isFirebaseConfigured || !db) {
        setResolvedVideoUrl(null);
        return cleanup;
      }

      // 1. Check in-memory cache first for instant 0ms playback
      if (videoBlobCache.has(url)) {
        const cachedObjUrl = videoBlobCache.get(url)!;
        setResolvedVideoUrl(cachedObjUrl);
        objectUrlsThisRunRef.current.add(cachedObjUrl);
        return cleanup;
      }

      // 2. Check persistent IndexedDB cache (0-15ms local disk playback on repeat visits)
      let isCachedResolved = false;
      getCachedVideoBlob(url).then((cachedBlob) => {
        if (!isMounted) return;
        if (cachedBlob) {
          isCachedResolved = true;
          objectUrl = URL.createObjectURL(cachedBlob);
          objectUrlsThisRunRef.current.add(objectUrl);
          videoBlobCache.set(url, objectUrl);
          setResolvedVideoUrl(objectUrl);
        }
      }).catch(() => {});

      const [, fileId, chunksStr] = url.split('|');
      const totalChunks = parseInt(chunksStr, 10);
      
      const loadVideo = async () => {
        if (!db) return;
        try {
          // Download ALL chunks in parallel with Promise.all (cuts time by 80-90%)
          const chunkPromises = Array.from({ length: totalChunks }, (_, i) => 
            getDoc(doc(db!, 'media_chunks', `${fileId}_chunk_${i}`))
          );
          const snaps = await Promise.all(chunkPromises);

          let base64String = '';
          for (const snap of snaps) {
            if (snap.exists()) {
              base64String += snap.data().data;
            }
          }

          if (isMounted && base64String && !isCachedResolved) {
             const res = await fetch(base64String);
             const blob = await res.blob();
             // Cache in IndexedDB for instant future visits
             setCachedVideoBlob(url, blob);
             objectUrl = URL.createObjectURL(blob);
             objectUrlsThisRunRef.current.add(objectUrl);
             videoBlobCache.set(url, objectUrl);
             setResolvedVideoUrl(objectUrl);
          } else if (isMounted && (!base64String || base64String.length === 0)) {
             console.warn("Chunks de vídeo vazios ou não encontrados no Firestore:", fileId);
             setIsVideoReady(true);
             setIsBackgroundReady(true);
          }
        } catch (err) {
          console.error("Erro ao remontar video", err);
          if (isMounted) {
            setIsVideoReady(true);
            setIsBackgroundReady(true);
          }
        }
      };
      loadVideo();
    } else {
      setResolvedVideoUrl(url || null);
    }

    return cleanup;
  }, [theme.backgroundVideoUrl]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${isAnimated ? 'animated-gradient-bg' : ''}`} 
      style={{ ...getBackgroundStyle(theme, activePosition), fontFamily: theme.fontFamily }}
    >
      {/* Fullscreen Circle Transition Overlay (Estilo PAINEL-DSS) */}
      <FullscreenCircleTransition
        transitionData={circleTransition}
        containerRef={containerRef}
        onReadyToNavigate={handleCircleReadyToNavigate}
        onFinished={handleCircleFinished}
      />
      {/* Video Background Layer (alta prioridade, preload e transição suave por GPU) */}
      {theme.backgroundType === 'video' && resolvedVideoUrl && (
        <video 
          key={resolvedVideoUrl}
          autoPlay 
          loop 
          muted 
          playsInline
          preload="auto"
          poster={theme.backgroundImageUrl || undefined}
          onLoadedData={() => setIsVideoReady(true)}
          onCanPlay={() => setIsVideoReady(true)}
          onError={() => { setIsVideoReady(true); setIsBackgroundReady(true); }}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-0 transition-opacity duration-700 ease-out transform-gpu will-change-transform ${isVideoReady ? 'opacity-100' : 'opacity-0'}`}
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
          {profile.avatarUrl && !isPrivateUrl(profile.avatarUrl) ? (
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
          {(links || []).filter(l => l.isVisible).map(link => (
            <LinkItemCard 
              key={link.id} 
              link={link} 
              theme={theme} 
              onLinkClick={onLinkClick} 
              onTriggerCircleTransition={handleTriggerCircleTransition}
            />
          ))}
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
              role="dialog"
              aria-modal="true"
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
      {ad && (
        <AdvertisementModal
          ad={ad}
          isOpen={isAdOpen}
          onClose={handleCloseAd}
          onAdClick={onLinkClick}
          onTriggerCircleTransition={handleTriggerCircleTransition}
        />
      )}

      {/* Liquid Glass Loading Overlay */}
      <AnimatePresence>
        {!isBackgroundReady && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-2xl touch-none pointer-events-auto"
          >
            <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full border-[3px] border-white/50 border-t-white animate-spin drop-shadow-md"></div>
              <p className="text-white text-sm font-medium tracking-wide drop-shadow-md">Carregando...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
