import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthContextValue {
  isAuthenticated: boolean;
  user: string | null;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const KEY = "tgms.auth.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem(KEY);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user) window.sessionStorage.setItem(KEY, user);
    else window.sessionStorage.removeItem(KEY);
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        login: (email) => setUser(email),
        logout: () => setUser(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
