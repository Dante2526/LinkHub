import React, { useState } from 'react';
import { Mail, ArrowRight, ShieldCheck, AlertCircle, Loader2, Lock } from 'lucide-react';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

interface LoginProps {
  onLogin: (email: string) => void;
}

import { checkIsAdminAuthorized } from '../lib/auth';

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Digite um e-mail válido.');
      return;
    }

    setLoading(true);

    try {
      const result = await checkIsAdminAuthorized(cleanEmail);

      if (result.authorized) {
        onLogin(cleanEmail);
      } else {
        setErrorMessage(result.reason || 'Acesso negado: este e-mail não possui permissão de administrador.');
      }
    } catch {
      setErrorMessage('Ocorreu um erro ao verificar o acesso. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Lock className="w-7 h-7 text-white" />
          </div>
        </div>
        <h2 className="mt-5 text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Painel Administrativo
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Acesso restrito aos administradores cadastrados
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-black/5 rounded-3xl border border-gray-100">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {errorMessage && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200/80 flex items-start gap-3 animate-in fade-in duration-200">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-red-700 leading-relaxed font-medium">
                  {errorMessage}
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                E-mail do Administrador
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  className="block w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="exemplo@gmail.com"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-md shadow-blue-500/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Painel</span>
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
