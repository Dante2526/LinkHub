import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface AdminAuthResult {
  authorized: boolean;
  reason?: string;
}

/**
 * Consulta a coleção 'administradores' no Firestore para verificar se o e-mail possui permissão.
 * Suporta tanto o e-mail como ID do documento (ex: 'administradores/user@email.com')
 * quanto como campo interno (ex: { email: 'user@email.com' }).
 */
export async function checkIsAdminAuthorized(email: string): Promise<AdminAuthResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return { authorized: false, reason: 'Por favor, insira um endereço de e-mail válido.' };
  }

  // Se o Firebase não estiver configurado nesta instância local de desenvolvimento
  if (!isFirebaseConfigured || !db) {
    return { authorized: false, reason: 'Firebase não configurado localmente.' };
  }

  try {
    // 1. Tenta buscar direto pelo ID do documento (ex: 'administradores/naylanmoreira350@gmail.com')
    const directDocRef = doc(db, 'administradores', normalized);
    const directSnap = await getDoc(directDocRef);
    
    if (directSnap.exists()) {
      const data = directSnap.data();
      if (data?.ativo === false) {
        return { 
          authorized: false, 
          reason: 'Acesso bloqueado: Este e-mail administrativo foi desativado no Firebase.' 
        };
      }
      return { authorized: true };
    }

    // 2. Busca por documentos com o campo 'email' igual ao digitado
    const q = query(
      collection(db, 'administradores'),
      where('email', '==', normalized)
    );
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      const docData = querySnap.docs[0].data();
      if (docData?.ativo === false) {
        return { 
          authorized: false, 
          reason: 'Acesso bloqueado: Este e-mail administrativo foi desativado no Firebase.' 
        };
      }
      return { authorized: true };
    }

    // 3. (Removido: Fallback scan inseguro)

    return {
      authorized: false,
      reason: `Acesso negado: O e-mail "${normalized}" não possui permissão de administrador.`
    };
  } catch (error) {
    console.error('Erro ao verificar permissão:', error);
    
    return {
      authorized: false,
      reason: 'Erro ao verificar credenciais. Verifique a sua conexão e tente novamente.'
    };
  }
}
