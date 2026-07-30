import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, saveAuth, loadAuth, clearAuth } from "./api";

type User = {
  id: string;
  email: string;
  full_name: string;
  company?: string;
  phone?: string;
  role: "super_admin" | "admin" | "sales_executive" | "customer";
  status?: string;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; full_name: string; company?: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { token: t, user: u } = await loadAuth();
      if (t && u) {
        setToken(t);
        setUser(u);
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r: any = await api.login({ email, password });
    await saveAuth(r.access_token, r.user);
    setToken(r.access_token);
    setUser(r.user);
  }, []);

  const register = useCallback(async (payload: any) => {
    const r: any = await api.register(payload);
    await saveAuth(r.access_token, r.user);
    setToken(r.access_token);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try { await api.serverLogout(); } catch {}
    await clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, token, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
