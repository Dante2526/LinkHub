import { useCallback } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { Advertisement } from '../types';

export function useMetrics(ad: Advertisement | undefined) {
  const handleLinkClick = useCallback((linkId: string) => {
    if (!isFirebaseConfigured || !db) return;
    
    if (linkId === '__advertisement__') {
      addDoc(collection(db, 'cliques'), { 
        linkId: '__advertisement__', 
        isAd: true, 
        title: ad?.title || 'Oferta', 
        time: Date.now() 
      }).catch(console.error);
    } else {
      addDoc(collection(db, 'cliques'), { linkId, time: Date.now() }).catch(console.error);
    }
  }, [ad?.title]);

  const handleView = useCallback(() => {
    const hasViewed = sessionStorage.getItem('linkhub_has_viewed');
    if (!hasViewed) {
      if (isFirebaseConfigured && db) {
        addDoc(collection(db, 'visualizacoes'), { time: Date.now() }).catch(console.error);
      }
      sessionStorage.setItem('linkhub_has_viewed', 'true');
    }
  }, []);

  return {
    handleLinkClick,
    handleView,
  };
}
