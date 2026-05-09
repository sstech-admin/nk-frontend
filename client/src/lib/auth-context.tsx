import { createContext, useContext, useState, useEffect } from "react";
import { apiUrl, USE_REAL_API } from "./api";
import { AUTH_USER_KEY, AUTH_TOKEN_KEY, AUTH_LOGIN_DAY_KEY, setAuthToken, registerOn401 } from "./auth";

function getTodayLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

/** User shape from backend API login response. */
export interface AuthUser {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
  allowedStages?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Fallback for mock auth. */
  username?: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  isLoading: boolean;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_USER_KEY);
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedLoginDay = localStorage.getItem(AUTH_LOGIN_DAY_KEY);
    const today = getTodayLocal();
    const sessionExpired = !storedLoginDay || storedLoginDay !== today;
    if (stored && !sessionExpired) {
      setUser(JSON.parse(stored));
    } else if (sessionExpired && (stored || storedToken)) {
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_LOGIN_DAY_KEY);
      setAuthToken(null);
    }
    if (storedToken && !sessionExpired) setTokenState(storedToken);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const unregister = registerOn401(() => {
      setUser(null);
      setTokenState(null);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_LOGIN_DAY_KEY);
      setAuthToken(null);
    });
    return unregister;
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const trimmedEmail = email?.trim();
    if (!trimmedEmail || !password) {
      return { success: false, error: "Email and password are required" };
    }
    if (USE_REAL_API) {
      const url = apiUrl("/api/auth/login");
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmedEmail, password }),
          credentials: "include",
        });
        let data: Record<string, unknown>;
        try {
          data = await res.json();
        } catch {
          const text = await res.text();
          return {
            success: false,
            error: res.ok
              ? "Invalid response from server"
              : `Server error (${res.status}): ${text.slice(0, 100)}`,
          };
        }
        if (res.ok && data?.success && data?.data && typeof data.data === "object") {
          const d = data.data as { user?: unknown; token?: string };
          if (d.user && d.token) {
            const authUser = d.user as AuthUser;
            const loginDay = getTodayLocal();
            setUser(authUser);
            setTokenState(d.token);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
            localStorage.setItem(AUTH_LOGIN_DAY_KEY, loginDay);
            setAuthToken(d.token);
            return { success: true };
          }
        }
        const msg =
          (data?.message as string) ||
          (data?.error as string) ||
          (res.status === 401 ? "Invalid email or password" : `Login failed (${res.status})`);
        return { success: false, error: msg };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Network error";
        const hint =
          msg === "Failed to fetch" || msg.includes("NetworkError")
            ? " Check CORS and that the backend is reachable."
            : "";
        return { success: false, error: `${msg}.${hint}` };
      }
    }
    // Mock mode: admin@nktech.com / admin123 = ADMIN; designer1@gmail.com / Test@123 = EMPLOYEE
    const loginDay = getTodayLocal();
    if (trimmedEmail === "admin@nktech.com" && password === "admin123") {
      const authUser: AuthUser = {
        _id: "mock-admin",
        name: "Admin",
        email: trimmedEmail,
        role: "ADMIN",
        allowedStages: [],
      };
      setUser(authUser);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
      localStorage.setItem(AUTH_LOGIN_DAY_KEY, loginDay);
      return { success: true };
    }
    if (trimmedEmail === "designer1@gmail.com" && password === "Test@123") {
      const authUser: AuthUser = {
        _id: "mock-employee",
        name: "Designer-1",
        email: trimmedEmail,
        role: "EMPLOYEE",
        allowedStages: ["DESIGN_PREPARATION"],
      };
      setUser(authUser);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser));
      localStorage.setItem(AUTH_LOGIN_DAY_KEY, loginDay);
      return { success: true };
    }
    return { success: false, error: "Invalid email or password" };
  };

  const logout = () => {
    setUser(null);
    setTokenState(null);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_LOGIN_DAY_KEY);
    setAuthToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading, token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}

/** Display name for user: name > email > username > fallback */
export function getUserDisplayName(user: AuthUser | null, fallback = "User"): string {
  if (!user) return fallback;
  return user.name ?? user.email ?? user.username ?? fallback;
}

/** First letter for avatar: name > email > username > "U" */
export function getUserInitial(user: AuthUser | null): string {
  const name = getUserDisplayName(user, "");
  return name ? name.charAt(0).toUpperCase() : "U";
}
