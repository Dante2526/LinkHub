import { useState, useCallback, useEffect } from 'react';
import { checkIsAdminAuthorized } from '../lib/auth';
import { isFirebaseConfigured } from '../lib/firebase';

export function useAuth() {
  const [adminEmail, setAdminEmail] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('linkhub_admin_email') : null
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem('linkhub_admin_email');
    setAdminEmail(null);
  }, []);

  const handleLogin = useCallback((email: string) => {
    localStorage.setItem('linkhub_admin_email', email);
    setAdminEmail(email);
  }, []);

  // Revalida se o e-mail ativo ainda consta na coleção 'administradores' no Firestore
  useEffect(() => {
    if (adminEmail && isFirebaseConfigured) {
      checkIsAdminAuthorized(adminEmail)
        .then((res) => {
          if (!res.authorized) {
            console.warn('Sessão administrativa expirada ou revogada no Firebase:', res.reason);
            handleLogout();
          }
        })
        .catch(console.error);
    }
  }, [adminEmail, handleLogout]);

  return {
    adminEmail,
    handleLogin,
    handleLogout,
  };
}
