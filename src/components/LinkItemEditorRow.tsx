import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Trash2, Image as ImageIcon } from 'lucide-react';
import { LinkItem, Theme } from '../types';
import { ColorPicker } from './ColorPicker';

interface LinkItemEditorRowProps {
  link: LinkItem;
  index: number;
  totalLinks: number;
  moveLink: (index: number, direction: 'up' | 'down') => void;
  updateLink: (id: string, field: keyof LinkItem, value: any) => void;
  removeLink: (id: string) => void;
  handleFileUpload: (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video',
    targetField: any,
    linkId?: string
  ) => void;
  theme: Theme;
}

export const LinkItemEditorRow: React.FC<LinkItemEditorRowProps> = React.memo(({
  link,
  index,
  totalLinks,
  moveLink,
  updateLink,
  removeLink,
  handleFileUpload,
  theme,
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={link}
      id={link.id}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{ scale: 1.01, zIndex: 40, boxShadow: '0 12px 30px -4px rgba(0,0,0,0.6)' }}
      className="bg-gray-800/95 backdrop-blur-sm rounded-3xl py-5 px-10 sm:px-12 shadow-md border border-gray-700/60 relative transition-all flex justify-center group/card"
    >
      {/* Drag & Move Handles */}
      <div className="absolute left-1.5 sm:left-3.5 top-0 bottom-0 flex flex-col items-center justify-center gap-1.5 text-gray-500 w-8 select-none">
        <button
          type="button"
          onClick={() => moveLink(index, 'up')}
          disabled={index === 0}
          className="hover:text-blue-400 disabled:opacity-20 transition-colors p-1 cursor-pointer"
          title="Mover para cima"
        >
          ▲
        </button>
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="cursor-grab active:cursor-grabbing p-1.5 rounded-xl hover:bg-gray-700/80 hover:text-white transition-all touch-none"
          title="Segure e arraste para reordenar"
        >
          <GripVertical className="w-5 h-5 opacity-60 group-hover/card:opacity-90 hover:!opacity-100 mx-auto" />
        </div>
        <button
          type="button"
          onClick={() => moveLink(index, 'down')}
          disabled={index === totalLinks - 1}
          className="hover:text-blue-400 disabled:opacity-20 transition-colors p-1 cursor-pointer"
          title="Mover para baixo"
        >
          ▼
        </button>
      </div>

      <div className="w-full space-y-3.5">
        <div>
          <input
            type="text"
            value={link.title}
            onChange={(e) => updateLink(link.id, 'title', e.target.value)}
            placeholder="Título do Link"
            className="w-full text-center bg-gray-900/70 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/30 font-medium transition-all"
          />
        </div>
        <div>
          <input
            type="text"
            value={link.description || ''}
            onChange={(e) => updateLink(link.id, 'description', e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full text-center bg-gray-900/70 border border-gray-700/40 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/30 transition-all"
          />
        </div>
        <div>
          <input
            type="url"
            value={link.url}
            onChange={(e) => updateLink(link.id, 'url', e.target.value)}
            placeholder="URL (https://...)"
            className="w-full text-center bg-gray-900/70 border border-gray-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/30 transition-all font-mono text-xs"
          />
        </div>

        {/* Thumbnail URL and Local Upload */}
        <div className="flex gap-2 justify-center relative">
          <label
            className="absolute left-0 cursor-pointer w-11 h-11 bg-gray-900/70 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors border border-gray-700/40"
            title="Anexar Imagem"
          >
            <ImageIcon className="w-5 h-5 text-gray-400 hover:text-white transition-colors" />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e, 'image', 'linkThumb', link.id)}
              className="hidden"
            />
          </label>
          <input
            type="url"
            value={link.thumbnailUrl || ''}
            onChange={(e) => updateLink(link.id, 'thumbnailUrl', e.target.value)}
            placeholder="URL do Ícone ou anexe uma imagem"
            className="w-full text-center pl-12 pr-12 bg-gray-900/70 border border-gray-700/40 rounded-xl py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/30 transition-all"
          />
        </div>

        {link.thumbnailUrl && (
          <div className="pt-2 flex flex-col items-center">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 px-1 text-center">
              Posição da Foto
            </label>
            <div className="flex justify-center gap-1.5 bg-gray-900/90 border border-gray-800 p-1.5 rounded-2xl w-full max-w-[280px]">
              <button
                type="button"
                onClick={() => updateLink(link.id, 'thumbnailPosition', 'left')}
                className={`flex-1 py-1.5 px-3 text-xs rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  (!link.thumbnailPosition || link.thumbnailPosition === 'left')
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <span>Esquerda</span>
              </button>
              <button
                type="button"
                onClick={() => updateLink(link.id, 'thumbnailPosition', 'right')}
                className={`flex-1 py-1.5 px-3 text-xs rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  link.thumbnailPosition === 'right'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                <span>Direita</span>
              </button>
            </div>

            <div className="w-full pt-3">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 px-1 text-center">
                Formato da Imagem
              </label>
              <div className="flex bg-gray-900/90 border border-gray-800 p-1.5 rounded-2xl gap-1.5 w-full max-w-[380px] mx-auto">
                <button
                  type="button"
                  onClick={() => updateLink(link.id, 'thumbnailShape', 'round')}
                  className={`flex-1 py-2 px-2 text-xs rounded-xl font-semibold whitespace-nowrap transition-all ${
                    (!link.thumbnailShape ? (!theme.linkThumbnailShape || theme.linkThumbnailShape === 'round') : link.thumbnailShape === 'round')
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  Círculo
                </button>
                <button
                  type="button"
                  onClick={() => updateLink(link.id, 'thumbnailShape', 'rounded')}
                  className={`flex-1 py-2 px-2 text-xs rounded-xl font-semibold whitespace-nowrap transition-all ${
                    link.thumbnailShape === 'rounded'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  Arredondado
                </button>
                <button
                  type="button"
                  onClick={() => updateLink(link.id, 'thumbnailShape', 'square')}
                  className={`flex-1 py-2 px-2 text-xs rounded-xl font-semibold whitespace-nowrap transition-all ${
                    link.thumbnailShape === 'square'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  Quadrado
                </button>
                <button
                  type="button"
                  onClick={() => updateLink(link.id, 'thumbnailShape', 'match-card')}
                  className={`flex-1 py-2 px-2 text-xs rounded-xl font-semibold whitespace-nowrap transition-all ${
                    (link.thumbnailShape === 'match-card' || (!link.thumbnailShape && theme.linkThumbnailShape === 'match-card'))
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                  title="Formato acompanha o formato do cartão de link"
                >
                  Do Cartão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Highlight Animation */}
        <div className="pt-2 flex flex-col items-center">
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2 px-1 text-center">
            Animação em Destaque
          </label>
          <div className="flex flex-wrap justify-center gap-1.5 bg-gray-900/90 border border-gray-800 p-1.5 rounded-2xl w-full">
            <button
              type="button"
              onClick={() => updateLink(link.id, 'animation', 'none')}
              className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${!link.animation || link.animation === 'none' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
            >
              Nenhuma
            </button>
            <button
              type="button"
              onClick={() => updateLink(link.id, 'animation', 'pulse')}
              className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'pulse' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
            >
              Pulsar
            </button>
            <button
              type="button"
              onClick={() => updateLink(link.id, 'animation', 'bounce')}
              className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'bounce' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
            >
              Saltar
            </button>
            <button
              type="button"
              onClick={() => updateLink(link.id, 'animation', 'shake')}
              className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'shake' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
            >
              Tremer
            </button>
            <button
              type="button"
              onClick={() => updateLink(link.id, 'animation', 'glow')}
              className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'glow' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800/60'}`}
            >
              Brilho
            </button>
          </div>
        </div>

        {/* Visibility and Remove */}
        <div className="flex items-center justify-between pt-3 px-1 relative border-t border-gray-700/40">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-10 h-6 rounded-full p-1 transition-colors ${link.isVisible ? 'bg-blue-600' : 'bg-gray-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${link.isVisible ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            <input
              type="checkbox"
              checked={link.isVisible}
              onChange={(e) => updateLink(link.id, 'isVisible', e.target.checked)}
              className="hidden"
            />
            <span className="text-sm font-semibold text-gray-300">Visível</span>
          </label>

          <button
            type="button"
            onClick={() => removeLink(link.id)}
            className="text-red-400 hover:bg-red-500/10 p-2 rounded-xl transition-colors cursor-pointer"
            title="Remover link"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Custom colors for this specific link */}
        <div className="pt-3 border-t border-gray-700/50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400">
          <span className="font-semibold text-xs text-gray-400">Cores deste link:</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" title="Cor do texto deste link">
              <span className="text-xs text-gray-400">Texto</span>
              <ColorPicker
                color={link.textColor || theme.buttonTextColor || '#000000'}
                onChange={(color) => updateLink(link.id, 'textColor', color)}
                title="Cor do Texto"
                className="w-8 h-8"
              />
            </div>
            <div className="flex items-center gap-1.5" title="Cor do fundo deste link">
              <span className="text-xs text-gray-400">Fundo</span>
              <ColorPicker
                color={link.buttonColor || theme.buttonColor || '#ffffff'}
                onChange={(color) => updateLink(link.id, 'buttonColor', color)}
                title="Cor do Fundo"
                className="w-8 h-8"
              />
            </div>
            {(link.textColor || link.buttonColor) && (
              <button
                type="button"
                onClick={() => {
                  updateLink(link.id, 'textColor', undefined);
                  updateLink(link.id, 'buttonColor', undefined);
                }}
                className="text-xs text-blue-400 font-semibold hover:underline ml-1 cursor-pointer"
                title="Restaurar cores padrão"
              >
                Resetar
              </button>
            )}
          </div>
        </div>
      </div>
    </Reorder.Item>
  );
});
