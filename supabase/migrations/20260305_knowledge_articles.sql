-- Migration: Knowledge Base Articles
-- Este arquivo adiciona tabela de artigos da base de conhecimento

-- Knowledge Articles Table
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  category TEXT DEFAULT 'geral',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  views INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_slug ON knowledge_articles(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_articles(status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_knowledge_articles_updated_at ON knowledge_articles;
CREATE TRIGGER trigger_knowledge_articles_updated_at
  BEFORE UPDATE ON knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE knowledge_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles
CREATE POLICY "Anyone can read published knowledge articles"
  ON knowledge_articles FOR SELECT
  USING (status = 'published');

-- Admins and support can manage all articles
CREATE POLICY "Staff can manage knowledge articles"
  ON knowledge_articles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'support')
    )
  );

-- Insert sample articles
INSERT INTO knowledge_articles (title, slug, content, excerpt, category, status, views) VALUES
  ('Como criar uma conta na Novità', 'como-criar-conta', 
   '<h2>Criando sua conta</h2><p>Para criar uma conta na Novità:</p><ol><li>Acesse novita.migrai.com.br</li><li>Clique em "Criar Conta"</li><li>Preencha seus dados</li><li>Confirme seu email</li></ol><p>Pronto! Você já pode acessar a plataforma.</p>',
   'Guia passo a passo para novos usuários', 'conta', 'published', 245),
  
  ('Como agendar uma consulta', 'como-agendar-consulta',
   '<h2>Agendando uma consulta</h2><p>Para agendar uma consulta:</p><ol><li>Faça login na sua conta</li><li>Acesse "Teleconsultas"</li><li>Escolha a especialidade</li><li>Selecione o médico e horário</li><li>Confirme o agendamento</li></ol><p>Você receberá um email de confirmação.</p>',
   'Processo para agendamento de consultas médicas', 'consultas', 'published', 189),
  
  ('Problemas com login', 'problemas-login',
   '<h2>Soluções para problemas de login</h2><h3>Esqueci minha senha</h3><p>Clique em "Esqueci minha senha" na tela de login e siga as instruções.</p><h3>Email não reconhecido</h3><p>Verifique se está usando o email correto. Se o problema persistir, entre em contato com o suporte.</p><h3>Conta bloqueada</h3><p>Após 5 tentativas incorretas, sua conta é bloqueada por 15 minutos.</p>',
   'Soluções para problemas comuns de autenticação', 'conta', 'published', 412),
  
  ('Como funciona a entrega de medicamentos', 'entrega-medicamentos',
   '<h2>Entrega de Medicamentos</h2><p>Após seu pedido ser confirmado:</p><ol><li>Processamento: 1-2 dias úteis</li><li>Envio: calculado pelo CEP</li><li>Prazo médio: 3-7 dias úteis</li></ol><p>Você pode acompanhar seu pedido em "Meus Pedidos".</p>',
   'Informações sobre entrega de medicamentos', 'pedidos', 'published', 156),
  
  ('Planos e assinaturas', 'planos-assinaturas',
   '<h2>Nossos Planos</h2><h3>Bronze</h3><p>Consultas ilimitadas com clínico geral 24h.</p><h3>Prata</h3><p>Bronze + especialistas básicos.</p><h3>Ouro</h3><p>Prata + desconto em medicamentos.</p><h3>Diamante</h3><p>Ouro + dependentes inclusos.</p>',
   'Conheça nossos planos de assinatura', 'planos', 'published', 328)
ON CONFLICT (slug) DO NOTHING;
