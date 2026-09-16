import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, collection, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { AppData, defaultTheme, defaultProfile, defaultAd, Theme, Profile, Advertisement, LinkItem } from '../types';

const STORAGE_KEY = 'link-organizer-data';
const CACHE_KEY = 'linkhub_cached_profile';

const getInitialData = (): AppData | null => {
  try {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('linkhub_profile_version');
    } catch (e) {}

    const raw = localStorage.getItem(CACHE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed.links)) {
        parsed.links = [];
      } else {
        parsed.links = parsed.links.filter((l: any) => l.title !== 'Meu Canal no YouTube');
      }

      if (parsed?.theme) {
        if (!parsed.theme.profileTextColor) parsed.theme.profileTextColor = '#ffffff';
        if (!parsed.theme.linkTextAlign) parsed.theme.linkTextAlign = 'center';
        if (!parsed.theme.backgroundPositionMobile) parsed.theme.backgroundPositionMobile = { x: 50, y: 50 };
        if (!parsed.theme.backgroundPositionDesktop) parsed.theme.backgroundPositionDesktop = { x: 50, y: 50 };
        if (parsed.theme.backgroundGradient && parsed.theme.backgroundGradient.includes('#ff9a9e')) {
          parsed.theme.backgroundGradient = 'linear-gradient(135deg, #18181b 0%, #09090b 100%)';
        }
      }
      if (!parsed.ad) {
        parsed.ad = { ...defaultAd };
      } else {
        parsed.ad = { ...defaultAd, ...parsed.ad };
      }
      return parsed as AppData;
    }
  } catch (e) {
    console.error('Erro ao ler cache local', e);
  }
  return null;
};

export function useLinkHubData() {
  const [data, setData] = useState<AppData | null>(getInitialData());
  const [loading, setLoading] = useState(!data);

  // Timers ref para debouncing writes
  const profileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const themeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const adTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const linksTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      if (!data) {
        setData({
          profile: defaultProfile,
          theme: defaultTheme,
          links: [],
          ad: defaultAd,
          updatedAt: Date.now()
        });
      }
      setLoading(false);
      return;
    }

    const initialData = getInitialData() || {
      profile: defaultProfile,
      theme: defaultTheme,
      links: [],
      ad: defaultAd
    };

    let safetyTimer: NodeJS.Timeout;
    const loaded = { profile: false, theme: false, links: false, ad: false };
    
    const checkAllLoaded = () => {
      if (loaded.profile && loaded.theme && loaded.links && loaded.ad) {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    const runMigrationIfNeeded = async () => {
      if (!db) return;
      try {
        const legacyDocRef = doc(db!, 'perfis', 'principal');
        const legacySnap = await getDoc(legacyDocRef);
        if (legacySnap.exists()) {
          console.log('[Migração LinkHub] Documento legado encontrado. Migrando dados...');
          const legacyData = legacySnap.data() as AppData;
          
          if (legacyData.profile) {
            await setDoc(doc(db!, 'perfil', 'principal'), { ...legacyData.profile, updatedAt: Date.now() });
          }
          if (legacyData.theme) {
            await setDoc(doc(db!, 'temas', 'principal'), { ...legacyData.theme, updatedAt: Date.now() });
          }
          if (legacyData.ad) {
            await setDoc(doc(db!, 'anuncios', 'principal'), { ...legacyData.ad, updatedAt: Date.now() });
          }

          if (Array.isArray(legacyData.links) && legacyData.links.length > 0) {
            const realLinks = legacyData.links.filter(l => l.title !== 'Meu Canal no YouTube');
            if (realLinks.length > 0) {
              const batch = writeBatch(db!);
              realLinks.forEach((link, idx) => {
                if (link.id) {
                  batch.set(doc(db!, 'links', link.id), {
                    ...link,
                    order: idx,
                    updatedAt: Date.now()
                  });
                }
              });
              await batch.commit();
            }
          }

          await deleteDoc(legacyDocRef);
          console.log('[Migração LinkHub] Documento legado perfis/principal excluído com sucesso!');
        }
      } catch (err) {
        console.error('[Migração LinkHub] Erro na migração de dados legados:', err);
      }
    };

    runMigrationIfNeeded();

    const unsubProfile = onSnapshot(doc(db!, 'perfil', 'principal'), (snap) => {
      let profile: Profile;
      if (snap.exists()) {
        profile = snap.data() as Profile;
      } else {
        profile = initialData.profile || defaultProfile;
        if (db) setDoc(doc(db!, 'perfil', 'principal'), { ...profile, updatedAt: Date.now() }).catch(console.error);
      }
      setData(prev => ({
        profile,
        theme: prev?.theme || initialData.theme || defaultTheme,
        links: prev?.links || initialData.links || [],
        ad: prev?.ad || initialData.ad || defaultAd,
        updatedAt: Date.now()
      }));
      loaded.profile = true;
      checkAllLoaded();
    }, (err) => {
      console.error('Erro ao ler perfil:', err);
      loaded.profile = true;
      checkAllLoaded();
    });

    const unsubTheme = onSnapshot(doc(db!, 'temas', 'principal'), (snap) => {
      let theme: Theme;
      if (snap.exists()) {
        const raw = snap.data() as Theme;
        theme = { ...defaultTheme, ...raw };
        if (!theme.profileTextColor) theme.profileTextColor = '#ffffff';
        if (!theme.linkTextAlign) theme.linkTextAlign = 'center';
        if (!theme.backgroundPositionMobile) theme.backgroundPositionMobile = { x: 50, y: 50 };
        if (!theme.backgroundPositionDesktop) theme.backgroundPositionDesktop = { x: 50, y: 50 };
      } else {
        theme = initialData.theme || defaultTheme;
        if (db) setDoc(doc(db!, 'temas', 'principal'), { ...theme, updatedAt: Date.now() }).catch(console.error);
      }
      setData(prev => ({
        profile: prev?.profile || initialData.profile || defaultProfile,
        theme,
        links: prev?.links || initialData.links || [],
        ad: prev?.ad || initialData.ad || defaultAd,
        updatedAt: Date.now()
      }));
      loaded.theme = true;
      checkAllLoaded();
    }, (err) => {
      console.error('Erro ao ler tema:', err);
      loaded.theme = true;
      checkAllLoaded();
    });

    const unsubAd = onSnapshot(doc(db!, 'anuncios', 'principal'), (snap) => {
      let ad: Advertisement;
      if (snap.exists()) {
        ad = { ...defaultAd, ...snap.data() as Advertisement };
      } else {
        ad = initialData.ad || defaultAd;
        if (db) setDoc(doc(db!, 'anuncios', 'principal'), { ...ad, updatedAt: Date.now() }).catch(console.error);
      }
      setData(prev => ({
        profile: prev?.profile || initialData.profile || defaultProfile,
        theme: prev?.theme || initialData.theme || defaultTheme,
        links: prev?.links || initialData.links || [],
        ad,
        updatedAt: Date.now()
      }));
      loaded.ad = true;
      checkAllLoaded();
    }, (err) => {
      console.error('Erro ao ler anúncios:', err);
      loaded.ad = true;
      checkAllLoaded();
    });

    const unsubLinks = onSnapshot(collection(db!, 'links'), (snap) => {
      const items: (LinkItem & { order?: number })[] = [];
      snap.forEach(d => {
        items.push({ ...d.data(), id: d.id } as LinkItem & { order?: number });
      });
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const finalLinks: LinkItem[] = items.map(({ order, ...rest }) => rest as LinkItem);

      setData(prev => {
        const currentProfile = prev?.profile || initialData.profile || defaultProfile;
        const currentTheme = prev?.theme || initialData.theme || defaultTheme;
        const currentAd = prev?.ad || initialData.ad || defaultAd;
        const updated: AppData = {
          profile: currentProfile,
          theme: currentTheme,
          links: finalLinks,
          ad: currentAd,
          updatedAt: Date.now()
        };
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      loaded.links = true;
      checkAllLoaded();
    }, (err) => {
      console.error('Erro ao ler links:', err);
      loaded.links = true;
      checkAllLoaded();
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubProfile();
      unsubTheme();
      unsubAd();
      unsubLinks();
    };
  }, []);

  const handleUpdateData = useCallback((updater: AppData | ((prev: AppData) => AppData)) => {
    setData(prev => {
      if (!prev) return prev;
      const raw = typeof updater === 'function' ? updater(prev) : updater;
      const now = Date.now();
      const newData: AppData = {
        ...raw,
        updatedAt: now,
      };
      
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
      } catch (e) {}

      if (!isFirebaseConfigured || !db) return newData;

      if (JSON.stringify(prev.profile) !== JSON.stringify(newData.profile)) {
        if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current);
        profileTimeoutRef.current = setTimeout(() => {
          setDoc(doc(db!, 'perfil', 'principal'), { ...newData.profile, updatedAt: now }, { merge: true }).catch(console.error);
        }, 300);
      }

      if (JSON.stringify(prev.theme) !== JSON.stringify(newData.theme)) {
        if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current);
        themeTimeoutRef.current = setTimeout(() => {
          setDoc(doc(db!, 'temas', 'principal'), { ...newData.theme, updatedAt: now }, { merge: true }).catch(console.error);
        }, 300);
      }

      if (JSON.stringify(prev.ad) !== JSON.stringify(newData.ad)) {
        if (adTimeoutRef.current) clearTimeout(adTimeoutRef.current);
        adTimeoutRef.current = setTimeout(() => {
          if (newData.ad) {
            setDoc(doc(db!, 'anuncios', 'principal'), { ...newData.ad, updatedAt: now }, { merge: true }).catch(console.error);
          }
        }, 300);
      }

      if (JSON.stringify(prev.links) !== JSON.stringify(newData.links)) {
        if (linksTimeoutRef.current) clearTimeout(linksTimeoutRef.current);
        linksTimeoutRef.current = setTimeout(async () => {
          try {
            const batch = writeBatch(db!);
            const currentLinkIds = new Set(newData.links.map(l => l.id));

            newData.links.forEach((link, idx) => {
              if (link.id) {
                batch.set(doc(db!, 'links', link.id), {
                  ...link,
                  order: idx,
                  updatedAt: now,
                });
              }
            });

            const prevLinks = prev.links || [];
            prevLinks.forEach(oldLink => {
              if (oldLink.id && !currentLinkIds.has(oldLink.id)) {
                batch.delete(doc(db!, 'links', oldLink.id));
              }
            });

            await batch.commit();
          } catch (err) {
            console.error('Erro ao sincronizar links com Firestore:', err);
          }
        }, 300);
      }

      return newData;
    });
  }, []);

  return {
    data,
    loading,
    handleUpdateData,
  };
}
