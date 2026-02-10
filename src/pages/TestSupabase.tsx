import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Loader2, Play } from 'lucide-react';
import { logger } from '@/lib/logger';
import type { Database } from '@/integrations/supabase/types';

interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: string;
}

type TableName = keyof Database['public']['Tables'];

export default function TestSupabase() {
  const [queryResult, setQueryResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [iframeUrl, setIframeUrl] = useState('https://example.com');
  const [selectedTable, setSelectedTable] = useState<TableName>('profiles');

  // URLs de atalho para teste
  const shortcutUrls = [
    { label: 'Exemplo', url: 'https://example.com' },
    { label: 'Google', url: 'https://www.google.com' },
    { label: 'Telemedicina Local', url: 'http://localhost:5173/telemedicina' },
    { label: 'API Assemed (mock)', url: 'https://api.assemed.com.br/sala-espera/123' },
  ];

  const setIframeFromShortcut = (url: string) => {
    setIframeUrl(url);
  };

  const runQuery = async () => {
    setLoading(true);
    setQueryResult(null);

    try {
      // Fazer query baseada na tabela selecionada
      const { data, error } = await supabase
        .from(selectedTable)
        .select('*')
        .limit(10);

      if (error) {
        setQueryResult({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      } else {
        setQueryResult({
          success: true,
          data,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      setQueryResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setQueryResult(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true });

      if (error) {
        setQueryResult({
          success: false,
          error: `Erro de conexão: ${error.message}`,
          timestamp: new Date().toISOString()
        });
      } else {
        setQueryResult({
          success: true,
          data: { message: 'Conexão com Supabase OK!', count: data },
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      setQueryResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erro de conexão',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const tables: TableName[] = [
    'profiles', 
    'orders', 
    'prescriptions', 
    'user_subscriptions', 
    'medications', 
    'cart_items',
    'subscription_plans',
    'dependents'
  ];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teste Supabase & Iframe</h1>
        <p className="text-muted-foreground">Teste consultas ao banco e visualize o iframe de telemedicina</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Painel de Teste do Supabase */}
        <Card>
          <CardHeader>
            <CardTitle>Teste de Consulta Supabase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={testConnection} 
                variant="outline" 
                disabled={loading}
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Testar Conexão
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Tabela para consultar</Label>
              <div className="flex flex-wrap gap-2">
                {tables.map(table => (
                  <Button
                    key={table}
                    variant={selectedTable === table ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedTable(table)}
                    className="text-xs"
                  >
                    {table}
                  </Button>
                ))}
              </div>
            </div>

            <Button 
              onClick={runQuery} 
              disabled={loading}
              className="w-full gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Consultar {selectedTable}
            </Button>

            {/* Resultado da Query */}
            {queryResult && (
              <Alert variant={queryResult.success ? 'default' : 'destructive'}>
                {queryResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="mt-2">
                    <strong>Status:</strong> {queryResult.success ? 'Sucesso' : 'Erro'}
                  </div>
                  {queryResult.error && (
                    <div className="text-red-600 mt-1">{queryResult.error}</div>
                  )}
                  {queryResult.data && (
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(queryResult.data, null, 2)}
                    </pre>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(queryResult.timestamp).toLocaleString()}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Painel do Iframe */}
        <Card>
          <CardHeader>
            <CardTitle>Teste de Iframe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="iframe-url">URL do Iframe</Label>
              <Input
                id="iframe-url"
                value={iframeUrl}
                onChange={(e) => setIframeUrl(e.target.value)}
                placeholder="https://exemplo.com"
              />
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground w-full">URLs de atalho:</span>
                {shortcutUrls.map((shortcut) => (
                  <Button
                    key={shortcut.url}
                    variant="outline"
                    size="sm"
                    onClick={() => setIframeFromShortcut(shortcut.url)}
                    className="text-xs"
                  >
                    {shortcut.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden" style={{ height: '400px' }}>
              <iframe
                src={iframeUrl}
                title="Teste de Iframe"
                className="w-full h-full border-0"
                onLoad={() => logger.info('Iframe carregado com sucesso')}
                onError={() => logger.warn('Erro ao carregar iframe')}
                allow="camera; microphone; fullscreen; display-capture"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              O iframe carrega a URL especificada acima. Use uma URL válida para testar.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
