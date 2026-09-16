import React, { useEffect, useState } from 'react';

export interface CircleTransitionData {
  x: number;
  y: number;
  color: string;
  background?: string;
  borderColor?: string;
  textColor?: string;
}

interface FullscreenCircleTransitionProps {
  transitionData: CircleTransitionData | null;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  onReadyToNavigate?: () => void;
  onFinished?: () => void;
}

const FullscreenCircleTransition: React.FC<FullscreenCircleTransitionProps> = ({
  transitionData,
  containerRef,
  onReadyToNavigate,
  onFinished,
}) => {
  const [styleParams, setStyleParams] = useState<{
    x: number;
    y: number;
    radius: number;
    color: string;
    background?: string;
    borderColor?: string;
    textColor: string;
  } | null>(null);

  const [phase, setPhase] = useState<'idle' | 'expanding' | 'fading'>('idle');

  useEffect(() => {
    if (!transitionData) {
      setPhase('idle');
      setStyleParams(null);
      return;
    }

    const { x, y, color, background, borderColor, textColor = '#ffffff' } = transitionData;

    // Obter dimensões do container do preview ou da janela
    let containerWidth = window.innerWidth;
    let containerHeight = window.innerHeight;

    if (containerRef?.current) {
      const rect = containerRef.current.getBoundingClientRect();
      containerWidth = rect.width;
      containerHeight = rect.height;
    }

    // Calcula a distância máxima do clique até os 4 cantos da tela/container
    const maxDistX = Math.max(x, containerWidth - x);
    const maxDistY = Math.max(y, containerHeight - y);
    const radius = Math.ceil(Math.hypot(maxDistX, maxDistY)) + 20;

    setStyleParams({
      x,
      y,
      radius,
      color: color || '#18181b',
      background: background || color || '#18181b',
      borderColor: borderColor || color || '#3b82f6',
      textColor,
    });
    setPhase('expanding');

    // Ao atingir ~450ms (círculo cobriu a tela inteira), aciona a navegação do link
    const navigateTimer = setTimeout(() => {
      onReadyToNavigate?.();
      setPhase('fading');
    }, 450);

    // Conclui a transição e limpa
    const finishTimer = setTimeout(() => {
      setPhase('idle');
      setStyleParams(null);
      onFinished?.();
    }, 750);

    return () => {
      clearTimeout(navigateTimer);
      clearTimeout(finishTimer);
    };
  }, [transitionData, containerRef, onReadyToNavigate, onFinished]);

  if (phase === 'idle' || !styleParams) return null;

  return (
    <div
      className={`absolute inset-0 pointer-events-none z-[100] overflow-hidden ${
        phase === 'fading' ? 'fullscreen-circle-fading' : ''
      }`}
      style={{
        '--circle-x': `${styleParams.x}px`,
        '--circle-y': `${styleParams.y}px`,
        '--circle-r': `${styleParams.radius}px`,
      } as React.CSSProperties}
    >
      {/* Camada principal de preenchimento com a expansão circular na cor do tema */}
      <div
        className="absolute inset-0 fullscreen-circle-layer"
        style={{
          background: styleParams.background || styleParams.color,
          backgroundColor: styleParams.color,
        }}
      />

      {/* Anel de destaque frontal na cor do tema */}
      <div
        className="absolute inset-0 fullscreen-circle-shockwave"
        style={{
          borderColor: styleParams.borderColor || styleParams.color,
        }}
      />
    </div>
  );
};

export default React.memo(FullscreenCircleTransition);
