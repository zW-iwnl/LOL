import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { clearStoredToken, getCurrentUser, getStoredToken, login as loginRequest, storeToken, type User } from "../api/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function handleAuthExpired() {
      clearStoredToken();
      setUser(null);
    }

    window.addEventListener("test-manager-auth-expired", handleAuthExpired);

    if (!getStoredToken()) {
      setLoading(false);
      return () => window.removeEventListener("test-manager-auth-expired", handleAuthExpired);
    }

    getCurrentUser()
      .then(setUser)
      .catch(() => {
        clearStoredToken();
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => window.removeEventListener("test-manager-auth-expired", handleAuthExpired);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email: string, password: string) => {
        const token = await loginRequest(email, password);
        storeToken(token.access_token);
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      },
      logout: () => {
        clearStoredToken();
        setUser(null);
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
