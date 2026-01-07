# 🚀 GUIA DE DEPLOY - RECEITA SHOP DEMO

## 📋 Pré-requisitos

Antes de fazer o deploy, certifique-se de que:

- ✅ Todos os testes passaram (execute `bash test-validation.sh`)
- ✅ Build local funciona (`npm run build`)
- ✅ Variáveis de ambiente estão configuradas
- ✅ Código está commitado no Git

## 🌐 Opções de Deploy

### 1. Vercel (Recomendado) ⭐

#### Por que Vercel?
- ✅ Deploy automático do Git
- ✅ SSL gratuito
- ✅ CDN global
- ✅ Preview deployments
- ✅ Fácil configuração

#### Passos para Deploy

**Opção A: Via Interface Web**

1. Acesse [vercel.com](https://vercel.com)
2. Faça login com sua conta GitHub
3. Clique em "Add New Project"
4. Selecione o repositório `brunohelius/receita-shop-demo`
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Adicione as variáveis de ambiente:
   ```
   VITE_SUPABASE_URL=https://wtedhqhqducvwadjjgii.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
7. Clique em "Deploy"

**Opção B: Via CLI**

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd /workspace/receita-shop-demo
vercel

# Seguir as instruções:
# - Set up and deploy? Yes
# - Which scope? Sua conta
# - Link to existing project? No
# - Project name? receita-shop-demo
# - Directory? ./
# - Override settings? No

# Deploy para produção
vercel --prod
```

#### Configurar Domínio Customizado

1. No dashboard da Vercel, vá em "Settings" > "Domains"
2. Adicione seu domínio (ex: `receitashop.com.br`)
3. Configure os DNS conforme instruções
4. Aguarde propagação (até 48h)

---

### 2. Netlify

#### Passos para Deploy

**Opção A: Via Interface Web**

1. Acesse [netlify.com](https://netlify.com)
2. Faça login com sua conta GitHub
3. Clique em "Add new site" > "Import an existing project"
4. Selecione GitHub e autorize
5. Escolha o repositório `brunohelius/receita-shop-demo`
6. Configure:
   - **Branch**: `feature/prescription-search-and-analysis`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
7. Adicione as variáveis de ambiente em "Site settings" > "Environment variables"
8. Clique em "Deploy site"

**Opção B: Via CLI**

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Inicializar
cd /workspace/receita-shop-demo
netlify init

# Deploy
netlify deploy --prod
```

---

### 3. GitHub Pages

#### Configuração

1. **Criar workflow do GitHub Actions**

Crie o arquivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      run: npm run build
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
    
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

2. **Configurar Secrets**

No GitHub, vá em Settings > Secrets and variables > Actions:
- Adicione `VITE_SUPABASE_URL`
- Adicione `VITE_SUPABASE_PUBLISHABLE_KEY`

3. **Ativar GitHub Pages**

Em Settings > Pages:
- Source: Deploy from a branch
- Branch: gh-pages
- Folder: / (root)

---

### 4. AWS S3 + CloudFront

#### Passos

1. **Criar bucket S3**
```bash
aws s3 mb s3://receita-shop-demo
```

2. **Configurar bucket para hosting**
```bash
aws s3 website s3://receita-shop-demo \
  --index-document index.html \
  --error-document index.html
```

3. **Build e upload**
```bash
npm run build
aws s3 sync dist/ s3://receita-shop-demo --delete
```

4. **Criar distribuição CloudFront**
- Origin: Seu bucket S3
- Default Root Object: index.html
- Error Pages: 404 -> /index.html (para SPA routing)

---

### 5. Firebase Hosting

#### Passos

1. **Instalar Firebase CLI**
```bash
npm i -g firebase-tools
```

2. **Login**
```bash
firebase login
```

3. **Inicializar**
```bash
firebase init hosting
# Escolha:
# - Public directory: dist
# - Single-page app: Yes
# - GitHub deploys: No (ou Yes se quiser CI/CD)
```

4. **Deploy**
```bash
npm run build
firebase deploy
```

---

## 🔐 Variáveis de Ambiente

### Produção

Configure estas variáveis no seu provedor de hosting:

```env
VITE_SUPABASE_URL=https://wtedhqhqducvwadjjgii.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Desenvolvimento

Já configuradas no arquivo `.env` local.

---

## ✅ Checklist Pré-Deploy

- [ ] Todos os testes passaram
- [ ] Build local funciona sem erros
- [ ] Variáveis de ambiente configuradas
- [ ] Código commitado e pushed
- [ ] README atualizado
- [ ] Documentação completa
- [ ] .gitignore configurado
- [ ] Sem console.log em produção

---

## 🧪 Testes Pós-Deploy

Após o deploy, teste:

1. **Páginas Públicas**
   - [ ] Home carrega corretamente
   - [ ] Navegação funciona
   - [ ] Imagens carregam
   - [ ] Links funcionam

2. **Autenticação**
   - [ ] Login funciona
   - [ ] Registro funciona
   - [ ] Reset de senha funciona

3. **Área do Usuário**
   - [ ] Dashboard carrega
   - [ ] Receitas listam
   - [ ] Busca funciona
   - [ ] Carrinho funciona

4. **Painel Admin**
   - [ ] Dashboard admin carrega
   - [ ] Todas as páginas funcionam
   - [ ] Dados carregam corretamente

5. **Performance**
   - [ ] Lighthouse score > 90
   - [ ] Tempo de carregamento < 3s
   - [ ] Sem erros no console

---

## 🔍 Monitoramento

### Sentry (Recomendado)

1. **Criar conta no Sentry**
   - Acesse [sentry.io](https://sentry.io)
   - Crie um novo projeto React

2. **Instalar SDK**
```bash
npm install @sentry/react
```

3. **Configurar**
```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### Google Analytics

1. **Criar propriedade no GA4**

2. **Instalar**
```bash
npm install react-ga4
```

3. **Configurar**
```typescript
// src/main.tsx
import ReactGA from "react-ga4";

ReactGA.initialize("G-XXXXXXXXXX");
```

---

## 📊 Performance

### Otimizações Recomendadas

1. **Code Splitting**
```typescript
// Lazy load de rotas
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

2. **Image Optimization**
```bash
# Usar formato WebP
npm install sharp
```

3. **Bundle Analysis**
```bash
npm install -D rollup-plugin-visualizer
```

---

## 🆘 Troubleshooting

### Erro: "Failed to load module"
- Verifique se todas as dependências estão instaladas
- Execute `npm install`

### Erro: "Environment variables not defined"
- Verifique se as variáveis estão configuradas no provedor
- Certifique-se de que começam com `VITE_`

### Erro: "404 on page refresh"
- Configure o servidor para redirecionar todas as rotas para `index.html`
- Vercel/Netlify fazem isso automaticamente

### Build muito lento
- Use cache de dependências no CI/CD
- Considere usar `npm ci` ao invés de `npm install`

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique a documentação do provedor de hosting
2. Consulte os logs de build
3. Teste localmente com `npm run build && npm run preview`
4. Verifique as variáveis de ambiente

---

## 🎉 Conclusão

Após seguir este guia, sua aplicação estará:

- ✅ Deployada em produção
- ✅ Acessível via HTTPS
- ✅ Com domínio customizado (opcional)
- ✅ Monitorada (opcional)
- ✅ Otimizada para performance

**Boa sorte com o deploy! 🚀**

---

**Última atualização**: 2025-12-28  
**Versão**: 1.0.0
