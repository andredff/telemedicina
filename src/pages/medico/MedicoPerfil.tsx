import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  User, Mail, Phone, CreditCard, Calendar, MapPin, Home, Hash,
  Stethoscope, Award, BookOpen, Loader2, Shield, Lock, KeyRound,
  Languages, CheckCircle2,
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────────────────

const ESTADOS_BR = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA',
  'MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN',
  'RO','RR','RS','SC','SE','SP','TO',
];

const ESPECIALIDADES = [
  'Acupuntura','Alergia e Imunologia','Anestesiologia','Angiologia',
  'Cancerologia (Oncologia)','Cardiologia','Cirurgia Cardiovascular',
  'Cirurgia da Mão','Cirurgia de Cabeça e Pescoço',
  'Cirurgia do Aparelho Digestivo','Cirurgia Geral','Cirurgia Pediátrica',
  'Cirurgia Plástica','Cirurgia Torácica','Cirurgia Vascular','Clínica Médica',
  'Coloproctologia','Dermatologia','Endocrinologia e Metabologia','Endoscopia',
  'Gastroenterologia','Genética Médica','Geriatria',
  'Ginecologia e Obstetrícia','Hematologia e Hemoterapia','Homeopatia',
  'Infectologia','Mastologia','Medicina de Emergência',
  'Medicina de Família e Comunidade','Medicina do Trabalho',
  'Medicina Esportiva','Medicina Física e Reabilitação',
  'Medicina Intensiva','Medicina Legal e Perícia Médica',
  'Medicina Nuclear','Medicina Preventiva e Social','Nefrologia',
  'Neurocirurgia','Neurologia','Nutrologia','Oftalmologia',
  'Ortopedia e Traumatologia','Otorrinolaringologia','Patologia',
  'Patologia Clínica/Medicina Laboratorial','Pediatria','Pneumologia',
  'Psiquiatria','Radiologia e Diagnóstico por Imagem','Radioterapia',
  'Reumatologia','Urologia',
];

const IDIOMAS = ['Português', 'Inglês', 'Espanhol', 'Francês', 'Alemão', 'Italiano'];

const ANOS = Array.from({ length: 50 }, (_, i) => String(new Date().getFullYear() - i));

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'perfil' | 'crm' | 'certificado' | 'seguranca';

interface PersonalForm {
  full_name: string;
  email: string;
  cpf: string;
  birth_date: string;
  gender: string;
  phone: string;
  zip_code: string;
  address: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface ProfessionalForm {
  crm: string;
  crm_state: string;
  rqe: string;
  specialty: string;
  sub_specialty: string;
  institution: string;
  graduation_year: string;
  experience_years: string;
  bio: string;
  languages: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCPF(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11);
  return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatPhone(v: string) {
  const n = v.replace(/\D/g, '').slice(0, 11);
  if (n.length <= 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
}

function formatCEP(v: string) {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{3})/, '$1-$2');
}

function getInitials(name: string) {
  return name.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'MD';
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="font-semibold text-sm text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MedicoConfiguracoes() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as TabId) || 'perfil';
  const setTab = (t: TabId) => setSearchParams(t === 'perfil' ? {} : { tab: t });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [passwords, setPasswords] = useState({ newPass: '', confirmPass: '' });

  const [personal, setPersonal] = useState<PersonalForm>({
    full_name: '', email: '', cpf: '', birth_date: '', gender: '',
    phone: '', zip_code: '', address: '', number: '',
    complement: '', neighborhood: '', city: '', state: '',
  });

  const [professional, setProfessional] = useState<ProfessionalForm>({
    crm: '', crm_state: 'SP', rqe: '', specialty: '', sub_specialty: '',
    institution: '', graduation_year: '', experience_years: '',
    bio: '', languages: ['Português'],
  });

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        const meta = user.user_metadata || {};
        const p = profile as Record<string, unknown> | null;

        setPersonal({
          full_name: (p?.full_name as string) || '',
          email: (p?.email as string) || user.email || '',
          cpf: (p?.cpf as string) || (meta.cpf as string) || '',
          birth_date: (p?.birth_date as string) || (meta.birth_date as string) || '',
          gender: (p?.gender as string) || (meta.gender as string) || '',
          phone: (p?.phone as string) || (meta.phone as string) || '',
          zip_code: (p?.zip_code as string) || '',
          address: (p?.address as string) || '',
          number: (p?.number as string) || '',
          complement: (p?.complement as string) || '',
          neighborhood: (p?.neighborhood as string) || '',
          city: (p?.city as string) || '',
          state: (p?.state as string) || '',
        });

        const dp = (meta.doctor_profile as Partial<ProfessionalForm>) || {};
        setProfessional({
          crm: dp.crm || '',
          crm_state: dp.crm_state || 'SP',
          rqe: dp.rqe || '',
          specialty: dp.specialty || '',
          sub_specialty: dp.sub_specialty || '',
          institution: dp.institution || '',
          graduation_year: dp.graduation_year || '',
          experience_years: dp.experience_years || '',
          bio: dp.bio || '',
          languages: dp.languages?.length ? dp.languages : ['Português'],
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── CEP lookup ────────────────────────────────────────────────────────────

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setPersonal(prev => ({
          ...prev,
          address: data.logradouro || prev.address,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch {
      // silent — not critical
    } finally {
      setFetchingCep(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const setP = (field: keyof PersonalForm, value: string) =>
    setPersonal(prev => ({ ...prev, [field]: value }));

  const setPro = <K extends keyof ProfessionalForm>(field: K, value: ProfessionalForm[K]) =>
    setProfessional(prev => ({ ...prev, [field]: value }));

  const toggleLanguage = (lang: string) => {
    setProfessional(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang],
    }));
  };

  // ── Save personal ─────────────────────────────────────────────────────────

  const savePersonal = async () => {
    if (!personal.full_name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('profiles').update({
        full_name: personal.full_name.trim(),
        zip_code: personal.zip_code || null,
        address: personal.address || null,
        number: personal.number || null,
        complement: personal.complement || null,
        neighborhood: personal.neighborhood || null,
        city: personal.city || null,
        state: personal.state || null,
        updated_at: new Date().toISOString(),
      } as Parameters<ReturnType<typeof supabase.from>['update']>[0])
        .eq('id', user.id);

      await supabase.auth.updateUser({
        data: {
          full_name: personal.full_name.trim(),
          cpf: personal.cpf || null,
          birth_date: personal.birth_date || null,
          gender: personal.gender || null,
          phone: personal.phone || null,
        },
      });

      toast({ title: 'Dados pessoais atualizados!', description: 'Suas informações foram salvas.' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Save professional ─────────────────────────────────────────────────────

  const saveProfessional = async () => {
    if (!professional.crm.trim()) {
      toast({ title: 'CRM obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const crmFormatted = `CRM/${professional.crm_state} ${professional.crm.trim()}`;
      await supabase.auth.updateUser({
        data: {
          doctor_profile: professional,
          doctor_crm: crmFormatted,
        },
      });
      toast({ title: 'Informações profissionais atualizadas!', description: 'Suas credenciais foram salvas.' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = getInitials(personal.full_name || 'MD');
  const crmDisplay = professional.crm
    ? `CRM/${professional.crm_state} ${professional.crm}`
    : null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* ── Profile header card ── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground leading-tight truncate">
                {personal.full_name || 'Médico'}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {professional.specialty || 'Especialidade não informada'}
              </p>
              {crmDisplay && (
                <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/15">
                  <Award className="h-3 w-3" />
                  {crmDisplay}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 bg-muted/50 rounded-xl p-1 border border-border/50">
        {([
          { id: 'perfil' as TabId, label: 'Perfil Médico', icon: User },
          { id: 'crm' as TabId, label: 'CRM/RQE', icon: Stethoscope },
          { id: 'certificado' as TabId, label: 'Certificado Digital', icon: Shield },
          { id: 'seguranca' as TabId, label: 'Segurança', icon: KeyRound },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white text-foreground shadow-sm border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: PERFIL MÉDICO
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'perfil' && (
        <div className="space-y-5">

          {/* Identificação */}
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle icon={User} title="Identificação" description="Nome, documento e dados básicos" />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="grid gap-2">
                <Label htmlFor="full_name">Nome Completo *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="full_name"
                    value={personal.full_name}
                    onChange={e => setP('full_name', e.target.value)}
                    placeholder="Dr. Nome Completo"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      value={personal.email}
                      disabled
                      className="pl-9 bg-muted/50 text-muted-foreground"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Não é possível alterar o e-mail aqui.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Celular</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={personal.phone}
                      onChange={e => setP('phone', formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className="pl-9"
                      maxLength={15}
                    />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cpf"
                      value={personal.cpf}
                      onChange={e => setP('cpf', formatCPF(e.target.value))}
                      placeholder="000.000.000-00"
                      className="pl-9"
                      maxLength={14}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="birth_date">Data de Nascimento</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="birth_date"
                      type="date"
                      value={personal.birth_date}
                      onChange={e => setP('birth_date', e.target.value)}
                      className="pl-9"
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2 max-w-[200px]">
                <Label htmlFor="gender">Sexo</Label>
                <Select value={personal.gender} onValueChange={v => setP('gender', v)}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </CardContent>
          </Card>

          {/* Endereço */}
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle icon={MapPin} title="Endereço" description="Endereço residencial ou de atendimento" />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="flex gap-3 items-end">
                <div className="grid gap-2 w-48">
                  <Label htmlFor="zip_code">CEP</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="zip_code"
                      value={personal.zip_code}
                      onChange={e => {
                        const v = formatCEP(e.target.value);
                        setP('zip_code', v);
                        if (v.replace(/\D/g, '').length === 8) lookupCep(v);
                      }}
                      placeholder="00000-000"
                      className="pl-9"
                      maxLength={9}
                    />
                  </div>
                </div>
                {fetchingCep && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-2.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando...
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="address">Logradouro</Label>
                  <div className="relative">
                    <Home className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      value={personal.address}
                      onChange={e => setP('address', e.target.value)}
                      placeholder="Rua, Avenida, Travessa..."
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="number">Número</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="number"
                      value={personal.number}
                      onChange={e => setP('number', e.target.value)}
                      placeholder="123"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="complement">Complemento</Label>
                  <Input
                    id="complement"
                    value={personal.complement}
                    onChange={e => setP('complement', e.target.value)}
                    placeholder="Apto, Sala, Bloco..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="neighborhood">Bairro</Label>
                  <Input
                    id="neighborhood"
                    value={personal.neighborhood}
                    onChange={e => setP('neighborhood', e.target.value)}
                    placeholder="Bairro"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={personal.city}
                    onChange={e => setP('city', e.target.value)}
                    placeholder="Cidade"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="state">Estado</Label>
                  <Select value={personal.state} onValueChange={v => setP('state', v)}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </CardContent>
          </Card>

          <Button onClick={savePersonal} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar dados pessoais
          </Button>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: CRM/RQE
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'crm' && (
        <div className="space-y-5">

          {/* Registro médico */}
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle
                icon={Award}
                title="Registro Médico"
                description="CRM e qualificações obrigatórias pelo CFM"
              />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="crm">Número do CRM *</Label>
                  <Input
                    id="crm"
                    value={professional.crm}
                    onChange={e => setPro('crm', e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    maxLength={10}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="crm_state">Estado do CRM</Label>
                  <Select value={professional.crm_state} onValueChange={v => setPro('crm_state', v)}>
                    <SelectTrigger id="crm_state">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_BR.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {professional.crm && (
                <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  CRM/{professional.crm_state} {professional.crm}
                </div>
              )}

              <div className="grid gap-2 max-w-xs">
                <Label htmlFor="rqe">
                  RQE <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="rqe"
                  value={professional.rqe}
                  onChange={e => setPro('rqe', e.target.value.replace(/\D/g, ''))}
                  placeholder="Registro de Qualificação de Especialista"
                  maxLength={10}
                />
                <p className="text-xs text-muted-foreground">
                  Obrigatório para especialistas reconhecidos pelo CFM.
                </p>
              </div>

            </CardContent>
          </Card>

          {/* Especialidade */}
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle
                icon={Stethoscope}
                title="Especialidade"
                description="Área de atuação principal e sub-especialidade"
              />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="grid gap-2">
                <Label htmlFor="specialty">Especialidade Principal</Label>
                <Select value={professional.specialty} onValueChange={v => setPro('specialty', v)}>
                  <SelectTrigger id="specialty">
                    <SelectValue placeholder="Selecione sua especialidade" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {ESPECIALIDADES.map(esp => (
                      <SelectItem key={esp} value={esp}>{esp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sub_specialty">
                  Sub-especialidade <span className="text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Input
                  id="sub_specialty"
                  value={professional.sub_specialty}
                  onChange={e => setPro('sub_specialty', e.target.value)}
                  placeholder="Ex: Cardiologia Intervencionista, Neonatologia..."
                />
              </div>

            </CardContent>
          </Card>

          {/* Formação */}
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle
                icon={BookOpen}
                title="Formação Acadêmica"
                description="Graduação e experiência profissional"
              />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="institution">Instituição de Formação</Label>
                  <Input
                    id="institution"
                    value={professional.institution}
                    onChange={e => setPro('institution', e.target.value)}
                    placeholder="Universidade / Faculdade de Medicina"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="graduation_year">Ano de Conclusão</Label>
                  <Select value={professional.graduation_year} onValueChange={v => setPro('graduation_year', v)}>
                    <SelectTrigger id="graduation_year">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {ANOS.map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2 max-w-[160px]">
                <Label htmlFor="experience_years">Anos de Experiência</Label>
                <Input
                  id="experience_years"
                  type="number"
                  min="0"
                  max="60"
                  value={professional.experience_years}
                  onChange={e => setPro('experience_years', e.target.value)}
                  placeholder="0"
                />
              </div>

            </CardContent>
          </Card>

          {/* Perfil profissional */}
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle
                icon={User}
                title="Perfil Profissional"
                description="Apresentação e idiomas de atendimento"
              />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">Apresentação / Bio</Label>
                  <span className="text-xs text-muted-foreground">
                    {professional.bio.length}/600
                  </span>
                </div>
                <Textarea
                  id="bio"
                  value={professional.bio}
                  onChange={e => {
                    if (e.target.value.length <= 600) setPro('bio', e.target.value);
                  }}
                  placeholder="Descreva sua experiência, abordagem de atendimento, áreas de interesse e diferenciais profissionais..."
                  className="min-h-[120px] resize-none"
                />
              </div>

              <div className="grid gap-3">
                <Label>Idiomas de Atendimento</Label>
                <div className="flex flex-wrap gap-2">
                  {IDIOMAS.map(lang => {
                    const active = professional.languages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary'
                        }`}
                      >
                        <Languages className="h-3.5 w-3.5" />
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>

            </CardContent>
          </Card>

          <Button onClick={saveProfessional} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar informações profissionais
          </Button>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: CERTIFICADO DIGITAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'certificado' && (
        <div className="space-y-5">
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground mb-2">Certificado Digital ICP-Brasil</h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mb-4">
                O certificado digital permite assinar documentos médicos com validade jurídica conforme a Resolução CFM nº 2.299/2021. Integração com tokens A3 e certificados em nuvem em breve.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Token A3 (USB)
                </div>
                <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Certificado em nuvem
                </div>
                <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Válidade ICP-Brasil
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                Em desenvolvimento — disponível em breve.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SEGURANÇA
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'seguranca' && (
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <SectionTitle icon={KeyRound} title="Alterar Senha" description="Mantenha sua conta protegida com uma senha forte" />
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="grid gap-2">
                <Label htmlFor="new_pass">Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new_pass"
                    type="password"
                    value={passwords.newPass}
                    onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9"
                    minLength={8}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirm_pass">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm_pass"
                    type="password"
                    value={passwords.confirmPass}
                    onChange={e => setPasswords(p => ({ ...p, confirmPass: e.target.value }))}
                    placeholder="Repita a nova senha"
                    className={`pl-9 ${passwords.confirmPass && passwords.newPass !== passwords.confirmPass ? 'border-red-300' : ''}`}
                  />
                </div>
                {passwords.confirmPass && passwords.newPass !== passwords.confirmPass && (
                  <p className="text-xs text-red-500">As senhas não coincidem.</p>
                )}
              </div>

              <Button
                onClick={async () => {
                  if (!passwords.newPass || passwords.newPass.length < 8) {
                    toast({ title: 'Senha muito curta', description: 'Mínimo 8 caracteres.', variant: 'destructive' });
                    return;
                  }
                  if (passwords.newPass !== passwords.confirmPass) {
                    toast({ title: 'As senhas não coincidem', variant: 'destructive' });
                    return;
                  }
                  setSaving(true);
                  try {
                    const { error } = await supabase.auth.updateUser({ password: passwords.newPass });
                    if (error) throw error;
                    toast({ title: 'Senha alterada com sucesso!' });
                    setPasswords({ newPass: '', confirmPass: '' });
                  } catch {
                    toast({ title: 'Erro ao alterar senha', variant: 'destructive' });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || !passwords.newPass || passwords.newPass !== passwords.confirmPass}
                className="w-full sm:w-auto"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Alterar senha
              </Button>

            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Sua conta está protegida</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Autenticação segura via Supabase com criptografia end-to-end. Use uma senha única e forte.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
