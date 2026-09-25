import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppData, BackgroundPosition } from './types';
import { Preview } from './components/Preview';
import { Smartphone, Monitor, ExternalLink, Loader2, LogOut } from 'lucide-react';
import { Maintenance } from './components/Maintenance';
import { useAuth } from './hooks/useAuth';
// import { useMetrics } from './hooks/useMetrics';
import { useLinkHubData } from './hooks/useLinkHubData';

const LazyEditor = lazy(() => import('./components/Editor').then(m => ({ default: m.Editor })));
const LazyLogin = lazy(() => import('./components/Login').then(m => ({ default: m.Login })));

const MemoizedEditor = React.memo(LazyEditor);
const MemoizedPreview = React.memo(Preview);

function AdminView({ 
  data, 
  setData, 
  onLinkClick,
  adminEmail,
  onLogout,
}: { 
  data: AppData; 
  setData: (d: AppData) => void; 
  onLinkClick: (id: string) => void;
  adminEmail?: string | null;
  onLogout?: () => void;
}) {
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [isRepositioning, setIsRepositioning] = useState(false);

  // Ao clicar em "Testar Pop-up", alterna instantaneamente para o Preview no celular
  useEffect(() => {
    const handleTrigger = () => {
      setShowMobilePreview(true);
    };
    window.addEventListener('linkhub_trigger_ad_preview', handleTrigger);
    return () => window.removeEventListener('linkhub_trigger_ad_preview', handleTrigger);
  }, []);

  const handlePositionChange = (pos: BackgroundPosition) => {
    const field = previewMode === 'mobile' ? 'backgroundPositionMobile' : 'backgroundPositionDesktop';
    setData({
      ...data,
      theme: {
        ...data.theme,
        [field]: pos
      }
    });
  };

  return (
    <div className="flex h-screen w-full bg-gray-950 text-white overflow-hidden font-sans relative">
      {/* Editor Panel (Left) */}
      <div className={`w-full md:w-[450px] lg:w-[500px] h-full flex-shrink-0 flex-col z-10 bg-gray-900/40 border-r border-gray-700 ${showMobilePreview ? 'hidden md:flex' : 'flex'}`}>
        <div className="pt-12 md:pt-16 pb-6 px-6 md:px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">LinkHub</h1>
            {adminEmail && (
              <span className="text-[11px] text-gray-500 font-medium truncate max-w-[170px] sm:max-w-[220px]" title={adminEmail}>
                {adminEmail}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMobilePreview(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-indigo-900/30 text-indigo-300 rounded-full text-xs font-semibold hover:bg-indigo-200 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" /> Ver
            </button>
            <a href={window.location.hostname.includes('localhost') ? '/' : `https://${window.location.hostname.replace('-adm', '')}`} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-900/30 text-blue-300 rounded-full text-xs font-semibold hover:bg-blue-200 transition-colors">
              Público <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sair do painel administrativo"
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-red-500/10 text-gray-300 hover:text-red-400 rounded-full text-xs font-semibold transition-all border border-gray-700 hover:border-red-500/20 cursor-pointer shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex h-full w-full items-center justify-center bg-gray-900/40">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="text-xs text-gray-500 font-medium">Carregando painel do editor...</span>
              </div>
            </div>
          }>
            <MemoizedEditor 
              data={data} 
              onChange={setData} 
              previewMode={previewMode}
              isRepositioning={isRepositioning}
              setIsRepositioning={setIsRepositioning}
            />
          </Suspense>
        </div>
      </div>

      {/* Preview Panel (Right / Mobile Full) */}
      <div className={`${showMobilePreview ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative z-10 bg-black`}>
        {/* Mobile Header (Only visible when mobile preview is active) */}
        {showMobilePreview && (
          <div className="md:hidden h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
            <button 
              onClick={() => setShowMobilePreview(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white bg-gray-900/60 rounded-full hover:bg-gray-700 transition-colors"
            >
              Voltar ao Editor
            </button>
            <a href={window.location.hostname.includes('localhost') ? '/' : `https://${window.location.hostname.replace('-adm', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 text-blue-300 rounded-full text-sm font-semibold hover:bg-blue-200 transition-colors">
              Público <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Top bar for view toggle (Desktop only) */}
        <div className="hidden md:flex h-20 items-center justify-center gap-2 flex-shrink-0 pt-4">
          <div className="flex bg-gray-800 rounded-full p-1 shadow-sm border border-gray-700">
            <button 
              onClick={() => setPreviewMode('mobile')}
              className={`px-6 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all ${previewMode === 'mobile' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
              title="Visualização Mobile"
            >
              <Smartphone className="w-4 h-4" /> Mobile
            </button>
            <button 
              onClick={() => setPreviewMode('desktop')}
              className={`px-6 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all ${previewMode === 'desktop' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}
              title="Visualização Desktop"
            >
              <Monitor className="w-4 h-4" /> Desktop
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-3 sm:p-6 md:p-8 isolate">
          {previewMode === 'mobile' ? (
            /* Flagship Smartphone Mockup (Titanium Edition com Dynamic Island) */
            <div className="relative w-full max-w-[365px] sm:max-w-[385px] h-full max-h-[760px] flex items-center justify-center select-none transition-all duration-500 ease-out">
              {/* Hardware Buttons - Left (Action Button + Volume Rockers) */}
              <div className="absolute -left-[3.5px] top-[115px] w-[3.5px] h-[24px] bg-neutral-600/90 rounded-l-sm shadow-xs pointer-events-none" />
              <div className="absolute -left-[3.5px] top-[152px] w-[3.5px] h-[46px] bg-neutral-600/90 rounded-l-sm shadow-xs pointer-events-none" />
              <div className="absolute -left-[3.5px] top-[208px] w-[3.5px] h-[46px] bg-neutral-600/90 rounded-l-sm shadow-xs pointer-events-none" />

              {/* Hardware Button - Right (Power / Side Button) */}
              <div className="absolute -right-[3.5px] top-[162px] w-[3.5px] h-[72px] bg-neutral-600/90 rounded-r-sm shadow-xs pointer-events-none" />

              {/* Chassi Titânio com Chanfro, Brilho Metálico e Sombra Profunda */}
              <div className="w-full h-full p-[3.5px] rounded-[52px] bg-linear-to-b from-[#52565e] via-[#2f333a] to-[#1a1c20] shadow-[0_25px_60px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_1px_rgba(255,255,255,0.35)] flex flex-col">
                {/* Borda interna OLED ultrafina e display */}
                <div className="w-full h-full p-[7px] bg-black rounded-[48.5px] ring-1 ring-white/10 relative overflow-hidden flex flex-col">
                  {/* Superfície de Vidro da Tela */}
                  <div className="w-full h-full rounded-[41px] overflow-hidden relative isolate bg-black flex flex-col">
                    {/* Dynamic Island Flutuante */}
                    <div className="absolute top-2.5 inset-x-0 flex justify-center z-50 pointer-events-none">
                      <div className="h-[25px] w-[96px] bg-black rounded-full flex items-center justify-between px-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.5)]">
                        {/* Lente da Câmera com micro reflexo óptico */}
                        <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-950/80 ring-1 ring-blue-500/20" />
                        </div>
                        {/* Sensor TrueDepth / Face ID */}
                        <div className="w-2 h-2 rounded-full bg-[#080808]" />
                      </div>
                    </div>

                    {/* Barra de Gestos Inferior (Home Indicator) */}
                    <div className="absolute bottom-2 inset-x-0 flex justify-center z-50 pointer-events-none">
                      <div className="w-32 h-1 rounded-full bg-white/40 backdrop-blur-xs shadow-xs" />
                    </div>

                    {/* Preview Real do LinkHub */}
                    <MemoizedPreview 
                      data={data} 
                      onLinkClick={onLinkClick} 
                      previewMode={previewMode}
                      isRepositioning={isRepositioning}
                      onRepositionEnd={() => setIsRepositioning(false)}
                      onPositionChange={handlePositionChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Mockup de Alta Resolução */
            <div className="w-full h-full max-w-5xl rounded-3xl border border-gray-700 bg-gray-900 shadow-2xl relative overflow-hidden flex flex-col">
              {/* Barra superior de janela de navegador */}
              <div className="h-9 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
                </div>
                <div className="mx-auto flex items-center gap-1.5 px-6 py-1 rounded-lg bg-gray-950/60 border border-gray-800 text-[11px] text-gray-400 font-mono">
                  <span>linkhub.bio/meu-perfil</span>
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <MemoizedPreview 
                  data={data} 
                  onLinkClick={onLinkClick} 
                  previewMode={previewMode}
                  isRepositioning={isRepositioning}
                  onRepositionEnd={() => setIsRepositioning(false)}
                  onPositionChange={handlePositionChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/*
function PublicView({ data, onLinkClick, onView }: { data: AppData, onLinkClick: (id: string) => void, onView: () => void }) {
  useEffect(() => {
    onView();
  }, [onView]);

  // Blindagem de segurança do visitante: bloqueia F12, atalhos de inspeção e botão direito
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bloqueia F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Bloqueia Ctrl+Shift+I / J / C (DevTools)
      if (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Bloqueia Ctrl+U (Ver código-fonte)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      return true;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, []);

  return (
    <div className="w-full h-[100dvh] relative select-none">
      <MemoizedPreview data={data} onLinkClick={onLinkClick} />
    </div>
  );
}
*/

export default function App() {
  const { data, loading, handleUpdateData } = useLinkHubData();
  const { adminEmail, handleLogin, handleLogout } = useAuth();
  // const { handleLinkClick, handleView } = useMetrics(data?.ad);

  const isAdminDomain = window.location.hostname.includes('-adm');

  const renderAdmin = () => {
    if (!adminEmail) {
      return (
        <Suspense fallback={
          <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        }>
          <LazyLogin onLogin={handleLogin} />
        </Suspense>
      );
    }
    if (!data) return null;
    return (
      <AdminView 
        data={data} 
        setData={handleUpdateData} 
        onLinkClick={() => {}} 
        adminEmail={adminEmail}
        onLogout={handleLogout}
      />
    );
  };

  if (loading || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-full border-[3px] border-blue-500 border-t-transparent animate-spin"></div>
          <p className="text-gray-500 text-sm font-medium tracking-wide">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {isAdminDomain ? (
          <Route path="/" element={renderAdmin()} />
        ) : (
          <>
            <Route path="/" element={<Maintenance />} />
            <Route path="/admin" element={renderAdmin()} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
