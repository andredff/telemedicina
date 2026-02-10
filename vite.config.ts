import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isSandbox = env.VITE_ASSEMED_SANDBOX === "true";
  const assemedApiUrl = isSandbox
    ? "https://dev-api-assemed.azurewebsites.net"
    : "https://api.assemedtelemedicina.com";

  const resendApiKey = env.RESEND_API_KEY || "";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Proxy para API Assemed - remove apenas "/api/assemed" e mantém o resto
        // Ex: /api/assemed/api/Auth/login-externo -> /api/Auth/login-externo
        "/api/assemed": {
          target: assemedApiUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/assemed/, ""),
        },
        // Proxy para Resend (email) - injeta API key no header Authorization
        "/api/resend": {
          target: "https://api.resend.com",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/resend/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              if (resendApiKey) {
                proxyReq.setHeader("Authorization", `Bearer ${resendApiKey}`);
              }
            });
          },
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
