import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import BackLink from "@/components/BackLink";
import { ActiveConsultationBanner } from "@/components/ActiveConsultationBanner";
import { useAssemedToken } from "@/hooks/useAssemedToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, User, FileText, ChevronRight, Loader2, Filter, X, ChevronLeft, ChevronRight as ChevronRightIcon, Download, ExternalLink, Video } from "lucide-react";
import { usePrescriptionSearch } from "@/hooks/use-prescription-search";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { normalizeConsultationStatus } from "@/integrations/assemed/types";

// Receituário vindo da API Assemed
interface AssemedReceituario {
  consultationId: number;
  especialidade: string;
  profissional: string | null;
  data: string;
  status: string;
  urlPdf: string;
}

const Prescriptions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { accessToken: assemedAccessToken, isLoading: assemedLoading } = useAssemedToken();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Receituários vindos da API Assemed
  const [assemedReceituarios, setAssemedReceituarios] = useState<AssemedReceituario[]>([]);
  const [loadingReceituarios, setLoadingReceituarios] = useState(true);

  // Erro geral ao buscar receituários
  const [receituariosError, setReceituariosError] = useState<string | null>(null);

  // Carrega receituários de todas as consultas Assemed (em paralelo)
  useEffect(() => {
    // Aguarda o hook terminar de autenticar antes de tomar decisão
    if (assemedLoading) {
      console.log("[Prescriptions] Aguardando autenticação Assemed...");
      return;
    }

    let cancelled = false;

    const loadReceituarios = async () => {
      setLoadingReceituarios(true);
      setReceituariosError(null);
      try {
        const { assemedClient } = await import("@/integrations/assemed/client");

        // Usa o token do hook se disponível, senão tenta o token já existente no client
        if (assemedAccessToken) {
          assemedClient.setAccessToken(assemedAccessToken);
        }

        const currentToken = assemedClient.getAccessToken();
        if (!currentToken) {
          console.log("[Prescriptions] Sem token Assemed — paciente pode não estar cadastrado no Assemed");
          setLoadingReceituarios(false);
          return;
        }

        // 1. Buscar todas as consultas via /obter
        console.log("[Prescriptions] Buscando consultas...");
        const response = await assemedClient.getConsultations(50, 0);
        const consultations = response.items || [];

        console.log("[Prescriptions] Consultas carregadas:", consultations.length,
          consultations.map(c => ({
            id: c.id,
            status: normalizeConsultationStatus(c),
          }))
        );

        if (cancelled) return;

        // 2. Buscar receituários em paralelo (pula canceladas)
        const eligibleConsultations = consultations.filter(
          c => normalizeConsultationStatus(c) !== "CANCELADO"
        );

        const results = await Promise.allSettled(
          eligibleConsultations.map(async (consultation) => {
            const items = await assemedClient.getReceituarios(consultation.id);
            return { consultation, items };
          })
        );

        if (cancelled) return;

        const receituarios: AssemedReceituario[] = [];
        let failCount = 0;

        for (const result of results) {
          if (result.status === "rejected") {
            failCount++;
            continue;
          }
          const { consultation, items } = result.value;
          if (items && items.length > 0) {
            console.log(`[Prescriptions] Consulta #${consultation.id}: ${items.length} receituário(s)`);
          }
          for (const item of items) {
            if (item.urlPdf) {
              receituarios.push({
                consultationId: consultation.id,
                especialidade: consultation.especialidadeNome || "Consulta",
                profissional: consultation.profissionalNome || null,
                data: consultation.dataHoraFim || consultation.dataHoraCriacao || consultation.dataCriacao,
                status: normalizeConsultationStatus(consultation),
                urlPdf: item.urlPdf,
              });
            }
          }
        }

        if (cancelled) return;

        // Se todas as chamadas falharam e havia consultas elegíveis, mostra erro
        if (failCount > 0 && failCount === eligibleConsultations.length && eligibleConsultations.length > 0) {
          setReceituariosError("Não foi possível carregar os receituários. Tente novamente mais tarde.");
        }

        console.log("[Prescriptions] Total de receituários encontrados:", receituarios.length);
        setAssemedReceituarios(receituarios);
      } catch (err) {
        console.error("[Prescriptions] Erro ao carregar receituários Assemed:", err);
        setReceituariosError("Erro ao buscar receituários das consultas.");
      } finally {
        setLoadingReceituarios(false);
      }
    };

    loadReceituarios();

    return () => { cancelled = true; };
  }, [assemedAccessToken, assemedLoading]);

  // Memoize search params to prevent recreating the object on every render
  const searchParams = useMemo(() => ({
    query: searchTerm,
    status: statusFilter,
    dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
    dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
    pageSize: 6,
  }), [searchTerm, statusFilter, dateFrom, dateTo]);

  const {
    searchResults,
    loading,
    error,
    suggestions,
    updateSearchParams,
    getSuggestions,
    goToPage,
  } = usePrescriptionSearch(searchParams);

  // Debounced suggestions - only call when searchTerm changes
  useEffect(() => {
    if (searchTerm.length > 0) {
      const timer = setTimeout(() => {
        getSuggestions(searchTerm);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Erro na busca",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "expired":
        return "bg-red-500";
      case "used":
        return "bg-gray-500";
      case "pending":
        return "bg-yellow-500";
      case "partial":
        return "bg-orange-500";
      case "completed":
        return "bg-blue-500";
      default:
        return "bg-purple-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Ativa";
      case "expired":
        return "Expirada";
      case "used":
        return "Utilizada";
      case "pending":
        return "Pendente";
      case "partial":
        return "Parcial";
      case "completed":
        return "Completa";
      default:
        return status;
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(prev => 
      prev.includes(value) 
        ? prev.filter(s => s !== value)
        : [...prev, value]
    );
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header isAuthenticated title="Receituários" />
      
      <main className="container mx-auto px-4 py-8">
        <BackLink />
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
            Meus Receituários
          </h1>
          <p className="text-muted-foreground">
            Visualize e gerencie todas as suas receitas médicas
          </p>
        </div>

        {/* Search Bar with Filters */}
        <div className="mb-6">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="Buscar por código, paciente ou médico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg">
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => {
                        setSearchTerm(suggestion);
                        setShowFilters(true);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Filters Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                Filtros
                {(statusFilter.length > 0 || dateFrom || dateTo) && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    {statusFilter.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
                  </span>
                )}
              </Button>
              {(statusFilter.length > 0 || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={clearFilters}
                >
                  <X className="h-4 w-4" />
                  Limpar
                </Button>
              )}
            </div>
            
            {/* Filters Panel */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {['pending', 'partial', 'completed', 'active', 'expired', 'used'].map((status) => (
                      <Button
                        key={status}
                        variant={statusFilter.includes(status) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusFilterChange(status)}
                      >
                        {getStatusText(status)}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Date Range Filters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Inicial</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "PPP") : "Selecione uma data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Final</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "PPP") : "Selecione uma data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{searchResults.count}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Receitas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {searchResults.data.filter(p => p.status === "active").length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Medicamentos Prescritos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {searchResults.data.reduce((acc, p) => acc + (p.medications?.length || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receituários Assemed (da Teleconsulta) */}
        {(assemedReceituarios.length > 0 || loadingReceituarios || receituariosError) && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Video className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-heading font-semibold text-foreground">
                Receituários da Teleconsulta
              </h2>
            </div>

            {loadingReceituarios ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-3" />
                  <p className="text-sm text-muted-foreground">Buscando receituários das consultas...</p>
                </CardContent>
              </Card>
            ) : receituariosError && assemedReceituarios.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileText className="mx-auto h-8 w-8 text-destructive mb-3" />
                  <p className="text-sm text-destructive">{receituariosError}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assemedReceituarios.map((rec, index) => (
                  <Card key={`assemed-rec-${rec.consultationId}-${index}`} className="bg-card border-border/50 hover:shadow-card transition-all">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary shrink-0" />
                          <CardTitle className="text-base">
                            Consulta #{rec.consultationId}
                          </CardTitle>
                        </div>
                        <Badge className="bg-green-100 text-green-700 border-green-200 shrink-0">
                          Concluída
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Especialidade</p>
                          <p className="font-medium">{rec.especialidade}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Profissional</p>
                          <p className="font-medium">{rec.profissional || "—"}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground text-xs">Data</p>
                          <p className="font-medium">
                            {(() => {
                              try {
                                return format(new Date(rec.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
                              } catch {
                                return rec.data;
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border/50">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => window.open(rec.urlPdf, "_blank")}
                        >
                          <Download className="h-4 w-4" />
                          Baixar Receituário
                          <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prescriptions List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">
                  Carregando receitas...
                </p>
              </CardContent>
            </Card>
          ) : searchResults.data.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma receita encontrada
                </p>
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      setSearchTerm("");
                      clearFilters();
                    }}
                  >
                    Limpar busca
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {searchResults.data.map((prescription) => (
                <Card
                  key={prescription.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => navigate(`/prescription/${prescription.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl">
                          {prescription.id}
                        </CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-2 mt-2">
                            <User className="h-4 w-4" />
                            <span>{prescription.patient_name}</span>
                          </div>
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(prescription.status)}>
                        {getStatusText(prescription.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-3">
                      {/* Doctor Info */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Dr(a). {prescription.doctor_name}</span>
                        <span className="text-xs">• CRM {prescription.doctor_crm}</span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Emitida em {new Date(prescription.date).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {/* Medications */}
                      {prescription.medications && prescription.medications.length > 0 && (
                        <div className="pt-3 border-t">
                          <p className="text-sm font-medium mb-2">
                            Medicamentos ({prescription.medications.length}):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {prescription.medications.map((med, index) => (
                              <Badge key={index} variant="outline">
                                {med.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="pt-3 flex justify-end">
                        <Button variant="ghost" size="sm" className="text-primary">
                          Ver Detalhes
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Pagination */}
              {searchResults.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={searchResults.page === 1}
                    onClick={() => goToPage(searchResults.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {searchResults.page} de {searchResults.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={searchResults.page === searchResults.totalPages}
                    onClick={() => goToPage(searchResults.page + 1)}
                  >
                    Próxima
                    <ChevronRightIcon className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <ActiveConsultationBanner accessToken={assemedAccessToken} />
    </div>
  );
};

export default Prescriptions;
