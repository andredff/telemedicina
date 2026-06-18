import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RBAC } from '@/integrations/supabase/adminClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { playNotificationSound } from '@/lib/sound';
import DoctorStatusToggle, { useDoctorStatus } from '@/components/medico/DoctorStatusToggle';
import {
  LayoutDashboard, LogOut, Stethoscope, User, CalendarDays,
  ChevronDown, ChevronRight, Clock, Users, FileText,
  Settings, HelpCircle, ClipboardList, Menu, X,
} from 'lucide-react';

// ─── Nav types ────────────────────────────────────────────────────────────────

type NavLeaf = {
  kind: 'leaf';
  id: string;
  icon: React.ElementType;
  label: string;
  path: string;
  exact?: boolean;
  badge?: number;
};

type NavGroup = {
  kind: 'group';
  id: string;
  icon: React.ElementType;
  label: string;
  basePath: string;
  children: { id: string; label: string; path: string }[];
};

type NavEntry = NavLeaf | NavGroup;
type NavSection = { title: string; entries: NavEntry[] };

// ─── Active helpers ───────────────────────────────────────────────────────────

function isLeafActive(entry: NavLeaf, pathname: string, search: string): boolean {
  if (entry.exact) return pathname === entry.path;
  return pathname.startsWith(entry.path);
}

function isChildActive(childPath: string, pathname: string, search: string): boolean {
  const [p, q] = childPath.split('?');
  if (!q) return pathname === p && !new URLSearchParams(search).get('tab');
  const tab = new URLSearchParams(q).get('tab');
  const currentTab = new URLSearchParams(search).get('tab');
  return pathname === p && tab === currentTab;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DoctorInfo { full_name: string; email: string; specialty?: string }

export default function MedicoLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const alertedIds = useRef<Set<string>>(new Set());

  // Online/offline gates the queue alerts; "Silenciar" snoozes the sound only.
  const { online } = useDoctorStatus();
  const onlineRef = useRef(online);
  onlineRef.current = online;
  const soundMutedUntilRef = useRef(0);

  // ── Nav sections (defined inside to access pendingCount) ─────────────────

  const SECTIONS: NavSection[] = [
    {
      title: 'Principal',
      entries: [
        { kind: 'leaf', id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/medico', exact: true },
        { kind: 'leaf', id: 'sala-espera', icon: Clock, label: 'Sala de Espera', path: '/medico/sala-espera', badge: pendingCount },
      ],
    },
    {
      title: 'Atendimento',
      entries: [
        {
          kind: 'group', id: 'consultas', icon: ClipboardList, label: 'Consultas',
          basePath: '/medico/consultas',
          children: [
            { id: 'andamento', label: 'Em andamento', path: '/medico/consultas' },
            { id: 'finalizadas', label: 'Finalizadas', path: '/medico/consultas?tab=finalizadas' },
            { id: 'canceladas', label: 'Canceladas', path: '/medico/consultas?tab=canceladas' },
          ],
        },
        { kind: 'leaf', id: 'agenda', icon: CalendarDays, label: 'Agenda', path: '/medico/agenda' },
        { kind: 'leaf', id: 'pacientes', icon: Users, label: 'Pacientes', path: '/medico/pacientes' },
      ],
    },
    {
      title: 'Documentos',
      entries: [
        { kind: 'leaf', id: 'documentos', icon: FileText, label: 'Documentos emitidos', path: '/medico/prescricoes' },
      ],
    },
    {
      title: 'Conta',
      entries: [
        {
          kind: 'group', id: 'configuracoes', icon: Settings, label: 'Configurações',
          basePath: '/medico/configuracoes',
          children: [
            { id: 'perfil-med', label: 'Perfil médico', path: '/medico/configuracoes' },
            { id: 'crm-rqe', label: 'CRM/RQE', path: '/medico/configuracoes?tab=crm' },
            { id: 'cert', label: 'Certificado digital', path: '/medico/configuracoes?tab=certificado' },
            { id: 'seg', label: 'Segurança', path: '/medico/configuracoes?tab=seguranca' },
          ],
        },
        { kind: 'leaf', id: 'suporte', icon: HelpCircle, label: 'Suporte', path: '/medico/suporte' },
      ],
    },
  ];

  // ── Auth + data load ─────────────────────────────────────────────────────

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/auth'); return; }

        const [isDoctor, isAdmin] = await Promise.all([
          RBAC.hasRole(user.id, RBAC.ROLES.DOCTOR),
          RBAC.isAdmin(user.id),
        ]);
        if (!isDoctor && !isAdmin) { navigate('/dashboard'); return; }

        const { data: profile } = await supabase
          .from('profiles').select('full_name, email').eq('id', user.id).single();

        const dp = user.user_metadata?.doctor_profile as { specialty?: string } | undefined;
        setDoctorInfo({
          full_name: profile?.full_name || user.email?.split('@')[0] || 'Médico',
          email: profile?.email || user.email || '',
          specialty: dp?.specialty || '',
        });

        const { count } = await supabase
          .from('consultations').select('id', { count: 'exact', head: true }).eq('status', 'waiting_doctor');
        setPendingCount(count ?? 0);
      } catch {
        navigate('/auth');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  // ── Realtime waiting-room alert (active across the whole doctor area) ─────
  // Plays a sound + toast and keeps the sidebar badge in sync whenever a
  // patient joins or leaves the queue, regardless of which page is open.
  useEffect(() => {
    const channel = supabase
      .channel('medico-layout-fila-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'consultations' },
        (payload) => {
          // New consultations enter triage ('waiting_attendant'); they reach the
          // doctor queue only when an attendant routes them (the UPDATE handler).
          const p = payload.new as { id: string; status: string };
          if (p.status !== 'waiting_doctor') return;
          // (handled below via the shared alert path on UPDATE)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'consultations' },
        (payload) => {
          const prev = payload.old as { status?: string };
          const next = payload.new as { id: string; patient_name: string; status: string };
          const enteredQueue = prev?.status !== 'waiting_doctor' && next.status === 'waiting_doctor';
          const leftQueue    = prev?.status === 'waiting_doctor' && next.status !== 'waiting_doctor';

          if (enteredQueue) {
            if (alertedIds.current.has(next.id)) return;
            alertedIds.current.add(next.id);
            setPendingCount(c => c + 1);

            // Offline: keep the badge in sync but stay silent.
            if (!onlineRef.current) return;
            if (Date.now() >= soundMutedUntilRef.current) playNotificationSound();

            toast({
              title: 'Novo paciente na fila',
              description: `${next.patient_name} foi encaminhado pela triagem.`,
              action: (
                <ToastAction
                  altText="Silenciar avisos por 10 minutos"
                  onClick={() => { soundMutedUntilRef.current = Date.now() + 10 * 60_000; }}
                >
                  Silenciar 10 min
                </ToastAction>
              ),
            });
          } else if (leftQueue) {
            alertedIds.current.delete(next.id);
            setPendingCount(c => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  // Reminder loop removed: a single beep per new patient (above) plus the
  // persistent sidebar badge replaces the every-30s beep, which caused alert
  // fatigue and ignored the doctor's online status.

  // ── Auto-expand groups based on current location ─────────────────────────

  useEffect(() => {
    const toExpand = new Set<string>();
    SECTIONS.forEach(sec => {
      sec.entries.forEach(entry => {
        if (entry.kind === 'group' && location.pathname.startsWith(entry.basePath)) {
          toExpand.add(entry.id);
        }
      });
    });
    if (toExpand.size > 0) {
      setExpanded(prev => new Set([...prev, ...toExpand]));
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close the mobile drawer whenever the route (or tab) changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  const toggleGroup = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderLeaf = (entry: NavLeaf) => {
    const active = isLeafActive(entry, location.pathname, location.search);
    return (
      <button
        key={entry.id}
        onClick={() => navigate(entry.path)}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all
          ${active ? 'bg-primary text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
        `}
      >
        <span className="flex items-center gap-2.5">
          <entry.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{entry.label}</span>
        </span>
        {entry.badge != null && entry.badge > 0 && (
          <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${active ? 'bg-white/25 text-white' : 'bg-amber-500 text-white'}`}>
            {entry.badge}
          </span>
        )}
      </button>
    );
  };

  const renderGroup = (entry: NavGroup) => {
    const groupActive = location.pathname.startsWith(entry.basePath);
    const isOpen = expanded.has(entry.id);

    return (
      <div key={entry.id}>
        <button
          onClick={() => { toggleGroup(entry.id); navigate(entry.basePath); }}
          className={`
            w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all
            ${groupActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
          `}
        >
          <span className="flex items-center gap-2.5">
            <entry.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{entry.label}</span>
          </span>
          {isOpen
            ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          }
        </button>

        {isOpen && (
          <div className="ml-3 mt-0.5 mb-1 border-l-2 border-gray-100 pl-3 space-y-0.5">
            {entry.children.map(child => {
              const active = isChildActive(child.path, location.pathname, location.search);
              return (
                <button
                  key={child.id}
                  onClick={() => navigate(child.path)}
                  className={`
                    w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                    ${active
                      ? 'text-primary bg-primary/8 font-semibold'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                    }
                  `}
                >
                  {child.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Layout ──────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Mobile top bar (hamburger) ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4">
        <button
          onClick={() => setMobileNavOpen(true)}
          aria-label="Abrir menu de navegação"
          className="p-1.5 -ml-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Stethoscope className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-sm font-bold text-foreground leading-none">Novità</p>
        </div>
        {pendingCount > 0 && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500 text-white">
            {pendingCount} na fila
          </span>
        )}
      </header>

      {/* ── Mobile drawer backdrop ── */}
      {mobileNavOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar (static on desktop, slide-in drawer on mobile) ── */}
      <aside
        className={`w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen z-50
          fixed inset-y-0 left-0 transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0
          ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >

        {/* Logo */}
        <div className="px-4 py-3.5 border-b border-gray-100 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground leading-none">Novità</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Área do Médico</p>
            </div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Fechar menu"
            className="lg:hidden p-1 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 min-h-0">
          {SECTIONS.map(section => (
            <div key={section.title}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.entries.map(entry =>
                  entry.kind === 'leaf' ? renderLeaf(entry) : renderGroup(entry)
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* Status toggle */}
        <div className="border-t border-gray-100 pt-2 shrink-0">
          <DoctorStatusToggle />
        </div>

        {/* Footer */}
        <div className="px-2 pb-3 border-t border-gray-100 pt-2 shrink-0 space-y-1">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate leading-none">
                {doctorInfo?.full_name}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate leading-none">
                {doctorInfo?.specialty || 'Médico'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start text-gray-500 hover:text-gray-700 h-8 text-xs"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* ── Main content (offset below the fixed mobile top bar) ── */}
      <div className="flex-1 overflow-y-auto min-h-screen pt-14 lg:pt-0">
        <Outlet />
      </div>
    </div>
  );
}
