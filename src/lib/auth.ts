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
  if (!isFirebaseConfigured) {
    console.warn('Firebase não configurado localmente. Permitindo acesso em modo offline para desenvolvimento.');
    return { authorized: true };
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

    // 3. Fallback de verificação flexível (ignora maiúsculas/espaços em branco)
    try {
      const allAdmins = await getDocs(collection(db, 'administradores'));
      if (allAdmins.empty) {
        return {
          authorized: false,
          reason: 'Acesso negado: Nenhum administrador cadastrado no momento.'
        };
      }

      const matchDoc = allAdmins.docs.find(d => {
        const dData = d.data();
        const emailField = (dData?.email || '').toString().trim().toLowerCase();
        const docId = d.id.trim().toLowerCase();
        return emailField === normalized || docId === normalized;
      });

      if (matchDoc) {
        const docData = matchDoc.data();
        if (docData?.ativo === false) {
          return { 
            authorized: false, 
            reason: 'Acesso bloqueado: Este e-mail administrativo está desativado.' 
          };
        }
        return { authorized: true };
      }
    } catch {
      // Ignora erro secundário de listagem
    }

    return {
      authorized: false,
      reason: `Acesso negado: O e-mail "${normalized}" não possui permissão de administrador.`
    };
  } catch (error: any) {
    console.error('Erro ao verificar permissão:', error);
    
    return {
      authorized: false,
      reason: 'Erro ao verificar credenciais. Verifique a sua conexão e tente novamente.'
    };
  }
}
