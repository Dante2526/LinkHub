import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AppData, defaultTheme, defaultProfile, defaultLinks } from './types';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Smartphone, Monitor, ExternalLink, Settings } from 'lucide-react';

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
            <Link to="/" target="_blank" className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold hover:bg-blue-200 transition-colors">
              Público <ExternalLink className="w-4 h-4" />
            </Link>
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
            <Link to="/" target="_blank" className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold hover:bg-blue-200 transition-colors">
              Público <ExternalLink className="w-4 h-4" />
            </Link>
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
              relative overflow-hidden transition-all duration-500 ease-in-out shadow-lg
              ${previewMode === 'mobile' 
                ? 'w-[320px] h-[640px] rounded-[2.5rem] border-[12px] border-black' 
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
      
      {/* Small floating button to go back to admin */}
      <Link 
        to="/admin" 
        className="fixed bottom-6 right-6 p-4 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full shadow-lg border border-white/30 text-white transition-all z-50 group flex items-center gap-2 overflow-hidden w-[54px] hover:w-[130px]"
      >
        <Settings className="w-5 h-5 flex-shrink-0" style={{ color: data.theme.buttonTextColor }} />
        <span className="text-sm font-semibold opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity" style={{ color: data.theme.buttonTextColor }}>Editar Página</span>
      </Link>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<AppData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved data', e);
      }
    }
    return {
      profile: defaultProfile,
      theme: defaultTheme,
      links: defaultLinks,
    };
  });

  // Save to local storage whenever data changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const handleLinkClick = useCallback((linkId: string) => {
    setData(prev => ({
      ...prev,
      links: prev.links.map(l => l.id === linkId ? { 
        ...l, 
        clicks: (l.clicks || 0) + 1,
        clickTimestamps: [...(l.clickTimestamps || []), Date.now()]
      } : l)
    }));
  }, []);

  const handleView = useCallback(() => {
    setData(prev => ({
      ...prev,
      views: (prev.views || 0) + 1
    }));
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicView data={data} onLinkClick={handleLinkClick} onView={handleView} />} />
        <Route path="/admin" element={<AdminView data={data} setData={setData} onLinkClick={handleLinkClick} />} />
      </Routes>
    </BrowserRouter>
  );
}
