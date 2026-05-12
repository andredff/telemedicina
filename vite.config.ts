import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "path";
import { componentTagger } from "lovable-tagger";

const copyDocsRouteFiles = (sourceDir: string, targetDir: string, extensions: Set<string>) => {
  if (!existsSync(sourceDir)) {
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!extensions.has(extension)) {
      continue;
    }

    copyFileSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
  }
};

const docsMimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const resolveDocsRouteFile = (requestUrl: string, docsDir: string) => {
  const pathname = decodeURIComponent(requestUrl.split("?")[0] ?? "");

  if (pathname === "/docs" || pathname === "/docs/") {
    return path.join(docsDir, "index.html");
  }

  if (pathname === "/compare" || pathname === "/compare/" || pathname === "/compare/index.html") {
    return path.join(docsDir, "compare", "index.html");
  }

  if (pathname === "/compare/status.html") {
    return path.join(docsDir, "compare", "status.html");
  }

  if (!pathname.startsWith("/docs/")) {
    return null;
  }

  const candidate = path.resolve(docsDir, pathname.slice("/docs/".length));
  if (!candidate.startsWith(`${docsDir}${path.sep}`)) {
    return null;
  }

  return candidate;
};

const docsRoutesPlugin = () => ({
  name: "docs-routes",
  configureServer(server) {
    const docsDir = path.resolve(__dirname, "docs");

    server.middlewares.use((request, response, next) => {
      const filePath = resolveDocsRouteFile(request.url ?? "", docsDir);
      if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
        next();
        return;
      }

      response.statusCode = 200;
      response.setHeader("Content-Type", docsMimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream");
      createReadStream(filePath).pipe(response);
    });
  },
  closeBundle() {
    const docsDir = path.resolve(__dirname, "docs");
    const distDocsDir = path.resolve(__dirname, "dist", "docs");

    // Copy all files from docs directory recursively
    const copyAllDocs = (source: string, target: string) => {
      if (!existsSync(source)) {
        return;
      }

      mkdirSync(target, { recursive: true });

      for (const entry of readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
          copyAllDocs(sourcePath, targetPath);
        } else if (entry.isFile()) {
          copyFileSync(sourcePath, targetPath);
        }
      }
    };

    copyAllDocs(docsDir, distDocsDir);
    copyDocsRouteFiles(
      path.join(docsDir, "compare"),
      path.resolve(__dirname, "dist", "compare"),
      new Set([".html"])
    );
  },
});

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
      port: 5173,
      proxy: {
        // Proxy para API Assemed - remove apenas "/api/assemed" e mantém o resto
        // Ex: /api/assemed/api/Auth/login-externo -> /api/Auth/login-externo
        "/api/assemed": {
          target: assemedApiUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/assemed/, ""),
        },
        // Proxy para endpoints de integrações no Express server (dev)
        "/api/integrations": {
          target: "http://localhost:5174",
          changeOrigin: true,
        },
        // Admin endpoints → Express server
        "/api/admin": {
          target: "http://localhost:5174",
          changeOrigin: true,
        },
        // Logistics OS endpoint -> Express server
        "/api/logistics": {
          target: "http://localhost:5174",
          changeOrigin: true,
        },
        // Order operations that require backend auth/admin checks
        "/api/orders": {
          target: "http://localhost:5174",
          changeOrigin: true,
        },
        // Notification events (PagamentoMedicamentoConfirmado, AssinaturaPlanoAtivada, etc.)
        "/api/notifications": {
          target: "http://localhost:5174",
          changeOrigin: true,
        },
        // /api/resend/emails → Express local (que decide entre Mailpit e Resend real)
        "/api/resend/emails": {
          target: "http://localhost:5174",
          changeOrigin: true,
        },
        // Outros subpaths /api/resend/* → Resend API diretamente (com chave injetada)
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
    plugins: [react(), docsRoutesPlugin(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
