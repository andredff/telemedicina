// AuthService para persistência e recuperação do accessToken da Assemed
// Usa localStorage para persistência

const TOKEN_KEY = "assemed_access_token";

export interface StoredToken {
  accessToken: string;
  expiresAt: number; // timestamp em ms
  cpf: string; // CPF associado ao token
}

export const AuthService = {
  saveToken(token: string, expiresAt: number, cpf: string) {
    const data: StoredToken = { accessToken: token, expiresAt, cpf };
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
  /**
   * Retorna o token armazenado apenas se pertencer ao CPF informado.
   * Se o token pertencer a outro CPF, limpa o storage e retorna null.
   */
  getTokenForCpf(cpf: string): StoredToken | null {
    const stored = this.getToken();
    if (!stored) return null;
    // Rejeita tokens sem CPF (formato legado) ou de outro usuário
    if (!stored.cpf || stored.cpf !== cpf) {
      this.clearToken();
      return null;
    }
    return stored;
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
  isTokenExpired(token: StoredToken | null): boolean {
    if (!token) return true;
    return token.expiresAt < Date.now();
  },
};
