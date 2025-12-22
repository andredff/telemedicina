import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, CreditCard, Bell, Shield, Globe, Save } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    siteName: 'Novità Telemedicina',
    siteDescription: 'Plataforma de telemedicina e entrega de medicamentos',
    maintenanceMode: false,
    allowRegistrations: true,
    defaultPlan: 'bronze',
    currency: 'BRL',
    supportEmail: 'suporte@novita.com',
    notificationEmail: 'notificacoes@novita.com',
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    maxUploadSize: 5,
    sessionTimeout: 30,
    googleAnalyticsId: '',
    recaptchaSiteKey: '',
    recaptchaSecretKey: ''
  });

  const handleSaveSettings = () => {
    // In a real app, this would save settings to the database
    console.log('Settings saved:', settings);
    toast({
      title: 'Sucesso',
      description: 'Configurações salvas com sucesso'
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setSettings(prev => ({
      ...prev,
      [name]: checked !== undefined ? checked : value
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };

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
                    name="siteName"
                    value={settings.siteName}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="siteDescription">Descrição do Site</Label>
                  <Input
                    id="siteDescription"
                    name="siteDescription"
                    value={settings.siteDescription}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="defaultPlan">Plano Padrão</Label>
                  <Select
                    value={settings.defaultPlan}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, defaultPlan: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bronze">Bronze</SelectItem>
                      <SelectItem value="prata">Prata</SelectItem>
                      <SelectItem value="ouro">Ouro</SelectItem>
                      <SelectItem value="platina">Platina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currency">Moeda</Label>
                  <Select
                    value={settings.currency}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, currency: value }))}
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
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => handleSwitchChange('maintenanceMode', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowRegistrations">Permitir Novos Cadastros</Label>
                  <Switch
                    id="allowRegistrations"
                    checked={settings.allowRegistrations}
                    onCheckedChange={(checked) => handleSwitchChange('allowRegistrations', checked)}
                  />
                </div>
              </div>
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
              <div>
                <h3 className="font-medium mb-4">Gateways de Pagamento</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Stripe</h4>
                      <p className="text-sm text-gray-500">Integração com Stripe para pagamentos</p>
                    </div>
                    <Switch
                      checked={true}
                      onCheckedChange={() => {}}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">PagSeguro</h4>
                      <p className="text-sm text-gray-500">Integração com PagSeguro</p>
                    </div>
                    <Switch
                      checked={false}
                      onCheckedChange={() => {}}
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stripePublicKey">Stripe Public Key</Label>
                  <Input
                    id="stripePublicKey"
                    placeholder="pk_test_..."
                    type="password"
                  />
                </div>
                <div>
                  <Label htmlFor="stripeSecretKey">Stripe Secret Key</Label>
                  <Input
                    id="stripeSecretKey"
                    placeholder="sk_test_..."
                    type="password"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="taxRate">Taxa de Imposto Padrão (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  placeholder="10"
                  className="w-[200px]"
                />
              </div>
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
                    name="supportEmail"
                    value={settings.supportEmail}
                    onChange={handleInputChange}
                    type="email"
                  />
                </div>
                <div>
                  <Label htmlFor="notificationEmail">Email de Notificações</Label>
                  <Input
                    id="notificationEmail"
                    name="notificationEmail"
                    value={settings.notificationEmail}
                    onChange={handleInputChange}
                    type="email"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableEmailNotifications">Notificações por Email</Label>
                  <Switch
                    id="enableEmailNotifications"
                    checked={settings.enableEmailNotifications}
                    onCheckedChange={(checked) => handleSwitchChange('enableEmailNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableSmsNotifications">Notificações por SMS</Label>
                  <Switch
                    id="enableSmsNotifications"
                    checked={settings.enableSmsNotifications}
                    onCheckedChange={(checked) => handleSwitchChange('enableSmsNotifications', checked)}
                  />
                </div>
              </div>
              
              <div>
                <Label>Template de Email Padrão</Label>
                <Textarea
                  placeholder="Digite o template de email padrão..."
                  className="min-h-[150px]"
                />
              </div>
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
                    name="maxUploadSize"
                    type="number"
                    value={settings.maxUploadSize}
                    onChange={handleInputChange}
                    className="w-[200px]"
                  />
                </div>
                <div>
                  <Label htmlFor="sessionTimeout">Timeout de Sessão (minutos)</Label>
                  <Input
                    id="sessionTimeout"
                    name="sessionTimeout"
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={handleInputChange}
                    className="w-[200px]"
                  />
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="passwordMinLength">Comprimento Mínimo de Senha</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    defaultValue={8}
                    className="w-[200px]"
                  />
                </div>
                
                <div>
                  <Label htmlFor="maxLoginAttempts">Máximo de Tentativas de Login</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    defaultValue={5}
                    className="w-[200px]"
                  />
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-4">reCAPTCHA</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recaptchaSiteKey">Site Key</Label>
                    <Input
                      id="recaptchaSiteKey"
                      name="recaptchaSiteKey"
                      value={settings.recaptchaSiteKey}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <Label htmlFor="recaptchaSecretKey">Secret Key</Label>
                    <Input
                      id="recaptchaSecretKey"
                      name="recaptchaSecretKey"
                      value={settings.recaptchaSecretKey}
                      onChange={handleInputChange}
                      type="password"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integration Settings */}
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Integrações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="googleAnalyticsId">Google Analytics ID</Label>
                <Input
                  id="googleAnalyticsId"
                  name="googleAnalyticsId"
                  value={settings.googleAnalyticsId}
                  onChange={handleInputChange}
                  placeholder="UA-XXXXXX-X ou G-XXXXXXXX"
                />
              </div>
              
              <div>
                <h3 className="font-medium mb-4">APIs Externas</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Integração com Farmácias</h4>
                      <p className="text-sm text-gray-500">Conexão com rede de farmácias parceiras</p>
                    </div>
                    <Switch
                      checked={false}
                      onCheckedChange={() => {}}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Integração com Convênios</h4>
                      <p className="text-sm text-gray-500">Conexão com operadoras de saúde</p>
                    </div>
                    <Switch
                      checked={false}
                      onCheckedChange={() => {}}
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-4">Webhooks</h3>
                <div className="space-y-4">
                  <div>
                    <Label>URL de Webhook para Novos Pedidos</Label>
                    <Input placeholder="https://seu-site.com/webhooks/orders" />
                  </div>
                  <div>
                    <Label>URL de Webhook para Novas Receitas</Label>
                    <Input placeholder="https://seu-site.com/webhooks/prescriptions" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="fixed bottom-6 right-6">
        <Button onClick={handleSaveSettings} size="lg">
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}