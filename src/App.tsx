import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { doc, onSnapshot, setDoc, collection, addDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './lib/firebase';
import { AppData, defaultTheme, defaultProfile, defaultLinks, defaultAd, BackgroundPosition } from './types';
import { Preview } from './components/Preview';
import { Smartphone, Monitor, ExternalLink, Loader2, LogOut } from 'lucide-react';
import { checkIsAdminAuthorized } from './components/Login';

const LazyEditor = lazy(() => import('./components/Editor').then(m => ({ default: m.Editor })));
const LazyLogin = lazy(() => import('./components/Login').then(m => ({ default: m.Login })));

const STORAGE_KEY = 'link-organizer-data';
const CACHE_KEY = 'linkhub_cached_profile';

const getInitialData = (): AppData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.theme) {
        if (!parsed.theme.profileTextColor) parsed.theme.profileTextColor = '#ffffff';
        if (!parsed.theme.linkTextAlign) parsed.theme.linkTextAlign = 'center';
        if (!parsed.theme.backgroundPositionMobile) parsed.theme.backgroundPositionMobile = { x: 50, y: 50 };
        if (!parsed.theme.backgroundPositionDesktop) parsed.theme.backgroundPositionDesktop = { x: 50, y: 50 };
      }
      if (!parsed.ad) {
        parsed.ad = { ...defaultAd };
      } else {
        parsed.ad = { ...defaultAd, ...parsed.ad };
      }
      return parsed;
    }
  } catch (e) {
    console.error('Erro ao ler cache local', e);
  }
  return null;
};

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
    <div className="flex h-screen w-full bg-[#f2f2f2] text-gray-900 overflow-hidden font-sans relative">
      {/* Editor Panel (Left) */}
      <div className={`w-full md:w-[450px] lg:w-[500px] h-full flex-shrink-0 flex-col z-10 bg-gray-50 border-r border-gray-200 ${showMobilePreview ? 'hidden md:flex' : 'flex'}`}>
        <div className="pt-12 md:pt-16 pb-6 px-6 md:px-8 flex items-center justify-between flex-shrink-0">
          <div className="flex flex-col">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-black">LinkHub</h1>
            {adminEmail && (
              <span className="text-[11px] text-gray-400 font-medium truncate max-w-[170px] sm:max-w-[220px]" title={adminEmail}>
                {adminEmail}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMobilePreview(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-full text-xs font-semibold hover:bg-indigo-200 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" /> Ver
            </button>
            <a href={window.location.hostname.includes('localhost') ? '/' : `https://${window.location.hostname.replace('-adm', '')}`} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold hover:bg-blue-200 transition-colors">
              Público <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sair do painel administrativo"
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-full text-xs font-semibold transition-all border border-gray-200 hover:border-red-200 cursor-pointer shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex h-full w-full items-center justify-center bg-gray-50">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
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
      <div className={`${showMobilePreview ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative z-10 bg-[#e3e3e3]`}>
        {/* Mobile Header (Only visible when mobile preview is active) */}
        {showMobilePreview && (
          <div className="md:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
            <button 
              onClick={() => setShowMobilePreview(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              Voltar ao Editor
            </button>
            <a href={window.location.hostname.includes('localhost') ? '/' : `https://${window.location.hostname.replace('-adm', '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold hover:bg-blue-200 transition-colors">
              Público <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Top bar for view toggle (Desktop only) */}
        <div className="hidden md:flex h-20 items-center justify-center gap-2 flex-shrink-0 pt-4">
          <div className="flex bg-white rounded-full p-1 shadow-sm border border-gray-200">
            <button 
              onClick={() => setPreviewMode('mobile')}
              className={`px-6 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all ${previewMode === 'mobile' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
              title="Visualização Mobile"
            >
              <Smartphone className="w-4 h-4" /> Mobile
            </button>
            <button 
              onClick={() => setPreviewMode('desktop')}
              className={`px-6 py-2 rounded-full flex items-center gap-2 text-sm font-semibold transition-all ${previewMode === 'desktop' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-900'}`}
              title="Visualização Desktop"
            >
              <Monitor className="w-4 h-4" /> Desktop
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-4 sm:p-8 isolate">
          <div 
            className={`
              relative overflow-hidden transition-all duration-500 ease-in-out shadow-2xl shrink-0
              ${previewMode === 'mobile' 
                ? 'h-full max-h-[720px] aspect-[9/19] rounded-[2.5rem] border-[12px] border-black bg-black' 
                : 'w-full h-full max-w-5xl rounded-3xl border border-gray-300 bg-white'
              }
            `}
          >
            {/* Mobile Notch Mockup */}
            {previewMode === 'mobile' && (
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50 pointer-events-none">
                <div className="w-20 h-5 bg-black rounded-b-2xl"></div>
              </div>
            )}
            
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
  );
}

function PublicView({ data, onLinkClick, onView }: { data: AppData, onLinkClick: (id: string) => void, onView: () => void }) {
  useEffect(() => {
    onView();
  }, [onView]);

  return (
    <div className="w-full h-[100dvh] relative">
      <MemoizedPreview data={data} onLinkClick={onLinkClick} />
      
      
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<AppData | null>(getInitialData);
  const [loading, setLoading] = useState<boolean>(() => !getInitialData());
  const [adminEmail, setAdminEmail] = useState<string | null>(localStorage.getItem('linkhub_admin_email'));

  useEffect(() => {
    if (!isFirebaseConfigured) {
      if (!data) {
        const defaultData = getInitialData() || { profile: defaultProfile, theme: defaultTheme, links: defaultLinks };
        setData(defaultData);
      }
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, 'perfis', 'principal');
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const fetchedData = snapshot.data() as AppData;
          if (!fetchedData.theme) {
            fetchedData.theme = { ...defaultTheme };
          }
          if (!fetchedData.theme.profileTextColor) {
            fetchedData.theme.profileTextColor = '#ffffff';
          }
          if (!fetchedData.theme.linkTextAlign) {
            fetchedData.theme.linkTextAlign = 'center';
          }
          if (!fetchedData.theme.backgroundPositionMobile) {
            fetchedData.theme.backgroundPositionMobile = { x: 50, y: 50 };
          }
          if (!fetchedData.theme.backgroundPositionDesktop) {
            fetchedData.theme.backgroundPositionDesktop = { x: 50, y: 50 };
          }
          if (!fetchedData.ad) {
            fetchedData.ad = { ...defaultAd };
          } else {
            fetchedData.ad = { ...defaultAd, ...fetchedData.ad };
          }
          setData(fetchedData);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(fetchedData));
          } catch (e) {
            console.error("Erro ao salvar cache", e);
          }
        } else {
          const defaultData: AppData = { profile: defaultProfile, theme: defaultTheme, links: defaultLinks, ad: defaultAd };
          setDoc(docRef, defaultData).catch(console.error);
          setData(defaultData);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(defaultData));
          } catch (e) {}
        }
        setLoading(false);
      }, (error) => {
        console.error("Erro no onSnapshot do Firestore:", error);
        if (!data) {
          setData(getInitialData() || { profile: defaultProfile, theme: defaultTheme, links: defaultLinks });
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Erro ao conectar no Firestore:", err);
      if (!data) {
        setData(getInitialData() || { profile: defaultProfile, theme: defaultTheme, links: defaultLinks });
      }
      setLoading(false);
    }
  }, []);

  const handleUpdateData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
    setData(prev => {
      if (!prev) return prev;
      const newData = typeof updater === 'function' ? updater(prev) : updater;
      if (isFirebaseConfigured) {
        setDoc(doc(db, 'perfis', 'principal'), newData).catch(console.error);
      }
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
      } catch (e) {}
      return newData;
    });
  }, []);

  const handleLinkClick = useCallback((linkId: string) => {
    if (isFirebaseConfigured) {
      addDoc(collection(db, 'cliques'), { linkId, time: Date.now() }).catch(console.error);
    }
  }, []);

  const handleView = useCallback(() => {
    const hasViewed = sessionStorage.getItem('linkhub_has_viewed');
    if (!hasViewed) {
      if (isFirebaseConfigured) {
        addDoc(collection(db, 'visualizacoes'), { time: Date.now() }).catch(console.error);
      }
      sessionStorage.setItem('linkhub_has_viewed', 'true');
    }
  }, []);

  const isAdminDomain = window.location.hostname.includes('-adm');

  const handleLogout = useCallback(() => {
    localStorage.removeItem('linkhub_admin_email');
    setAdminEmail(null);
  }, []);

  // Revalida se o e-mail ativo ainda consta na coleção 'administradores' no Firestore
  useEffect(() => {
    if (adminEmail && isFirebaseConfigured) {
      checkIsAdminAuthorized(adminEmail).then(res => {
        if (!res.authorized) {
          console.warn('Sessão administrativa expirada ou revogada no Firebase:', res.reason);
          handleLogout();
        }
      }).catch(console.error);
    }
  }, [adminEmail, handleLogout]);

  const handleLogin = (email: string) => {
    localStorage.setItem('linkhub_admin_email', email);
    setAdminEmail(email);
  };

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
          <div className="w-10 h-10 rounded-full border-3 border-blue-500 border-t-transparent animate-spin"></div>
          <p className="text-gray-400 text-sm font-medium tracking-wide">Carregando perfil...</p>
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
            <Route path="/" element={<PublicView data={data} onLinkClick={handleLinkClick} onView={handleView} />} />
            <Route path="/admin" element={renderAdmin()} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
}
