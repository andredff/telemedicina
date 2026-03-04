// Serviço de Email para Novità
// Usa Supabase Edge Function ou emails padrão do Auth

import { supabase } from '@/integrations/supabase/client';

// Templates de email
const templates = {
  welcome: (name: string) => ({
    subject: 'Bem-vindo à Novità Telemedicina! 🏥',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #F97316;">Olá, ${name}!</h1>
        <p>Bem-vindo à Novità Telemedicina! Estamos felizes em tê-lo conosco.</p>
        <p>Com a Novità, você pode:</p>
        <ul>
          <li>Consultar médicos online 24/7</li>
          <li>Gerenciar suas receitas médicas</li>
          <li>Comprar medicamentos com entrega em casa</li>
        </ul>
        <a href="https://novita.migrai.com.br/dashboard" 
           style="display: inline-block; background: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Acessar minha conta
        </a>
        <p style="margin-top: 24px; color: #666;">Equipe Novità</p>
      </div>
    `,
  }),

  orderConfirmation: (orderNumber: string, total: string) => ({
    subject: `Pedido #${orderNumber} confirmado! ✅`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #F97316;">Pedido Confirmado!</h1>
        <p>Seu pedido <strong>#${orderNumber}</strong> foi confirmado.</p>
        <p>Total: <strong>R$ ${total}</strong></p>
        <p>Você receberá atualizações sobre o envio.</p>
        <a href="https://novita.migrai.com.br/pedidos" 
           style="display: inline-block; background: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Acompanhar pedido
        </a>
      </div>
    `,
  }),

  passwordReset: (resetLink: string) => ({
    subject: 'Recuperação de senha - Novità',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #F97316;">Recuperar Senha</h1>
        <p>Você solicitou a recuperação de senha.</p>
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        <a href="${resetLink}" 
           style="display: inline-block; background: #F97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Criar nova senha
        </a>
        <p style="margin-top: 24px; color: #666;">Se você não solicitou, ignore este email.</p>
      </div>
    `,
  }),
};

export const EmailService = {
  /**
   * Enviar email customizado via Edge Function
   */
  async send(to: string, template: keyof typeof templates, data: Record<string, string>) {
    const { subject, html } = templates[template](...Object.values(data) as [string, string?]);

    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html },
    });

    if (error) {
      console.error('[EmailService] Error:', error);
      throw error;
    }

    return result;
  },

  /**
   * Enviar email de boas-vindas após cadastro
   */
  async sendWelcome(email: string, name: string) {
    return this.send(email, 'welcome', { name });
  },

  /**
   * Enviar confirmação de pedido
   */
  async sendOrderConfirmation(email: string, orderNumber: string, total: string) {
    return this.send(email, 'orderConfirmation', { orderNumber, total });
  },

  /**
   * Solicitar reset de senha (usa Supabase Auth - não precisa de Edge Function)
   */
  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });

    if (error) {
      console.error('[EmailService] Password reset error:', error);
      throw error;
    }

    return { success: true };
  },

  /**
   * Reenviar email de confirmação (usa Supabase Auth)
   */
  async resendConfirmationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (error) {
      console.error('[EmailService] Resend confirmation error:', error);
      throw error;
    }

    return { success: true };
  },
};

export default EmailService;
