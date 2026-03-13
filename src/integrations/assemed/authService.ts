// AuthService para persistência e recuperação do accessToken da Assemed
// Usa localStorage para persistência

const TOKEN_KEY = "assemed_access_token";

export interface StoredToken {
  accessToken: string;
  expiresAt: number; // timestamp em ms
}

export const AuthService = {
  saveToken(token: string, expiresAt: number) {
    const data: StoredToken = { accessToken: token, expiresAt };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(data));
  },
  getToken(): StoredToken | null {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (typeof data.accessToken === "string" && typeof data.expiresAt === "number") {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
  isTokenExpired(token: StoredToken | null): boolean {
    if (!token) return true;
    return token.expiresAt < Date.now();
  },
};
