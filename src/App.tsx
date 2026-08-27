import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { doc, onSnapshot, setDoc, collection, addDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AppData, defaultTheme, defaultProfile, defaultLinks } from './types';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Login } from './components/Login';
import { Smartphone, Monitor, ExternalLink } from 'lucide-react';

const STORAGE_KEY = 'link-organizer-data';

const MemoizedEditor = React.memo(Editor);
const MemoizedPreview = React.memo(Preview);

function AdminView({ data, setData, onLinkClick }: { data: AppData, setData: (d: AppData) => void, onLinkClick: (id: string) => void }) {
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile');
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  return (
    <div className="flex h-screen w-full bg-[#f2f2f2] text-gray-900 overflow-hidden font-sans relative">
      {/* Editor Panel (Left) */}
      <div className={`w-full md:w-[450px] lg:w-[500px] h-full flex-shrink-0 flex-col z-10 bg-gray-50 border-r border-gray-200 ${showMobilePreview ? 'hidden md:flex' : 'flex'}`}>
        <div className="pt-12 md:pt-16 pb-6 px-6 md:px-8 flex items-center justify-between flex-shrink-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-black">LinkHub</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMobilePreview(true)}
              className="md:hidden flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold hover:bg-indigo-200 transition-colors"
            >
              <Smartphone className="w-4 h-4" /> Ver
            </button>
            <a href={window.location.hostname.includes('localhost') ? '/' : `https://${window.location.hostname.replace('-adm', '')}`} target="_blank" rel="noreferrer" className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold hover:bg-blue-200 transition-colors">
              Público <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <MemoizedEditor data={data} onChange={setData} />
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
        <div className="flex-1 overflow-hidden flex items-center justify-center p-8">
          <div 
            className={`
              relative overflow-hidden transition-all duration-500 ease-in-out shadow-lg shrink-0
              ${previewMode === 'mobile' 
                ? 'h-full max-h-[720px] aspect-[9/19] rounded-[2.5rem] border-[12px] border-black' 
                : 'w-full h-full max-w-5xl rounded-3xl border border-gray-200'
              }
            `}
          >
            {/* Mobile Notch Mockup */}
            {previewMode === 'mobile' && (
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50 pointer-events-none">
                <div className="w-20 h-5 bg-black rounded-b-2xl"></div>
              </div>
            )}
            
            <MemoizedPreview data={data} onLinkClick={onLinkClick} />
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
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState<string | null>(localStorage.getItem('linkhub_admin_email'));

  useEffect(() => {
    const docRef = doc(db, 'perfis', 'principal');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.data() as AppData);
      } else {
        const defaultData = { profile: defaultProfile, theme: defaultTheme, links: defaultLinks };
        setDoc(docRef, defaultData);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
    setData(prev => {
      if (!prev) return prev;
      const newData = typeof updater === 'function' ? updater(prev) : updater;
      setDoc(doc(db, 'perfis', 'principal'), newData);
      return newData;
    });
  }, []);

  const handleLinkClick = useCallback((linkId: string) => {
    addDoc(collection(db, 'cliques'), { linkId, time: Date.now() }).catch(console.error);
  }, []);

  const handleView = useCallback(() => {
    const hasViewed = sessionStorage.getItem('linkhub_has_viewed');
    if (!hasViewed) {
      addDoc(collection(db, 'visualizacoes'), { time: Date.now() }).catch(console.error);
      sessionStorage.setItem('linkhub_has_viewed', 'true');
    }
  }, []);

  const isAdminDomain = window.location.hostname.includes('-adm');

  const handleLogin = (email: string) => {
    localStorage.setItem('linkhub_admin_email', email);
    setAdminEmail(email);
  };

  const renderAdmin = () => {
    if (!adminEmail) {
      return <Login onLogin={handleLogin} />;
    }
    return <AdminView data={data} setData={handleUpdateData} onLinkClick={() => {}} />;
  };

  if (loading || !data) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f2f2f2]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 font-medium tracking-tight">Sincronizando com a Nuvem...</p>
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
