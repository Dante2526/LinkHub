import React, { useState, useEffect, useRef } from 'react';
import { AppData, LinkItem, Theme, Advertisement, defaultAd, BackgroundPosition } from '../types';
import { GripVertical, Plus, Trash2, Image as ImageIcon, Video, Palette, Link as LinkIcon, User, Camera, BarChart3, MousePointerClick, Clock, Calendar, Eye, Loader2, Upload, ShoppingBag, Megaphone, Sparkles, ExternalLink, Play, Tag, Timer, CheckCircle2, Move, Smartphone, Monitor } from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { CustomSelect, SelectOption } from './CustomSelect';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getCountFromServer, getDocs, query, orderBy, limit, setDoc, doc } from 'firebase/firestore';
import { db, storage, isFirebaseConfigured } from '../lib/firebase';

const BACKGROUND_TYPE_OPTIONS: SelectOption[] = [
  { value: 'color', label: 'Cor Sólida', subtitle: 'Cor única de fundo' },
  { value: 'gradient', label: 'Gradiente Estático', subtitle: 'Degradê suave entre duas cores' },
  { value: 'animated-gradient', label: 'Gradiente Animado', subtitle: 'Degradê pulsante com movimento' },
  { value: 'image', label: 'Imagem', subtitle: 'Upload do aparelho ou link URL' },
  { value: 'video', label: 'Vídeo', subtitle: 'Vídeo dinâmico de fundo em loop' },
];

const BUTTON_RADIUS_OPTIONS: SelectOption[] = [
  { 
    value: 'none', 
    label: 'Reto (Sem borda)', 
    subtitle: 'Cantos retos sem arredondamento',
    preview: <span className="w-5 h-5 bg-blue-600 rounded-none inline-block border border-blue-400" /> 
  },
  { 
    value: 'sm', 
    label: 'Suave', 
    subtitle: 'Arredondamento sutil de 4px',
    preview: <span className="w-5 h-5 bg-blue-600 rounded-sm inline-block border border-blue-400" /> 
  },
  { 
    value: 'md', 
    label: 'Médio', 
    subtitle: 'Arredondamento padrão de 8px',
    preview: <span className="w-5 h-5 bg-blue-600 rounded-md inline-block border border-blue-400" /> 
  },
  { 
    value: 'lg', 
    label: 'Grande', 
    subtitle: 'Bordas curvas de 12px',
    preview: <span className="w-5 h-5 bg-blue-600 rounded-lg inline-block border border-blue-400" /> 
  },
  { 
    value: 'xl', 
    label: 'Super Redondo', 
    subtitle: 'Bordas bem acentuadas de 16px',
    preview: <span className="w-5 h-5 bg-blue-600 rounded-2xl inline-block border border-blue-400" /> 
  },
  { 
    value: 'full', 
    label: 'Pílula', 
    subtitle: 'Totalmente circular nas extremidades',
    preview: <span className="w-7 h-4 bg-blue-600 rounded-full inline-block border border-blue-400" /> 
  },
  { 
    value: 'leaf', 
    label: 'Folha (Assimétrico)', 
    subtitle: 'Design assimétrico exclusivo',
    preview: <span className="w-5 h-5 bg-blue-600 rounded-tl-xl rounded-br-xl inline-block border border-blue-400" /> 
  },
];

const FONT_FAMILY_OPTIONS: SelectOption[] = [
  { 
    value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", 
    label: 'Sistema (Padrão Samsung / Apple)',
    subtitle: 'Rápido, nativo e super legível'
  },
  { 
    value: 'Inter, sans-serif', 
    label: 'Inter',
    subtitle: 'Moderno, limpo e profissional'
  },
  { 
    value: 'ui-serif, Georgia, serif', 
    label: 'Serifa Clássica',
    subtitle: 'Elegante e tradicional'
  },
  { 
    value: 'ui-monospace, SFMono-Regular, monospace', 
    label: 'Monospace',
    subtitle: 'Estilo código e terminal'
  },
  { 
    value: "'Comic Sans MS', cursive, sans-serif", 
    label: 'Divertida / Casual',
    subtitle: 'Descontraído e informal'
  },
];

interface EditorProps {
  data: AppData;
  onChange: (data: AppData) => void;
  previewMode?: 'mobile' | 'desktop';
  isRepositioning?: boolean;
  setIsRepositioning?: (val: boolean) => void;
}

export const Editor: React.FC<EditorProps> = ({ 
  data, 
  onChange,
  previewMode = 'mobile',
  isRepositioning = false,
  setIsRepositioning,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'links' | 'theme' | 'ad' | 'stats'>('links');
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [metrics, setMetrics] = useState({ views: 0, clicks: 0, clicksByLink: {} as Record<string, number>, bestDay: '--', bestHour: '--' });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const bgVideoInputRef = useRef<HTMLInputElement>(null);
  const adImageInputRef = useRef<HTMLInputElement>(null);

  const updateAd = (field: keyof Advertisement, value: any) => {
    const currentAd = data.ad || defaultAd;
    const updated: Advertisement = {
      ...currentAd,
      [field]: value,
      updatedAt: Date.now()
    };
    onChange({ ...data, ad: updated });
  };

  const handleAdImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingState(prev => ({ ...prev, adImage: true }));
    try {
      const compressedDataUrl = await compressImageToDataUrl(file, 800, 0.8);
      const resolvedUrl = compressedDataUrl || URL.createObjectURL(file);
      updateAd('imageUrl', resolvedUrl);
    } catch (err) {
      console.error("Erro ao subir foto do produto para o anúncio", err);
    } finally {
      if (e.target) e.target.value = '';
      setUploadingState(prev => ({ ...prev, adImage: false }));
    }
  };

  const triggerAdPreview = () => {
    window.dispatchEvent(new CustomEvent('linkhub_trigger_ad_preview'));
  };

  // Helper nativo e ultrarrápido para comprimir imagem no dispositivo sem depender de web workers
  const compressImageToDataUrl = (file: File, maxDimension = 320, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      // Timeout de segurança para garantir que nunca fique preso indefinidamente
      const safetyTimer = setTimeout(() => {
        try {
          resolve(URL.createObjectURL(file));
        } catch {
          resolve('');
        }
      }, 3000);

      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const result = (readerEvent.target?.result as string) || '';
        if (!result) {
          clearTimeout(safetyTimer);
          resolve(URL.createObjectURL(file));
          return;
        }

        const img = new Image();
        img.onload = () => {
          clearTimeout(safetyTimer);
          try {
            let { width, height } = img;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', quality));
            } else {
              resolve(result);
            }
          } catch {
            resolve(result);
          }
        };
        img.onerror = () => {
          clearTimeout(safetyTimer);
          resolve(result);
        };
        img.src = result;
      };
      reader.onerror = () => {
        clearTimeout(safetyTimer);
        try {
          resolve(URL.createObjectURL(file));
        } catch {
          resolve('');
        }
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (activeTab === 'stats') {
      const fetchMetrics = async () => {
        setLoadingMetrics(true);
        if (!isFirebaseConfigured) {
          setMetrics({
            views: 0,
            clicks: 0,
            clicksByLink: {},
            bestHour: '--',
            bestDay: '--'
          });
          setLoadingMetrics(false);
          return;
        }
        try {
          const viewsSnap = await getCountFromServer(collection(db, 'visualizacoes'));
          const clicksSnap = await getCountFromServer(collection(db, 'cliques'));
          
          const clicksQuery = await getDocs(query(collection(db, 'cliques'), orderBy('time', 'desc'), limit(500)));
          const clicksByLink: Record<string, number> = {};
          const hourCounts = new Array(24).fill(0);
          const dayCounts: Record<string, number> = {};
          
          clicksQuery.forEach(doc => {
            const cData = doc.data();
            clicksByLink[cData.linkId] = (clicksByLink[cData.linkId] || 0) + 1;
            
            if (cData.time) {
               const date = new Date(cData.time);
               hourCounts[date.getHours()]++;
               const dayStr = date.toLocaleDateString('pt-BR', { weekday: 'long' });
               dayCounts[dayStr] = (dayCounts[dayStr] || 0) + 1;
            }
          });
          
          const maxHourCount = Math.max(0, ...hourCounts);
          const bestHour = maxHourCount > 0 ? hourCounts.indexOf(maxHourCount) : null;
          const bestHourStr = bestHour !== null ? `${bestHour.toString().padStart(2, '0')}:00 - ${(bestHour + 1).toString().padStart(2, '0')}:00` : '--';

          const maxDayCount = Object.keys(dayCounts).length > 0 ? Math.max(...Object.values(dayCounts)) : 0;
          const bestDay = maxDayCount > 0 ? (Object.entries(dayCounts).find(([_, c]) => c === maxDayCount)?.[0] || '--') : '--';
          const bestDayFormatted = bestDay !== '--' ? bestDay.charAt(0).toUpperCase() + bestDay.slice(1) : '--';
          
          setMetrics({
            views: viewsSnap.data().count,
            clicks: clicksSnap.data().count,
            clicksByLink,
            bestHour: bestHourStr,
            bestDay: bestDayFormatted
          });
        } catch (e) {
          console.error("Error fetching metrics", e);
        } finally {
          setLoadingMetrics(false);
        }
      };
      fetchMetrics();
    }
  }, [activeTab]);

  const updateProfile = (field: keyof AppData['profile'], value: string) => {
    onChange({ ...data, profile: { ...data.profile, [field]: value } });
  };

  const updateTheme = (field: keyof Theme, value: any) => {
    onChange({ ...data, theme: { ...data.theme, [field]: value } });
  };

  const currentMode = previewMode || 'mobile';
  const currentPos: BackgroundPosition = (currentMode === 'mobile' 
    ? (data.theme.backgroundPositionMobile || data.theme.backgroundPositionDesktop)
    : (data.theme.backgroundPositionDesktop || data.theme.backgroundPositionMobile)) || { x: 50, y: 50 };

  const updateBackgroundPosition = (newPos: BackgroundPosition) => {
    const field = currentMode === 'mobile' ? 'backgroundPositionMobile' : 'backgroundPositionDesktop';
    onChange({
      ...data,
      theme: {
        ...data.theme,
        [field]: newPos
      }
    });
  };

  const addLink = () => {
    const newLink: LinkItem = {
      id: Date.now().toString(),
      title: 'Novo Link',
      url: '',
      thumbnailUrl: '',
      isVisible: true,
    };
    onChange({ ...data, links: [newLink, ...data.links] });
  };

  const updateLink = (id: string, field: keyof LinkItem, value: any) => {
    const newLinks = data.links.map(l => l.id === id ? { ...l, [field]: value } : l);
    onChange({ ...data, links: newLinks });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video', targetField: keyof Theme | keyof AppData['profile'] | 'linkThumb', linkId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'video' && file.size > 5 * 1024 * 1024) {
      alert("O arquivo é muito grande. O limite para vídeos/GIFs é de 5MB.");
      e.target.value = '';
      return;
    }

    const uploadKey = linkId ? `${targetField}-${linkId}` : targetField;
    setUploadingState(prev => ({ ...prev, [uploadKey]: true }));
    try {
      if (type === 'image') {
        // Converte e comprime a imagem localmente de forma instantânea
        const maxDimension = targetField === 'avatarUrl' ? 256 : targetField === 'linkThumb' ? 200 : 1000;
        const compressedDataUrl = await compressImageToDataUrl(file, maxDimension, 0.75);
        const resolvedUrl = compressedDataUrl || URL.createObjectURL(file);

        // Aplica imediatamente e persiste via Firestore/LocalStorage no App.tsx
        if (targetField === 'avatarUrl') {
          updateProfile('avatarUrl', resolvedUrl);
        } else if (targetField === 'linkThumb' && linkId) {
          updateLink(linkId, 'thumbnailUrl', resolvedUrl);
        } else {
          updateTheme(targetField as keyof Theme, resolvedUrl);
        }
      } else if (type === 'video') {
        // Quebra em chunks no Firestore para vídeos
        const base64String = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Base64 tem ~33% overhead: 600KB de chars → ~450KB de binário real → seguro abaixo de 1MB por doc
        const chunkSize = 600 * 1024;
        const totalChunks = Math.ceil(base64String.length / chunkSize);
        const fileId = `vid_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        for (let i = 0; i < totalChunks; i++) {
          const chunkData = base64String.slice(i * chunkSize, (i + 1) * chunkSize);
          await setDoc(doc(db, 'media_chunks', `${fileId}_chunk_${i}`), {
            data: chunkData,
            index: i,
            fileId: fileId
          });
          setUploadProgress(prev => ({ ...prev, [uploadKey]: Math.round(((i + 1) / totalChunks) * 100) }));
        }
        
        const url = `firestore_chunked|${fileId}|${totalChunks}`;
        updateTheme(targetField as keyof Theme, url);
      }
    } catch (err) {
      console.error("Erro no upload", err);
      alert("Ocorreu um erro ao processar a imagem do dispositivo.");
    } finally {
      if (e.target) {
        e.target.value = '';
      }
      setUploadingState(prev => ({ ...prev, [uploadKey]: false }));
      setUploadProgress(prev => ({ ...prev, [uploadKey]: 0 }));
    }
  };

  const removeLink = (id: string) => {
    onChange({ ...data, links: data.links.filter(l => l.id !== id) });
  };

  const moveLink = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === data.links.length - 1)) return;
    
    const newLinks = [...data.links];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newLinks[index], newLinks[swapIndex]] = [newLinks[swapIndex], newLinks[index]];
    
    onChange({ ...data, links: newLinks });
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Tabs */}
      <div className="px-6 pb-2">
        <div className="flex bg-gray-900/90 border border-gray-800 p-1.5 rounded-2xl gap-1.5 overflow-x-auto no-scrollbar shadow-inner">
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs whitespace-nowrap transition-all ${
              activeTab === 'links' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            Links
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs whitespace-nowrap transition-all ${
              activeTab === 'profile' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            Perfil
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs whitespace-nowrap transition-all ${
              activeTab === 'theme' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            Tema
          </button>
          <button
            onClick={() => setActiveTab('ad')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs whitespace-nowrap transition-all ${
              activeTab === 'ad' 
                ? 'bg-[#ee4d2d] text-white shadow-md shadow-[#ee4d2d]/30' 
                : 'text-gray-400 hover:text-[#ee4d2d] hover:bg-gray-800/60'
            }`}
            title="Cartão de Anúncio / Shopee"
          >
            <ShoppingBag className="w-3.5 h-3.5 flex-shrink-0" />
            Anúncio
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 font-semibold text-xs whitespace-nowrap transition-all ${
              activeTab === 'stats' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            Métricas
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 text-white no-scrollbar">
        {activeTab === 'links' && (
          <div className="space-y-4 flex flex-col pb-8">
            <button 
              onClick={addLink}
              className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" /> Adicionar Link
            </button>
            
            {/* Controles de Aparência dos Cartões de Links */}
            <div className="bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-700/50 space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-gray-700/50">
                <span className="text-sm font-bold text-white">Aparência dos Cartões de Links</span>
                <span className="text-xs text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full font-semibold">Geral</span>
              </div>

              {/* Cor do Texto nos Cartões */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Cor do Texto dos Cartões</label>
                <div className="flex flex-wrap items-center gap-3">
                  <ColorPicker 
                    color={data.theme.buttonTextColor || '#000000'}
                    onChange={(color) => updateTheme('buttonTextColor', color)}
                    className="w-10 h-10 flex-shrink-0"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateTheme('buttonTextColor', '#000000')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        (data.theme.buttonTextColor || '#000000').toLowerCase() === '#000000'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Preto
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTheme('buttonTextColor', '#ffffff')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        data.theme.buttonTextColor?.toLowerCase() === '#ffffff'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Branco
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTheme('buttonTextColor', '#1f2937')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        data.theme.buttonTextColor?.toLowerCase() === '#1f2937'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Grafite
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTheme('buttonTextColor', '#2563eb')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        data.theme.buttonTextColor?.toLowerCase() === '#2563eb'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Azul
                    </button>
                  </div>
                </div>
              </div>

              {/* Cor de Fundo dos Cartões */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Cor de Fundo dos Cartões</label>
                <div className="flex flex-wrap items-center gap-3">
                  <ColorPicker 
                    color={data.theme.buttonColor || '#ffffff'}
                    onChange={(color) => updateTheme('buttonColor', color)}
                    className="w-10 h-10 flex-shrink-0"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateTheme('buttonColor', '#ffffff')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        (data.theme.buttonColor || '#ffffff').toLowerCase() === '#ffffff'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Branco
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTheme('buttonColor', '#18181b')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        data.theme.buttonColor?.toLowerCase() === '#18181b'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Escuro
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTheme('buttonColor', '#f3f4f6')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        data.theme.buttonColor?.toLowerCase() === '#f3f4f6'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Cinza Claro
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4 mt-2">
              {data.links.map((link, index) => (
                <div key={link.id} className="bg-gray-800 rounded-3xl py-5 px-10 sm:px-12 shadow-sm border border-gray-700/50 relative transition-all flex justify-center">
                  <div className="absolute left-1 sm:left-4 top-0 bottom-0 flex flex-col items-center justify-center gap-2 text-gray-600 w-8">
                    <button onClick={() => moveLink(index, 'up')} disabled={index === 0} className="hover:text-blue-500 disabled:opacity-30">▲</button>
                    <GripVertical className="w-5 h-5 opacity-50 mx-auto" />
                    <button onClick={() => moveLink(index, 'down')} disabled={index === data.links.length - 1} className="hover:text-blue-500 disabled:opacity-30">▼</button>
                  </div>
                     
                  <div className="w-full space-y-3">
                    <div>
                      <input 
                        type="text" 
                        value={link.title}
                        onChange={(e) => updateLink(link.id, 'title', e.target.value)}
                        placeholder="Título do Link"
                        className="w-full text-center bg-gray-900/60 border-transparent rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                      />
                    </div>
                    <div>
                      <input 
                        type="text" 
                        value={link.description || ''}
                        onChange={(e) => updateLink(link.id, 'description', e.target.value)}
                        placeholder="Descrição (opcional)"
                        className="w-full text-center bg-gray-900/60 border-transparent rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <input 
                        type="url" 
                        value={link.url}
                        onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                        placeholder="URL (https://...)"
                        className="w-full text-center bg-gray-900/60 border-transparent rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="flex gap-2 justify-center relative">
                      <label className="absolute left-0 cursor-pointer w-11 h-11 bg-gray-900/60 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors border border-transparent" title="Anexar Imagem">
                        <ImageIcon className="w-5 h-5 text-gray-500" />
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
                        className="w-full text-center pl-12 pr-12 bg-gray-900/60 border-transparent rounded-xl py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    {link.thumbnailUrl && (
                      <div className="pt-2 flex flex-col items-center">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 px-1 text-center">Posição da Foto</label>
                        <div className="flex justify-center gap-1 bg-gray-900/60 p-1 rounded-2xl w-full max-w-[280px]">
                          <button 
                            type="button"
                            onClick={() => updateLink(link.id, 'thumbnailPosition', 'left')}
                            className={`flex-1 py-1.5 px-3 text-xs rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 ${
                              (!link.thumbnailPosition || link.thumbnailPosition === 'left') 
                                ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                          >
                            <span>Esquerda</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => updateLink(link.id, 'thumbnailPosition', 'right')}
                            className={`flex-1 py-1.5 px-3 text-xs rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 ${
                              link.thumbnailPosition === 'right' 
                                ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                          >
                            <span>Direita</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="pt-2 flex flex-col items-center">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 px-1 text-center">Animação em Destaque</label>
                      <div className="flex flex-wrap justify-center gap-1 bg-gray-900/60 p-1 rounded-2xl w-full">
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'none')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${!link.animation || link.animation === 'none' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                        >Nenhuma</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'pulse')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'pulse' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                        >Pulsar</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'bounce')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'bounce' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                        >Saltar</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'shake')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'shake' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                        >Tremer</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'glow')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'glow' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                        >Brilho</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center pt-4 px-1 relative">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${link.isVisible ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          <div className={`w-4 h-4 bg-gray-800 rounded-full shadow-sm transition-transform ${link.isVisible ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={link.isVisible}
                          onChange={(e) => updateLink(link.id, 'isVisible', e.target.checked)}
                          className="hidden"
                        />
                        <span className="text-sm font-semibold text-gray-600">Visível</span>
                      </label>
                      
                      <button 
                        onClick={() => removeLink(link.id)}
                        className="absolute right-0 text-red-400 hover:bg-red-500/10 p-2 rounded-full transition-colors"
                        title="Remover link"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Personalizar cores deste link individual */}
                    <div className="pt-3 border-t border-gray-700/50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                      <span className="font-semibold text-xs text-gray-600">Cores deste link:</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5" title="Cor do texto deste link">
                          <span className="text-xs text-gray-500">Texto</span>
                          <ColorPicker 
                            color={link.textColor || data.theme.buttonTextColor || '#000000'}
                            onChange={(color) => updateLink(link.id, 'textColor', color)}
                            title="Cor do Texto"
                            className="w-8 h-8"
                          />
                        </div>
                        <div className="flex items-center gap-1.5" title="Cor do fundo deste link">
                          <span className="text-xs text-gray-500">Fundo</span>
                          <ColorPicker 
                            color={link.buttonColor || data.theme.buttonColor || '#ffffff'}
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
                            className="text-xs text-blue-400 font-semibold hover:underline ml-1"
                            title="Restaurar cores padrão"
                          >
                            Resetar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {data.links.length === 0 && (
                <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-3xl border border-dashed border-gray-700">
                  <span className="font-medium">Nenhum link adicionado ainda.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6 pb-8">
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-white block">Foto de Perfil</label>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div 
                    onClick={() => avatarFileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    title="Clique ou toque para escolher uma foto"
                    className={`relative w-24 h-24 bg-gray-900/60 border-2 border-dashed border-gray-600 hover:border-blue-500 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer transition-all shadow-sm group ${
                      data.theme.avatarShape === 'round' ? 'rounded-full' : 
                      data.theme.avatarShape === 'rounded' ? 'rounded-2xl' : 'rounded-none'
                    }`}
                  >
                    {data.profile.avatarUrl ? (
                      <img src={data.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-gray-500" />
                    )}
                    
                    {/* Badge de câmera ou spinner de carregamento */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity opacity-70 group-hover:opacity-100">
                      {uploadingState['avatarUrl'] ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white drop-shadow-md" />
                      )}
                    </div>

                    <input 
                      ref={avatarFileInputRef}
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => handleFileUpload(e, 'image', 'avatarUrl')}
                      className="hidden" 
                    />
                  </div>

                  <div className="flex-1 w-full space-y-2.5 text-center sm:text-left">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        disabled={uploadingState['avatarUrl']}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-colors active:scale-95 disabled:opacity-50"
                      >
                        {uploadingState['avatarUrl'] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {uploadingState['avatarUrl'] ? 'Processando foto...' : 'Carregar do Aparelho'}
                      </button>

                      {data.profile.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => updateProfile('avatarUrl', '')}
                          className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-gray-900/60 hover:bg-red-500/10 hover:text-red-400 text-gray-500 rounded-xl text-xs sm:text-sm font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      )}
                    </div>

                    <input 
                      type="url" 
                      value={data.profile.avatarUrl}
                      onChange={(e) => updateProfile('avatarUrl', e.target.value)}
                      placeholder="Ou cole a URL da imagem (https://...)"
                      className="w-full bg-gray-900/60 border-transparent rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <p className="text-[11px] text-gray-500 font-medium">Toque na foto ou no botão acima para escolher da sua galeria.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-white block">Formato da Foto</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-900/60 p-1 rounded-2xl">
                  <button 
                    onClick={() => updateTheme('avatarShape', 'round')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.avatarShape === 'round' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Redondo</button>
                  <button 
                    onClick={() => updateTheme('avatarShape', 'rounded')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.avatarShape === 'rounded' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Quadrado<br/>(Bordas)</button>
                  <button 
                    onClick={() => updateTheme('avatarShape', 'square')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.avatarShape === 'square' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Quadrado</button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-white block">Nome do Perfil</label>
                <input 
                  type="text" 
                  value={data.profile.name}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  placeholder="@seu.usuario"
                  className="w-full bg-gray-900/60 border-transparent rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-white block">Biografia</label>
                <textarea 
                  value={data.profile.bio}
                  onChange={(e) => updateProfile('bio', e.target.value)}
                  placeholder="Conte algo sobre você..."
                  rows={4}
                  className="w-full bg-gray-900/60 border-transparent rounded-xl px-4 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:bg-gray-900 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
                />
              </div>

              <div className="space-y-3 pt-1">
                <label className="text-sm font-bold text-white block">Cor do Texto (Nome e Bio)</label>
                <div className="flex flex-wrap items-center gap-3">
                  <ColorPicker 
                    color={data.theme.profileTextColor || '#ffffff'}
                    onChange={(color) => updateTheme('profileTextColor', color)}
                    className="w-10 h-10 flex-shrink-0"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateTheme('profileTextColor', '#ffffff')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        (data.theme.profileTextColor || '#ffffff').toLowerCase() === '#ffffff'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Branco (Recomendado)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTheme('profileTextColor', '#000000')}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        data.theme.profileTextColor?.toLowerCase() === '#000000'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                      }`}
                    >
                      Preto
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'theme' && (
          <div className="space-y-6 pb-8">
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-5 text-center">
              <h3 className="text-lg font-bold text-white mb-2">Fundo</h3>
              
              <div className="space-y-3">
                <CustomSelect 
                  value={data.theme.backgroundType}
                  onChange={(val) => updateTheme('backgroundType', val)}
                  options={BACKGROUND_TYPE_OPTIONS}
                />

                {data.theme.backgroundType === 'color' && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <ColorPicker 
                      color={data.theme.backgroundColor}
                      onChange={(color) => updateTheme('backgroundColor', color)}
                      className="w-12 h-12 flex-shrink-0"
                    />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Cor Sólida</p>
                      <p className="text-xs text-gray-500">Clique no círculo para alterar</p>
                    </div>
                  </div>
                )}

                {(data.theme.backgroundType === 'gradient' || data.theme.backgroundType === 'animated-gradient') && (
                  <div className="pt-4 space-y-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Cores do Gradiente</label>
                    
                    <div className="flex items-center justify-center gap-8">
                      <div className="flex flex-col items-center gap-2">
                        <ColorPicker 
                          color={(data.theme.backgroundGradient.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g) || ['#ff9a9e'])[0]}
                          onChange={(color) => {
                            const match = data.theme.backgroundGradient.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g);
                            const c2 = match && match.length > 1 ? match[1] : '#fecfef';
                            updateTheme('backgroundGradient', `linear-gradient(135deg, ${color} 0%, ${c2} 100%)`);
                          }}
                          className="w-10 h-10 flex-shrink-0"
                        />
                        <span className="text-xs text-gray-500 font-medium">Cor 1</span>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <ColorPicker 
                          color={(data.theme.backgroundGradient.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g) || ['#ff9a9e', '#fecfef'])[1] || '#fecfef'}
                          onChange={(color) => {
                            const match = data.theme.backgroundGradient.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g);
                            const c1 = match ? match[0] : '#ff9a9e';
                            updateTheme('backgroundGradient', `linear-gradient(135deg, ${c1} 0%, ${color} 100%)`);
                          }}
                          className="w-10 h-10 flex-shrink-0"
                        />
                        <span className="text-xs text-gray-500 font-medium">Cor 2</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                       <button onClick={() => updateTheme('backgroundGradient', 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)')} className="flex-1 py-2 text-xs bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-xl font-bold transition-colors">Rosa</button>
                       <button onClick={() => updateTheme('backgroundGradient', 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)')} className="flex-1 py-2 text-xs bg-blue-900/30 hover:bg-blue-200 text-blue-800 rounded-xl font-bold transition-colors">Azul</button>
                       <button onClick={() => updateTheme('backgroundGradient', 'linear-gradient(135deg, #434343 0%, #000000 100%)')} className="flex-1 py-2 text-xs bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold transition-colors">Dark</button>
                    </div>
                  </div>
                )}

                {data.theme.backgroundType === 'image' && (
                  <div className="pt-2">
                    <div className="flex items-center justify-center gap-3">
                       <button 
                         type="button"
                         onClick={() => bgImageInputRef.current?.click()}
                         className="w-12 h-12 bg-gray-900/60 hover:bg-gray-700 cursor-pointer rounded-full flex items-center justify-center text-gray-500 transition-colors shadow-sm"
                         title="Carregar imagem do dispositivo"
                       >
                         {uploadingState['backgroundImageUrl'] ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                       </button>
                       <input 
                         ref={bgImageInputRef}
                         type="file" 
                         accept="image/*" 
                         onChange={(e) => handleFileUpload(e, 'image', 'backgroundImageUrl')} 
                         className="hidden" 
                       />
                       <input 
                          type="url" 
                          value={data.theme.backgroundImageUrl}
                          onChange={(e) => updateTheme('backgroundImageUrl', e.target.value)}
                          placeholder="Cole a URL ou carregue uma imagem..."
                          className="flex-1 text-center bg-gray-900/60 border-transparent rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                       />
                    </div>
                  </div>
                )}

                {data.theme.backgroundType === 'video' && (
                  <div className="pt-2">
                    <div className="flex items-center gap-3">
                       <button 
                         type="button"
                         onClick={() => bgVideoInputRef.current?.click()}
                         className="w-12 h-12 bg-gray-900/60 hover:bg-gray-700 cursor-pointer rounded-full flex items-center justify-center text-gray-500 transition-colors shadow-sm" 
                         title="Upload Vídeo/GIF (Max 5MB)"
                       >
                         {uploadingState['backgroundVideoUrl'] ? (
                           <div className="flex flex-col items-center">
                             <Loader2 className="w-4 h-4 animate-spin" />
                             {uploadProgress['backgroundVideoUrl'] > 0 && <span className="text-[10px] leading-tight font-medium mt-0.5">{uploadProgress['backgroundVideoUrl']}%</span>}
                           </div>
                         ) : <Upload className="w-5 h-5" />}
                       </button>
                       <input 
                         ref={bgVideoInputRef}
                         type="file" 
                         accept="video/*,image/gif" 
                         onChange={(e) => handleFileUpload(e, 'video', 'backgroundVideoUrl')} 
                         className="hidden" 
                       />
                       <input 
                          type="url" 
                          value={data.theme.backgroundVideoUrl}
                          onChange={(e) => updateTheme('backgroundVideoUrl', e.target.value)}
                          placeholder="URL do Vídeo (Max 5MB)"
                          className="flex-1 bg-gray-900/60 border-transparent rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                       />
                    </div>
                  </div>
                )}

                {(data.theme.backgroundType === 'image' || data.theme.backgroundType === 'video') && (
                  <div className="pt-4 border-t border-gray-700/50 space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-200">
                          Posição no {currentMode === 'mobile' ? 'Celular (Mobile)' : 'Computador (Desktop)'}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-900/60 px-2 py-0.5 rounded-full font-semibold">
                          {currentPos.x}% • {currentPos.y}%
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsRepositioning?.(!isRepositioning)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                          isRepositioning 
                            ? 'bg-amber-500 text-white shadow-amber-500/25 ring-2 ring-amber-400/40' 
                            : 'bg-blue-500/10 text-blue-400 hover:bg-blue-900/30'
                        }`}
                      >
                        <Move className="w-3.5 h-3.5" />
                        {isRepositioning ? 'Concluir Ajuste' : 'Arrastar no Preview'}
                      </button>
                    </div>

                    {/* Presets Rápidos */}
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider block">
                        Alinhamento Rápido
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateBackgroundPosition({ x: 50, y: 0 })}
                          className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            currentPos.x === 50 && currentPos.y === 0 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-gray-900/40 text-gray-600 border-gray-700 hover:bg-gray-900/60'
                          }`}
                        >
                          Topo
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBackgroundPosition({ x: 50, y: 50 })}
                          className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            currentPos.x === 50 && currentPos.y === 50 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-gray-900/40 text-gray-600 border-gray-700 hover:bg-gray-900/60'
                          }`}
                        >
                          Centro
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBackgroundPosition({ x: 50, y: 100 })}
                          className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            currentPos.x === 50 && currentPos.y === 100 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-gray-900/40 text-gray-600 border-gray-700 hover:bg-gray-900/60'
                          }`}
                        >
                          Base
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBackgroundPosition({ x: 0, y: 50 })}
                          className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            currentPos.x === 0 && currentPos.y === 50 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-gray-900/40 text-gray-600 border-gray-700 hover:bg-gray-900/60'
                          }`}
                        >
                          Esquerda
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBackgroundPosition({ x: 100, y: 50 })}
                          className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                            currentPos.x === 100 && currentPos.y === 50 
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                              : 'bg-gray-900/40 text-gray-600 border-gray-700 hover:bg-gray-900/60'
                          }`}
                        >
                          Direita
                        </button>
                      </div>
                    </div>

                    {/* Sliders X e Y */}
                    <div className="space-y-3 bg-gray-900/60 p-3.5 rounded-2xl border border-gray-700/50">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-gray-400 font-medium">
                          <span>Posição Horizontal (X)</span>
                          <span className="font-mono font-bold text-white">{currentPos.x}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={currentPos.x}
                          onChange={(e) => updateBackgroundPosition({ ...currentPos, x: Number(e.target.value) })}
                          className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-700 rounded-lg appearance-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-gray-400 font-medium">
                          <span>Posição Vertical (Y)</span>
                          <span className="font-mono font-bold text-white">{currentPos.y}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          value={currentPos.y}
                          onChange={(e) => updateBackgroundPosition({ ...currentPos, y: Number(e.target.value) })}
                          className="w-full accent-blue-600 cursor-pointer h-2 bg-gray-700 rounded-lg appearance-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-5 text-center">
              <h3 className="text-lg font-bold text-white mb-2">Cartões (Links)</h3>
              <div className="space-y-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Layout</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-900/60 p-1 rounded-2xl">
                  <button 
                    onClick={() => updateTheme('linkFormat', 'classic')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'classic' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Clássico</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'featured')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'featured' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Destaque</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'compact')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'compact' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Compacto</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'minimal')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'minimal' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Minimalista</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'banner')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'banner' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Banner</button>
                </div>

                <div className="pt-2 space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Posição da Foto nos Links</label>
                  <div className="flex justify-center gap-1 bg-gray-900/60 p-1 rounded-2xl max-w-xs mx-auto">
                    <button 
                      onClick={() => updateTheme('linkThumbnailPosition', 'left')}
                      className={`flex-1 py-2 px-3 text-sm rounded-xl font-semibold transition-all ${(!data.theme.linkThumbnailPosition || data.theme.linkThumbnailPosition === 'left') ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                    >Lado Esquerdo</button>
                    <button 
                      onClick={() => updateTheme('linkThumbnailPosition', 'right')}
                      className={`flex-1 py-2 px-3 text-sm rounded-xl font-semibold transition-all ${data.theme.linkThumbnailPosition === 'right' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                    >Lado Direito</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-5 text-center">
              <h3 className="text-lg font-bold text-white mb-2">Estilo dos Botões</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 bg-gray-900/60 p-1 rounded-2xl">
                  <button 
                    onClick={() => updateTheme('buttonStyle', 'solid')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.buttonStyle === 'solid' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Sólido</button>
                  <button 
                    onClick={() => updateTheme('buttonStyle', 'outline')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.buttonStyle === 'outline' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Contorno</button>
                  <button 
                    onClick={() => updateTheme('buttonStyle', 'glass')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.buttonStyle === 'glass' ? 'bg-gray-700 text-blue-400 shadow-md border border-gray-600' : 'text-gray-500 hover:text-white'}`}
                  >Vidro</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Fundo dos Botões</label>
                    <div className="flex flex-col items-center gap-2">
                      <ColorPicker 
                        color={data.theme.buttonColor || '#ffffff'}
                        onChange={(color) => updateTheme('buttonColor', color)}
                        className="w-10 h-10 flex-shrink-0"
                      />
                      <div className="flex flex-wrap justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateTheme('buttonColor', '#ffffff')}
                          className="px-2 py-1 text-[11px] font-semibold bg-gray-900/60 hover:bg-gray-700 rounded-lg text-gray-600"
                        >
                          Branco
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTheme('buttonColor', '#18181b')}
                          className="px-2 py-1 text-[11px] font-semibold bg-gray-900/60 hover:bg-gray-700 rounded-lg text-gray-600"
                        >
                          Escuro
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTheme('buttonColor', '#f3f4f6')}
                          className="px-2 py-1 text-[11px] font-semibold bg-gray-900/60 hover:bg-gray-700 rounded-lg text-gray-600"
                        >
                          Cinza
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Texto dos Botões</label>
                    <div className="flex flex-col items-center gap-2">
                      <ColorPicker 
                        color={data.theme.buttonTextColor || '#000000'}
                        onChange={(color) => updateTheme('buttonTextColor', color)}
                        className="w-10 h-10 flex-shrink-0"
                      />
                      <div className="flex flex-wrap justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateTheme('buttonTextColor', '#000000')}
                          className="px-2 py-1 text-[11px] font-semibold bg-gray-900/60 hover:bg-gray-700 rounded-lg text-gray-600"
                        >
                          Preto
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTheme('buttonTextColor', '#ffffff')}
                          className="px-2 py-1 text-[11px] font-semibold bg-gray-900/60 hover:bg-gray-700 rounded-lg text-gray-600"
                        >
                          Branco
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTheme('buttonTextColor', '#1f2937')}
                          className="px-2 py-1 text-[11px] font-semibold bg-gray-900/60 hover:bg-gray-700 rounded-lg text-gray-600"
                        >
                          Grafite
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-700/50">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Cor do Nome e Bio</label>
                  <div className="flex items-center justify-center gap-3">
                    <ColorPicker 
                      color={data.theme.profileTextColor || '#ffffff'}
                      onChange={(color) => updateTheme('profileTextColor', color)}
                      className="w-10 h-10 flex-shrink-0"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateTheme('profileTextColor', '#ffffff')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          (data.theme.profileTextColor || '#ffffff').toLowerCase() === '#ffffff'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                        }`}
                      >
                        Branco
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTheme('profileTextColor', '#000000')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          data.theme.profileTextColor?.toLowerCase() === '#000000'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-gray-900/60 text-gray-600 border-transparent hover:bg-gray-700'
                        }`}
                      >
                        Preto
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 text-left">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Arredondamento</label>
                  <CustomSelect 
                    value={data.theme.buttonRadius}
                    onChange={(val) => updateTheme('buttonRadius', val)}
                    options={BUTTON_RADIUS_OPTIONS}
                    direction="up"
                  />
                </div>

                <div className="pt-2 flex justify-center">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${data.theme.buttonShadow ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-gray-800 rounded-full shadow-sm transition-transform ${data.theme.buttonShadow ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={data.theme.buttonShadow}
                      onChange={(e) => updateTheme('buttonShadow', e.target.checked)}
                      className="hidden"
                    />
                    <span className="text-sm font-semibold text-gray-600">Sombra nos botões</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-4 text-center">
               <h3 className="text-lg font-bold text-white mb-2">Tipografia</h3>
               <div className="text-left">
                 <CustomSelect 
                    value={data.theme.fontFamily}
                    onChange={(val) => updateTheme('fontFamily', val)}
                    options={FONT_FAMILY_OPTIONS}
                    direction="up"
                 />
               </div>
            </div>
          </div>
        )}

        {activeTab === 'ad' && (
          <div className="space-y-6 pb-8">
            {/* Input oculto para upload de imagem do anúncio */}
            <input 
              type="file" 
              ref={adImageInputRef} 
              onChange={handleAdImageUpload} 
              accept="image/*" 
              className="hidden" 
            />

            {/* Cabeçalho do Anúncio */}
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 text-center space-y-3">
              <div className="w-12 h-12 bg-gradient-to-tr from-[#ee4d2d] to-[#ff7a45] text-white rounded-full flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">Propaganda & Indicação Shopee</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                Cartão centralizado de anúncio com cronômetro de 5 segundos. Ideal para links de afiliados da Shopee. Atualiza em tempo real para todos os usuários!
              </p>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={triggerAdPreview}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500/10 hover:bg-orange-100 text-[#ee4d2d] font-bold text-xs rounded-full border border-orange-500/20 transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Testar Exibição no Preview (Abrir Pop-up)</span>
                </button>
              </div>
            </div>

            {/* Status de Ativação */}
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white">Status do Anúncio</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(data.ad?.enabled ?? defaultAd.enabled)
                      ? 'O anúncio está ativado e sendo exibido aos visitantes.'
                      : 'O anúncio está pausado e não será exibido.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={data.ad?.enabled ?? defaultAd.enabled} 
                    onChange={(e) => updateAd('enabled', e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ee4d2d]"></div>
                </label>
              </div>

              <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-medium ${(data.ad?.enabled ?? defaultAd.enabled) ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-100' : 'bg-gray-900/40 text-gray-500 border border-gray-700/50'}`}>
                <div className={`w-2 h-2 rounded-full ${(data.ad?.enabled ?? defaultAd.enabled) ? 'bg-emerald-500/100 animate-pulse' : 'bg-gray-400'}`} />
                <span>{(data.ad?.enabled ?? defaultAd.enabled) ? 'Ativo • Salvo no Firestore e sincronizado para todos os visitantes' : 'Pausado • Não aparecerá no perfil'}</span>
              </div>
            </div>

            {/* Link de Indicação / Afiliado Shopee */}
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#ee4d2d]" />
                  Link de Indicação (Afiliado Shopee)
                </h4>
                {data.ad?.buttonUrl && (
                  <button
                    type="button"
                    onClick={() => window.open(data.ad?.buttonUrl, '_blank', 'noopener,noreferrer')}
                    className="text-xs font-semibold text-[#ee4d2d] hover:underline flex items-center gap-1"
                  >
                    <span>Testar Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <input
                  type="url"
                  value={data.ad?.buttonUrl ?? defaultAd.buttonUrl}
                  onChange={(e) => updateAd('buttonUrl', e.target.value)}
                  placeholder="https://s.shopee.com.br/... ou https://shopee.com.br/..."
                  className="w-full px-4 py-3 bg-gray-900/40 border border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all font-mono text-xs"
                />
                <p className="text-[11px] text-gray-500">
                  Cole seu link de afiliado gerado na Shopee. Quando o visitante clicar no botão do anúncio, você ganhará a comissão de indicação.
                </p>
              </div>
            </div>

            {/* Imagem do Produto / Banner */}
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-4">
              <h4 className="font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                Foto do Produto / Banner
              </h4>

              {data.ad?.imageUrl ? (
                <div className="space-y-3">
                  <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-gray-700 bg-gray-900/40 group">
                    <img
                      src={data.ad.imageUrl}
                      alt="Banner do Anúncio"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => updateAd('imageUrl', '')}
                      className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
                      title="Remover Imagem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => adImageInputRef.current?.click()}
                      disabled={uploadingState['adImage']}
                      className="flex-1 py-2.5 px-3 bg-gray-900/60 hover:bg-gray-700 text-gray-600 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {uploadingState['adImage'] ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                          <span>Processando...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Trocar Foto</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAd('imageUrl', '')}
                      className="py-2.5 px-3 text-red-400 hover:bg-red-500/10 rounded-2xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div 
                    onClick={() => adImageInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-700 hover:border-orange-400 bg-gray-900/40 hover:bg-orange-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-10 h-10 bg-orange-100 text-[#ee4d2d] rounded-full flex items-center justify-center">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-200">Clique para enviar foto do produto</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">JPG, PNG ou WebP direto do seu aparelho</p>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-gray-700"></div>
                    <span className="flex-shrink mx-3 text-gray-500 text-[11px]">ou cole uma URL de imagem</span>
                    <div className="flex-grow border-t border-gray-700"></div>
                  </div>

                  <input
                    type="url"
                    value={data.ad?.imageUrl ?? ''}
                    onChange={(e) => updateAd('imageUrl', e.target.value)}
                    placeholder="https://exemplo.com/foto-do-produto.jpg"
                    className="w-full px-4 py-2.5 bg-gray-900/40 border border-gray-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all font-mono"
                  />
                </div>
              )}
            </div>

            {/* Conteúdo & Textos */}
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-4">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" />
                Textos & Detalhes da Oferta
              </h4>

              <div className="space-y-3">
                {/* Título */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">Título do Anúncio</label>
                  <input
                    type="text"
                    value={data.ad?.title ?? defaultAd.title}
                    onChange={(e) => updateAd('title', e.target.value)}
                    placeholder="ex: Achadinho Imperdível na Shopee!"
                    className="w-full px-4 py-2.5 bg-gray-900/40 border border-gray-700 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all font-semibold"
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 block">Descrição Promocional</label>
                  <textarea
                    rows={2}
                    value={data.ad?.description ?? defaultAd.description}
                    onChange={(e) => updateAd('description', e.target.value)}
                    placeholder="ex: Aproveite frete grátis e cupom de desconto exclusivo por tempo limitado!"
                    className="w-full px-4 py-2.5 bg-gray-900/40 border border-gray-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all resize-none"
                  />
                </div>

                {/* Preços */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">Preço com Desconto</label>
                    <input
                      type="text"
                      value={data.ad?.price ?? defaultAd.price ?? ''}
                      onChange={(e) => updateAd('price', e.target.value)}
                      placeholder="ex: R$ 39,90"
                      className="w-full px-4 py-2.5 bg-gray-900/40 border border-gray-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all font-bold text-[#ee4d2d]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 block">Preço Original (Riscado)</label>
                    <input
                      type="text"
                      value={data.ad?.originalPrice ?? defaultAd.originalPrice ?? ''}
                      onChange={(e) => updateAd('originalPrice', e.target.value)}
                      placeholder="ex: R$ 89,90"
                      className="w-full px-4 py-2.5 bg-gray-900/40 border border-gray-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all text-gray-500 line-through"
                    />
                  </div>
                </div>

                {/* Texto do Botão */}
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-semibold text-gray-600 block">Texto do Botão de Ação</label>
                  <input
                    type="text"
                    value={data.ad?.buttonText ?? defaultAd.buttonText}
                    onChange={(e) => updateAd('buttonText', e.target.value)}
                    placeholder="ex: Aproveitar Oferta na Shopee"
                    className="w-full px-4 py-2.5 bg-gray-900/40 border border-gray-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all font-semibold"
                  />
                </div>

                {/* Selo / Badge */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-gray-600 block">Selo / Tag em Destaque</label>
                  <input
                    type="text"
                    value={data.ad?.badgeText ?? defaultAd.badgeText ?? ''}
                    onChange={(e) => updateAd('badgeText', e.target.value)}
                    placeholder="ex: Achadinho Shopee 🔥"
                    className="w-full px-4 py-2.5 bg-gray-900/40 border border-gray-700 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ee4d2d] focus:bg-gray-800 transition-all font-medium"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['Achadinho Shopee 🔥', 'Oferta Relâmpago ⚡', 'Recomendado ⭐', 'Super Cupom 🎟️'].map((badge) => (
                      <button
                        key={badge}
                        type="button"
                        onClick={() => updateAd('badgeText', badge)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${data.ad?.badgeText === badge ? 'bg-orange-600 text-white border-orange-600 font-bold' : 'bg-gray-900/40 hover:bg-gray-900/60 text-gray-500 border-gray-700'}`}
                      >
                        {badge}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Regras de Exibição & Tempo */}
            <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-5">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Timer className="w-4 h-4 text-emerald-400" />
                Tempo & Frequência de Exibição
              </h4>

              {/* Tempo do Cronômetro */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 block">
                  Tempo antes de liberar o botão fechar
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 8, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateAd('timerSeconds', sec)}
                      className={`py-2 px-1 rounded-2xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        (data.ad?.timerSeconds ?? defaultAd.timerSeconds) === sec
                          ? 'bg-[#ee4d2d] text-white border-[#ee4d2d] shadow-sm'
                          : 'bg-gray-900/40 hover:bg-gray-900/60 text-gray-600 border-gray-700'
                      }`}
                    >
                      {sec} segundos
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500">
                  O usuário é obrigado a visualizar o anúncio por {(data.ad?.timerSeconds ?? defaultAd.timerSeconds)} segundos antes de poder fechar.
                </p>
              </div>

              {/* Frequência */}
              <div className="space-y-2 pt-2 border-t border-gray-700/50">
                <label className="text-xs font-semibold text-gray-600 block">
                  Frequência de reexibição para o mesmo visitante
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 3, 6, 24].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => updateAd('frequencyHours', hrs)}
                      className={`py-2 px-1 rounded-2xl text-xs font-bold border transition-all text-center cursor-pointer ${
                        (data.ad?.frequencyHours ?? defaultAd.frequencyHours) === hrs
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-gray-900/40 hover:bg-gray-900/60 text-gray-600 border-gray-700'
                      }`}
                    >
                      {hrs === 1 ? '1 hora' : hrs === 24 ? '1 dia' : `${hrs} horas`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-500">
                  Após fechar ou clicar no anúncio, o pop-up só aparecerá novamente para essa mesma pessoa após {(data.ad?.frequencyHours ?? defaultAd.frequencyHours)} horas.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-6 pb-8">
            {loadingMetrics ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                 <Loader2 className="w-8 h-8 animate-spin mb-4" />
                 <p className="font-medium">Carregando métricas...</p>
              </div>
            ) : (
              <>
              <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-4 text-center">
                <div className="w-12 h-12 bg-blue-900/30 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">Métricas dos Links</h3>
                <p className="text-sm text-gray-500">
                  Acompanhe o engajamento e descubra quais são os links mais clicados do seu perfil.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-700/50 flex flex-col items-center justify-center text-center gap-2">
                  <Eye className="w-6 h-6 text-purple-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Visualizações</span>
                  <span className="text-2xl font-bold text-white leading-tight">{metrics.views}</span>
                </div>
                <div className="bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-700/50 flex flex-col items-center justify-center text-center gap-2">
                  <MousePointerClick className="w-6 h-6 text-blue-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Total de Cliques</span>
                  <span className="text-2xl font-bold text-white leading-tight">{metrics.clicks}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-700/50 flex flex-col items-center justify-center text-center gap-2">
                  <Clock className="w-6 h-6 text-orange-400 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Horário de Pico</span>
                  <span className="text-lg font-bold text-white leading-tight">{metrics.bestHour}</span>
                </div>
                <div className="bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-700/50 flex flex-col items-center justify-center text-center gap-2">
                  <Calendar className="w-6 h-6 text-green-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Melhor Dia</span>
                  <span className="text-lg font-bold text-white leading-tight">{metrics.bestDay}</span>
                </div>
              </div>

              <div className="bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-700/50 space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MousePointerClick className="w-5 h-5 text-gray-500" /> Cliques por Link
                </h3>
              
              <div className="space-y-5">
                {data.links.filter(l => l.isVisible).sort((a, b) => (metrics.clicksByLink[b.id] || 0) - (metrics.clicksByLink[a.id] || 0)).map((link, idx) => {
                  const maxClicks = Math.max(...data.links.map(l => metrics.clicksByLink[l.id] || 0), 1);
                  const linkClicks = metrics.clicksByLink[link.id] || 0;
                  const percentage = Math.round((linkClicks / maxClicks) * 100);
                  
                  return (
                    <div key={link.id} className="space-y-2">
                      <div className="flex justify-between items-end text-sm">
                        <span className="font-semibold text-gray-200 line-clamp-1 flex-1 pr-4">
                          {idx + 1}. {link.title}
                        </span>
                        <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg flex-shrink-0">
                          {linkClicks} cliques
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gray-900/60 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500/100 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}

                {data.links.filter(l => l.isVisible).length === 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    Adicione links visíveis para ver as métricas.
                  </div>
                )}
              </div>
            </div>
            </>
          )}
          </div>
        )}
      </div>
    </div>
  );
};
