import React, { useState, useEffect, useRef } from 'react';
import { AppData, LinkItem, Theme } from '../types';
import { GripVertical, Plus, Trash2, Image as ImageIcon, Video, Palette, Link as LinkIcon, User, Camera, BarChart3, MousePointerClick, Clock, Calendar, Eye, Loader2, Upload } from 'lucide-react';
import { ColorPicker } from './ColorPicker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, getCountFromServer, getDocs, query, orderBy, limit, setDoc, doc } from 'firebase/firestore';
import imageCompression from 'browser-image-compression';
import { db, storage, isFirebaseConfigured } from '../lib/firebase';

interface EditorProps {
  data: AppData;
  onChange: (data: AppData) => void;
}

export const Editor: React.FC<EditorProps> = ({ data, onChange }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'links' | 'theme' | 'stats'>('links');
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [metrics, setMetrics] = useState({ views: 0, clicks: 0, clicksByLink: {} as Record<string, number>, bestDay: '--', bestHour: '--' });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const bgVideoInputRef = useRef<HTMLInputElement>(null);

  // Helper nativo e ultrarrápido para comprimir imagem no dispositivo sem depender de web workers
  const compressImageToDataUrl = (file: File, maxDimension = 600, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
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
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve((readerEvent.target?.result as string) || '');
          }
        };
        img.onerror = () => resolve((readerEvent.target?.result as string) || '');
        img.src = (readerEvent.target?.result as string) || '';
      };
      reader.onerror = () => resolve('');
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

  const addLink = () => {
    const newLink: LinkItem = {
      id: Date.now().toString(),
      title: 'Novo Link',
      url: 'https://',
      thumbnailUrl: '',
      isVisible: true,
    };
    onChange({ ...data, links: [...data.links, newLink] });
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
        if (!file.type.startsWith('image/')) {
          alert("Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP, GIF).");
          setUploadingState(prev => ({ ...prev, [uploadKey]: false }));
          e.target.value = '';
          return;
        }

        // Comprime a imagem de forma instantânea e compatível com todos os navegadores móveis
        const maxDimension = targetField === 'avatarUrl' ? 400 : targetField === 'linkThumb' ? 300 : 1200;
        const compressedDataUrl = await compressImageToDataUrl(file, maxDimension, 0.82);
        const resolvedUrl = compressedDataUrl || URL.createObjectURL(file);

        // Aplica imediatamente para a interface responder em tempo real sem travar o usuário
        if (targetField === 'avatarUrl') {
          updateProfile('avatarUrl', resolvedUrl);
        } else if (targetField === 'linkThumb' && linkId) {
          updateLink(linkId, 'thumbnailUrl', resolvedUrl);
        } else {
          updateTheme(targetField as keyof Theme, resolvedUrl);
        }

        // Opcionalmente tenta enviar ao Firebase Storage se estiver configurado
        if (isFirebaseConfigured) {
          try {
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, file);
            const remoteUrl = await getDownloadURL(storageRef);
            if (remoteUrl) {
              if (targetField === 'avatarUrl') updateProfile('avatarUrl', remoteUrl);
              else if (targetField === 'linkThumb' && linkId) updateLink(linkId, 'thumbnailUrl', remoteUrl);
              else updateTheme(targetField as keyof Theme, remoteUrl);
            }
          } catch (storageErr) {
            console.warn("Storage upload não configurado ou restrito, mantendo versão comprimida local:", storageErr);
          }
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
        <div className="flex bg-gray-200/60 p-1 rounded-full gap-1">
          <button
            onClick={() => setActiveTab('links')}
            className={`flex-1 py-2 px-1 rounded-full flex items-center justify-center gap-1 font-semibold text-xs transition-all ${activeTab === 'links' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Links
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2 px-1 rounded-full flex items-center justify-center gap-1 font-semibold text-xs transition-all ${activeTab === 'profile' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Perfil
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`flex-1 py-2 px-1 rounded-full flex items-center justify-center gap-1 font-semibold text-xs transition-all ${activeTab === 'theme' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Tema
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-2 px-1 rounded-full flex items-center justify-center gap-1 font-semibold text-xs transition-all ${activeTab === 'stats' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Métricas
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 text-gray-900 no-scrollbar">
        {activeTab === 'links' && (
          <div className="space-y-4 flex flex-col pb-8">
            <button 
              onClick={addLink}
              className="w-full py-3.5 bg-blue-600 text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" /> Adicionar Link
            </button>
            
            <div className="space-y-4 mt-6">
              {data.links.map((link, index) => (
                <div key={link.id} className="bg-white rounded-3xl py-5 px-10 sm:px-12 shadow-sm border border-gray-100 relative transition-all flex justify-center">
                  <div className="absolute left-1 sm:left-4 top-0 bottom-0 flex flex-col items-center justify-center gap-2 text-gray-300 w-8">
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
                        className="w-full text-center bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200/70 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all"
                      />
                    </div>
                    <div>
                      <input 
                        type="text" 
                        value={link.description || ''}
                        onChange={(e) => updateLink(link.id, 'description', e.target.value)}
                        placeholder="Descrição (opcional)"
                        className="w-full text-center bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200/70 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <input 
                        type="url" 
                        value={link.url}
                        onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                        placeholder="URL (https://...)"
                        className="w-full text-center bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200/70 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="flex gap-2 justify-center relative">
                      <label className="absolute left-0 cursor-pointer w-11 h-11 bg-gray-100 hover:bg-gray-200 rounded-xl flex items-center justify-center transition-colors border border-transparent" title="Anexar Imagem">
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
                        className="w-full text-center pl-12 pr-12 bg-gray-100 border-transparent rounded-xl py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200/70 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div className="pt-2 flex flex-col items-center">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 px-1 text-center">Animação em Destaque</label>
                      <div className="flex flex-wrap justify-center gap-1 bg-gray-100 p-1 rounded-2xl w-full">
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'none')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${!link.animation || link.animation === 'none' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >Nenhuma</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'pulse')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'pulse' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >Pulsar</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'bounce')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'bounce' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >Saltar</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'shake')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'shake' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >Tremer</button>
                        <button 
                          onClick={() => updateLink(link.id, 'animation', 'glow')}
                          className={`flex-1 min-w-[70px] py-1.5 px-2 text-xs rounded-xl font-semibold transition-all ${link.animation === 'glow' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        >Brilho</button>
                      </div>
                    </div>
                    <div className="flex items-center justify-center pt-4 px-1 relative">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${link.isVisible ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${link.isVisible ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={link.isVisible}
                          onChange={(e) => updateLink(link.id, 'isVisible', e.target.checked)}
                          className="hidden"
                        />
                        <span className="text-sm font-semibold text-gray-700">Visível</span>
                      </label>
                      
                      <button 
                        onClick={() => removeLink(link.id)}
                        className="absolute right-0 text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                        title="Remover link"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {data.links.length === 0 && (
                <div className="text-center py-12 text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                  <span className="font-medium">Nenhum link adicionado ainda.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6 pb-8">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
              <div className="space-y-4">
                <label className="text-sm font-bold text-gray-900 block">Foto de Perfil</label>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div 
                    onClick={() => avatarFileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    title="Clique ou toque para escolher uma foto"
                    className={`relative w-24 h-24 bg-gray-100 border-2 border-dashed border-gray-300 hover:border-blue-500 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer transition-all shadow-sm group ${
                      data.theme.avatarShape === 'round' ? 'rounded-full' : 
                      data.theme.avatarShape === 'rounded' ? 'rounded-2xl' : 'rounded-none'
                    }`}
                  >
                    {data.profile.avatarUrl ? (
                      <img src={data.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-gray-400" />
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
                          className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-xl text-xs sm:text-sm font-medium transition-colors"
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
                      className="w-full bg-gray-100 border-transparent rounded-xl px-4 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200/70 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <p className="text-[11px] text-gray-500 font-medium">Toque na foto ou no botão acima para escolher da sua galeria.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-900 block">Formato da Foto</label>
                <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-2xl">
                  <button 
                    onClick={() => updateTheme('avatarShape', 'round')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.avatarShape === 'round' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Redondo</button>
                  <button 
                    onClick={() => updateTheme('avatarShape', 'rounded')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.avatarShape === 'rounded' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Quadrado<br/>(Bordas)</button>
                  <button 
                    onClick={() => updateTheme('avatarShape', 'square')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.avatarShape === 'square' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Quadrado</button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-900 block">Nome do Perfil</label>
                <input 
                  type="text" 
                  value={data.profile.name}
                  onChange={(e) => updateProfile('name', e.target.value)}
                  placeholder="@seu.usuario"
                  className="w-full bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200/70 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-900 block">Biografia</label>
                <textarea 
                  value={data.profile.bio}
                  onChange={(e) => updateProfile('bio', e.target.value)}
                  placeholder="Conte algo sobre você..."
                  rows={4}
                  className="w-full bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-gray-200/70 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'theme' && (
          <div className="space-y-6 pb-8">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Fundo</h3>
              
              <div className="space-y-3">
                <select 
                  value={data.theme.backgroundType}
                  onChange={(e) => updateTheme('backgroundType', e.target.value)}
                  className="w-full text-center bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="color">Cor Sólida</option>
                  <option value="gradient">Gradiente Estático</option>
                  <option value="animated-gradient">Gradiente Animado</option>
                  <option value="image">Imagem (URL)</option>
                  <option value="video">Vídeo (URL)</option>
                </select>

                {data.theme.backgroundType === 'color' && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <ColorPicker 
                      color={data.theme.backgroundColor}
                      onChange={(color) => updateTheme('backgroundColor', color)}
                      className="w-12 h-12 flex-shrink-0"
                    />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">Cor Sólida</p>
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
                       <button onClick={() => updateTheme('backgroundGradient', 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)')} className="flex-1 py-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-xl font-bold transition-colors">Azul</button>
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
                         className="w-12 h-12 bg-gray-100 hover:bg-gray-200 cursor-pointer rounded-full flex items-center justify-center text-gray-600 transition-colors shadow-sm"
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
                          className="flex-1 text-center bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                         className="w-12 h-12 bg-gray-100 hover:bg-gray-200 cursor-pointer rounded-full flex items-center justify-center text-gray-600 transition-colors shadow-sm" 
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
                          className="flex-1 bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                       />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Cartões (Links)</h3>
              <div className="space-y-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Layout</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-gray-100 p-1 rounded-2xl">
                  <button 
                    onClick={() => updateTheme('linkFormat', 'classic')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'classic' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Clássico</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'featured')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'featured' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Destaque</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'compact')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'compact' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Compacto</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'minimal')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'minimal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Minimalista</button>
                  <button 
                    onClick={() => updateTheme('linkFormat', 'banner')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.linkFormat === 'banner' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Banner</button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5 text-center">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Estilo dos Botões</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1 rounded-2xl">
                  <button 
                    onClick={() => updateTheme('buttonStyle', 'solid')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.buttonStyle === 'solid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Sólido</button>
                  <button 
                    onClick={() => updateTheme('buttonStyle', 'outline')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.buttonStyle === 'outline' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Contorno</button>
                  <button 
                    onClick={() => updateTheme('buttonStyle', 'glass')}
                    className={`py-2 px-1 text-sm rounded-xl font-semibold transition-all ${data.theme.buttonStyle === 'glass' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                  >Vidro</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Cor de Fundo</label>
                    <div className="flex items-center justify-center gap-2">
                      <ColorPicker 
                        color={data.theme.buttonColor}
                        onChange={(color) => updateTheme('buttonColor', color)}
                        className="w-10 h-10 flex-shrink-0"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Cor do Texto</label>
                    <div className="flex items-center justify-center gap-2">
                      <ColorPicker 
                        color={data.theme.buttonTextColor}
                        onChange={(color) => updateTheme('buttonTextColor', color)}
                        className="w-10 h-10 flex-shrink-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block text-center">Arredondamento</label>
                  <select 
                    value={data.theme.buttonRadius}
                    onChange={(e) => updateTheme('buttonRadius', e.target.value)}
                    className="w-full text-center bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="none">Reto (Sem borda)</option>
                    <option value="sm">Suave</option>
                    <option value="md">Médio</option>
                    <option value="lg">Grande</option>
                    <option value="xl">Super Redondo</option>
                    <option value="full">Pílula</option>
                    <option value="leaf">Folha (Assimétrico)</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-center">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-10 h-6 rounded-full p-1 transition-colors ${data.theme.buttonShadow ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${data.theme.buttonShadow ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={data.theme.buttonShadow}
                      onChange={(e) => updateTheme('buttonShadow', e.target.checked)}
                      className="hidden"
                    />
                    <span className="text-sm font-semibold text-gray-700">Sombra nos botões</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4 text-center">
               <h3 className="text-lg font-bold text-gray-900 mb-2">Tipografia</h3>
               <select 
                  value={data.theme.fontFamily}
                  onChange={(e) => updateTheme('fontFamily', e.target.value)}
                  className="w-full text-center bg-gray-100 border-transparent rounded-xl px-4 py-3 text-sm text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
               >
                  <option value="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">Sistema (Padrão Samsung/Apple)</option>
                  <option value="Inter, sans-serif">Inter</option>
                  <option value="ui-serif, Georgia, serif">Serifa Clássica</option>
                  <option value="ui-monospace, SFMono-Regular, monospace">Monospace</option>
                  <option value="'Comic Sans MS', cursive, sans-serif">Divertida</option>
               </select>
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
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4 text-center">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Métricas dos Links</h3>
                <p className="text-sm text-gray-500">
                  Acompanhe o engajamento e descubra quais são os links mais clicados do seu perfil.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-2">
                  <Eye className="w-6 h-6 text-purple-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Visualizações</span>
                  <span className="text-2xl font-bold text-gray-900 leading-tight">{metrics.views}</span>
                </div>
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-2">
                  <MousePointerClick className="w-6 h-6 text-blue-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Total de Cliques</span>
                  <span className="text-2xl font-bold text-gray-900 leading-tight">{metrics.clicks}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-2">
                  <Clock className="w-6 h-6 text-orange-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Horário de Pico</span>
                  <span className="text-lg font-bold text-gray-900 leading-tight">{metrics.bestHour}</span>
                </div>
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center gap-2">
                  <Calendar className="w-6 h-6 text-green-500 mb-1" />
                  <span className="text-sm font-semibold text-gray-500">Melhor Dia</span>
                  <span className="text-lg font-bold text-gray-900 leading-tight">{metrics.bestDay}</span>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
                        <span className="font-semibold text-gray-800 line-clamp-1 flex-1 pr-4">
                          {idx + 1}. {link.title}
                        </span>
                        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                          {linkClicks} cliques
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}

                {data.links.filter(l => l.isVisible).length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">
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
