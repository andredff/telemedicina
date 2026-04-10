import { useState, useEffect } from 'react';
import { AdminQueries } from '@/integrations/supabase/adminClient';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Settings, CreditCard, Bell, Shield, Globe, Save, Loader2, Truck, Eye, EyeOff, CheckCircle2, XCircle, RotateCw } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { logger } from "@/lib/logger";
import { getAuthHeaders } from "@/lib/authHeaders";

const LOCAL_SERVER_URL = import.meta.env.VITE_LOCAL_SERVER_URL || '';

interface SettingsData {
  general: {
    siteName: string;
    siteDescription: string;
    maintenanceMode: boolean;
    allowRegistrations: boolean;
    defaultPlan: string;
    currency: string;
  };
  notifications: {
    supportEmail: string;
    notificationEmail: string;
    enableEmailNotifications: boolean;
    enableSmsNotifications: boolean;
  };
  security: {
    maxUploadSize: number;
    sessionTimeout: number;
    twoFactorEnabled: boolean;
  };
  integrations: {
    resendApiKey: string;
    resendFromEmail: string;
    googleAnalyticsId: string;
    recaptchaSiteKey: string;
    recaptchaSecretKey: string;
  };
  payments: {
    enableCreditCard: boolean;
    enablePix: boolean;
    enableBoleto: boolean;
    maxInstallments: number;
  };
  shipping: {
    shippingCost: number;
    minDeliveryDays: number;
    maxDeliveryDays: number;
    freeShippingThreshold: number;
    enableFreeShipping: boolean;
  };
}

const defaultSettings: SettingsData = {
  general: {
    siteName: 'Novità Telemedicina',
    siteDescription: 'Plataforma de telemedicina e entrega de medicamentos',
    maintenanceMode: false,
    allowRegistrations: true,
    defaultPlan: 'bronze',
    currency: 'BRL',
  },
  notifications: {
    supportEmail: 'suporte@novita.com',
    notificationEmail: 'notificacoes@novita.com',
    enableEmailNotifications: true,
    enableSmsNotifications: false,
  },
  security: {
    maxUploadSize: 5,
    sessionTimeout: 30,
    twoFactorEnabled: false,
  },
  integrations: {
    resendApiKey: '',
    resendFromEmail: '',
    googleAnalyticsId: '',
    recaptchaSiteKey: '',
    recaptchaSecretKey: '',
  },
  payments: {
    enableCreditCard: true,
    enablePix: true,
    enableBoleto: false,
    maxInstallments: 12,
  },
  shipping: {
    shippingCost: 5.90,
    minDeliveryDays: 1,
    maxDeliveryDays: 2,
    freeShippingThreshold: 100,
    enableFreeShipping: true,
  },
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [testingResend, setTestingResend] = useState(false);
  const [resendStatus, setResendStatus] = useState<{ configured: boolean; from: string; source: string } | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await AdminQueries.getSettings();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const loadedSettings = { ...defaultSettings };
        
        data.forEach((setting: { key: string; value: unknown }) => {
          if (setting.key in loadedSettings) {
            loadedSettings[setting.key as keyof SettingsData] = {
              ...loadedSettings[setting.key as keyof SettingsData],
              ...(setting.value as Record<string, unknown>),
            };
          }
        });
        
        setSettings(loadedSettings);
      }
    } catch (error) {
      logger.error('Error fetching settings:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar configurações',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchResendStatus();
  }, []);

  const handleSaveSettings = async (category: keyof SettingsData) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await AdminQueries.updateSetting(category, settings[category], user?.id);
      
      if (error) throw error;
      
      logger.info("[AdminSettings] Settings saved", { category, settings: settings[category] });
      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso'
      });
    } catch (error) {
      logger.error('Error saving settings:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar configurações',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntegrations = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await AdminQueries.updateSetting('integrations', settings.integrations, user?.id);

      if (error) throw error;

      // Notifica o backend para recarregar a chave em runtime
      try {
        const baseUrl = import.meta.env.DEV ? '' : LOCAL_SERVER_URL;
        const authHeaders = await getAuthHeaders();
        await fetch(`${baseUrl}/api/integrations/resend/reload`, { method: 'POST', headers: authHeaders });
      } catch {
        // Backend pode não estar rodando em dev — ignora
      }

      toast({ title: 'Sucesso', description: 'Configurações de integração salvas' });
      fetchResendStatus();
    } catch (error) {
      logger.error('Error saving integrations:', error);
      toast({ title: 'Erro', description: 'Falha ao salvar configurações', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestResend = async () => {
    setTestingResend(true);
    try {
      const baseUrl = import.meta.env.DEV ? '' : LOCAL_SERVER_URL;
      const keyToTest = settings.integrations.resendApiKey || undefined;

      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${baseUrl}/api/integrations/resend/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ apiKey: keyToTest }),
      });

      const data = await response.json();

      if (data.success) {
        const domainNames = data.domains?.map((d: { name: string }) => d.name).join(', ') || 'nenhum';
        toast({ title: 'Conexão OK', description: `API Key válida. Domínios: ${domainNames}` });
      } else {
        toast({ title: 'Falha na validação', description: data.error || 'API Key inválida', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível conectar ao servidor', variant: 'destructive' });
    } finally {
      setTestingResend(false);
    }
  };

  const fetchResendStatus = async () => {
    try {
      const baseUrl = import.meta.env.DEV ? '' : LOCAL_SERVER_URL;
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${baseUrl}/api/integrations/resend/status`, { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        setResendStatus(data);
      }
    } catch {
      // Server may not be running
    }
  };

  const updateSetting = <K extends keyof SettingsData>(
    category: K,
    field: keyof SettingsData[K],
    value: unknown
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
        <p className="text-gray-600">Gerencie as configurações globais da plataforma</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="h-4 w-4 mr-2" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="shipping">
            <Truck className="h-4 w-4 mr-2" />
            Frete
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 mr-2" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Globe className="h-4 w-4 mr-2" />
            Integrações
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="siteName">Nome do Site</Label>
                  <Input
                    id="siteName"
                    value={settings.general.siteName}
                    onChange={(e) => updateSetting('general', 'siteName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="siteDescription">Descrição do Site</Label>
                  <Input
                    id="siteDescription"
                    value={settings.general.siteDescription}
                    onChange={(e) => updateSetting('general', 'siteDescription', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="defaultPlan">Plano Padrão</Label>
                  <Select
                    value={settings.general.defaultPlan}
                    onValueChange={(value) => updateSetting('general', 'defaultPlan', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="prata">Prata</SelectItem>
                      <SelectItem value="ouro">Ouro</SelectItem>
                      <SelectItem value="diamante">Diamante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Moeda</Label>
                  <Select
                    value={settings.general.currency}
                    onValueChange={(value) => updateSetting('general', 'currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma moeda" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real Brasileiro (BRL)</SelectItem>
                      <SelectItem value="USD">Dólar Americano (USD)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="maintenanceMode">Modo de Manutenção</Label>
                  <Switch
                    id="maintenanceMode"
                    checked={settings.general.maintenanceMode}
                    onCheckedChange={(checked) => updateSetting('general', 'maintenanceMode', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowRegistrations">Permitir Novos Cadastros</Label>
                  <Switch
                    id="allowRegistrations"
                    checked={settings.general.allowRegistrations}
                    onCheckedChange={(checked) => updateSetting('general', 'allowRegistrations', checked)}
                  />
                </div>
              </div>
              
              <Button onClick={() => handleSaveSettings('general')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações Gerais
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Cartão de Crédito</h4>
                    <p className="text-sm text-gray-500">Aceitar pagamentos via cartão de crédito</p>
                  </div>
                  <Switch
                    checked={settings.payments.enableCreditCard}
                    onCheckedChange={(checked) => updateSetting('payments', 'enableCreditCard', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">PIX</h4>
                    <p className="text-sm text-gray-500">Aceitar pagamentos via PIX</p>
                  </div>
                  <Switch
                    checked={settings.payments.enablePix}
                    onCheckedChange={(checked) => updateSetting('payments', 'enablePix', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Boleto</h4>
                    <p className="text-sm text-gray-500">Aceitar pagamentos via boleto bancário</p>
                  </div>
                  <Switch
                    checked={settings.payments.enableBoleto}
                    onCheckedChange={(checked) => updateSetting('payments', 'enableBoleto', checked)}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="maxInstallments">Máximo de Parcelas</Label>
                <Input
                  id="maxInstallments"
                  type="number"
                  value={settings.payments.maxInstallments}
                  onChange={(e) => updateSetting('payments', 'maxInstallments', parseInt(e.target.value) || 1)}
                />
              </div>
              
              <Button onClick={() => handleSaveSettings('payments')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações de Pagamento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shipping Settings */}
        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Frete e Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="shippingCost">Valor do Frete (R$)</Label>
                  <Input
                    id="shippingCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.shipping.shippingCost}
                    onChange={(e) => updateSetting('shipping', 'shippingCost', parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500 mt-1">Valor fixo cobrado por entrega</p>
                </div>
                <div>
                  <Label htmlFor="freeShippingThreshold">Valor Mínimo para Frete Grátis (R$)</Label>
                  <Input
                    id="freeShippingThreshold"
                    type="number"
                    step="0.01"
                    min="0"
                    value={settings.shipping.freeShippingThreshold}
                    onChange={(e) => updateSetting('shipping', 'freeShippingThreshold', parseFloat(e.target.value) || 0)}
                    disabled={!settings.shipping.enableFreeShipping}
                  />
                  <p className="text-xs text-gray-500 mt-1">Pedidos acima deste valor têm frete grátis</p>
                </div>
                <div>
                  <Label htmlFor="minDeliveryDays">Prazo Mínimo de Entrega (dias úteis)</Label>
                  <Input
                    id="minDeliveryDays"
                    type="number"
                    min="1"
                    value={settings.shipping.minDeliveryDays}
                    onChange={(e) => updateSetting('shipping', 'minDeliveryDays', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label htmlFor="maxDeliveryDays">Prazo Máximo de Entrega (dias úteis)</Label>
                  <Input
                    id="maxDeliveryDays"
                    type="number"
                    min="1"
                    value={settings.shipping.maxDeliveryDays}
                    onChange={(e) => updateSetting('shipping', 'maxDeliveryDays', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Frete Grátis</h4>
                  <p className="text-sm text-gray-500">
                    Habilitar frete grátis para pedidos acima do valor mínimo configurado
                  </p>
                </div>
                <Switch
                  checked={settings.shipping.enableFreeShipping}
                  onCheckedChange={(checked) => updateSetting('shipping', 'enableFreeShipping', checked)}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Resumo da Configuração</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>Valor do frete: <strong>R$ {settings.shipping.shippingCost.toFixed(2)}</strong></li>
                  <li>Prazo de entrega: <strong>{settings.shipping.minDeliveryDays} a {settings.shipping.maxDeliveryDays} dias úteis</strong></li>
                  {settings.shipping.enableFreeShipping && (
                    <li>Frete grátis para pedidos acima de: <strong>R$ {settings.shipping.freeShippingThreshold.toFixed(2)}</strong></li>
                  )}
                </ul>
              </div>

              <Button onClick={() => handleSaveSettings('shipping')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações de Frete
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Notificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supportEmail">Email de Suporte</Label>
                  <Input
                    id="supportEmail"
                    value={settings.notifications.supportEmail}
                    onChange={(e) => updateSetting('notifications', 'supportEmail', e.target.value)}
                    type="email"
                  />
                </div>
                <div>
                  <Label htmlFor="notificationEmail">Email de Notificações</Label>
                  <Input
                    id="notificationEmail"
                    value={settings.notifications.notificationEmail}
                    onChange={(e) => updateSetting('notifications', 'notificationEmail', e.target.value)}
                    type="email"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableEmailNotifications">Notificações por Email</Label>
                  <Switch
                    id="enableEmailNotifications"
                    checked={settings.notifications.enableEmailNotifications}
                    onCheckedChange={(checked) => updateSetting('notifications', 'enableEmailNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableSmsNotifications">Notificações por SMS</Label>
                  <Switch
                    id="enableSmsNotifications"
                    checked={settings.notifications.enableSmsNotifications}
                    onCheckedChange={(checked) => updateSetting('notifications', 'enableSmsNotifications', checked)}
                  />
                </div>
              </div>
              
              <Button onClick={() => handleSaveSettings('notifications')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações de Notificação
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Segurança</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxUploadSize">Tamanho Máximo de Upload (MB)</Label>
                  <Input
                    id="maxUploadSize"
                    type="number"
                    value={settings.security.maxUploadSize}
                    onChange={(e) => updateSetting('security', 'maxUploadSize', parseInt(e.target.value) || 5)}
                    className="w-[200px]"
                  />
                </div>
                <div>
                  <Label htmlFor="sessionTimeout">Timeout de Sessão (minutos)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={settings.security.sessionTimeout}
                    onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value) || 30)}
                    className="w-[200px]"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="twoFactorEnabled">Autenticação de Dois Fatores</Label>
                <Switch
                  id="twoFactorEnabled"
                  checked={settings.security.twoFactorEnabled}
                  onCheckedChange={(checked) => updateSetting('security', 'twoFactorEnabled', checked)}
                />
              </div>
              
              <Button onClick={() => handleSaveSettings('security')} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações de Segurança
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Settings */}
        <TabsContent value="integrations">
          <div className="space-y-6">
            {/* Resend (Email) */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Resend — Envio de E-mail
                      {resendStatus && (
                        resendStatus.configured ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Conectado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            <XCircle className="h-3 w-3" /> Não configurado
                          </span>
                        )
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      API para envio de e-mails transacionais (cadastro, pedidos, consultas)
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="resendApiKey">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="resendApiKey"
                        type={showResendKey ? 'text' : 'password'}
                        value={settings.integrations.resendApiKey}
                        onChange={(e) => updateSetting('integrations', 'resendApiKey', e.target.value)}
                        placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResendKey(!showResendKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                      >
                        {showResendKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleTestResend}
                      disabled={testingResend}
                    >
                      {testingResend ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <RotateCw className="h-4 w-4 mr-1" />
                          Testar
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Obtenha sua chave em <span className="font-medium">resend.com/api-keys</span>.
                    {resendStatus?.source === 'env' && ' Atualmente usando a chave do arquivo .env do servidor.'}
                  </p>
                </div>

                <div>
                  <Label htmlFor="resendFromEmail">Remetente (From)</Label>
                  <Input
                    id="resendFromEmail"
                    value={settings.integrations.resendFromEmail}
                    onChange={(e) => updateSetting('integrations', 'resendFromEmail', e.target.value)}
                    placeholder="Novità Telemedicina <noreply@novitahomecare.com.br>"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Formato: Nome &lt;email@dominio.com&gt; — o domínio deve estar verificado no Resend
                  </p>
                </div>

                {resendStatus && (
                  <div className={`rounded-lg p-3 text-sm ${resendStatus.configured ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-yellow-50 border border-yellow-200 text-yellow-800'}`}>
                    <strong>Status:</strong>{' '}
                    {resendStatus.configured
                      ? `Integração ativa (fonte: ${resendStatus.source === 'env' ? 'variável de ambiente' : 'painel admin'})`
                      : 'Modo simulação — e-mails são registrados no log mas não enviados'
                    }
                    <br />
                    <strong>Remetente atual:</strong> {resendStatus.from}
                  </div>
                )}

                <Button onClick={handleSaveIntegrations} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Configuração do Resend
                </Button>
              </CardContent>
            </Card>

            {/* Outras Integrações */}
            <Card>
              <CardHeader>
                <CardTitle>Outras Integrações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="googleAnalyticsId">Google Analytics ID</Label>
                  <Input
                    id="googleAnalyticsId"
                    value={settings.integrations.googleAnalyticsId}
                    onChange={(e) => updateSetting('integrations', 'googleAnalyticsId', e.target.value)}
                    placeholder="UA-XXXXXX-X ou G-XXXXXXXX"
                  />
                </div>

                <div>
                  <h3 className="font-medium mb-4">reCAPTCHA</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="recaptchaSiteKey">Site Key</Label>
                      <Input
                        id="recaptchaSiteKey"
                        value={settings.integrations.recaptchaSiteKey}
                        onChange={(e) => updateSetting('integrations', 'recaptchaSiteKey', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="recaptchaSecretKey">Secret Key</Label>
                      <Input
                        id="recaptchaSecretKey"
                        value={settings.integrations.recaptchaSecretKey}
                        onChange={(e) => updateSetting('integrations', 'recaptchaSecretKey', e.target.value)}
                        type="password"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={() => handleSaveSettings('integrations')} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Outras Integrações
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
