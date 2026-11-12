import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider, isAdminEmail } from '../firebase';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/popup-blocked':
    'El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio e inténtalo de nuevo.',
  // In-app browsers (Instagram, Facebook, WhatsApp, etc.) don't support the Google sign-in popup.
  'auth/operation-not-supported-in-this-environment':
    'Este navegador no permite iniciar sesión con Google. Abre esta página en Safari o Chrome (menú ⋯ → "Abrir en el navegador") e inténtalo de nuevo.',
  'auth/web-storage-unsupported':
    'El navegador tiene bloqueado el almacenamiento (por ejemplo, en modo privado estricto). Abre esta página en Safari o Chrome normal.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
};

const POPUP_CLOSED_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request']);

/** Firebase auth state for the admin screens. */
export const useAdminAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    []
  );

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (!code || !POPUP_CLOSED_CODES.has(code)) {
        setError(AUTH_ERROR_MESSAGES[code ?? ''] ?? (err instanceof Error ? err.message : 'No se pudo iniciar sesión.'));
      }
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  return {
    user,
    ready,
    error,
    signingIn,
    isAdmin: isAdminEmail(user?.email),
    signIn,
    logout,
  };
};
