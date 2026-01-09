import { Link } from "react-router-dom";
import { Heart, Phone, Mail, MapPin, Instagram, Facebook, Linkedin, Twitter, LucideIcon } from "lucide-react";
import { CONTATO, REDES_SOCIAIS, ESPECIALIDADES } from "@/data/landingContent";

// Navigation links data
const NAV_LINKS = [
  { label: "Início", href: "/" },
  { label: "Nossos Planos", href: "/planos" },
  { label: "Como Funciona", href: "/como-funciona" },
  { label: "Medicamentos", href: "/medicamentos" },
  { label: "Blog", href: "/blog" },
];

// Service tags displayed in the footer
const SERVICE_TAGS = ["Home Care", "Telemedicina", "UTI Móvel"];

// Social media configuration
const SOCIAL_LINKS: Array<{ key: keyof typeof REDES_SOCIAIS; icon: LucideIcon }> = [
  { key: "instagram", icon: Instagram },
  { key: "facebook", icon: Facebook },
  { key: "linkedin", icon: Linkedin },
  { key: "twitter", icon: Twitter },
];

// Certification badges data
const CERTIFICATIONS = [
  { title: "Acreditação", primary: "Selo de Qualidade ANS", secondary: "98,3% de conformidade" },
  { title: "Desde", primary: "2011", secondary: "15+ anos de experiência" },
  { title: "Cobertura", primary: "DF e Entorno", secondary: "Atendimento presencial e online" },
];

// Legal links data
const LEGAL_LINKS = [
  { label: "Termos de Uso", href: "/termos" },
  { label: "Política de Privacidade", href: "/privacidade" },
  { label: "Política de Cancelamento", href: "/cancelamento" },
];

function Footer(): JSX.Element {
  return (
    <footer className="bg-foreground text-background">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="gradient-hero rounded-xl p-2.5">
                <Heart className="h-6 w-6 text-primary-foreground" fill="currentColor" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-bold">Novità</h2>
                <p className="text-xs text-background/60">Home Care & Telemedicina</p>
              </div>
            </div>
            <p className="text-background/70 text-sm leading-relaxed">
              Cuidamos da sua saúde com excelência há mais de 15 anos. Oferecemos serviços de Home Care e
              Telemedicina com a dedicação e qualidade que você e sua família merecem.
            </p>
            <div className="flex gap-2 text-xs flex-wrap">
              {SERVICE_TAGS.map((tag) => (
                <span key={tag} className="bg-primary/20 text-primary px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex gap-4">
              {SOCIAL_LINKS.map(({ key, icon: Icon }) => {
                const url = REDES_SOCIAIS[key];
                if (url) {
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                }
                return null;
              })}
              {/* Placeholder icons when no social links configured */}
              {SOCIAL_LINKS.every(({ key }) => !REDES_SOCIAIS[key]) && (
                <>
                  {SOCIAL_LINKS.slice(0, 3).map(({ key, icon: Icon }) => (
                    <span key={key} className="p-2 rounded-lg bg-background/10 cursor-not-allowed opacity-50">
                      <Icon className="h-5 w-5" />
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Navegação</h3>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Specialties */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Especialidades</h3>
            <ul className="space-y-2">
              {ESPECIALIDADES.items.slice(0, 8).map((especialidade) => (
                <li key={especialidade}>
                  <span className="text-background/70 text-sm">{especialidade}</span>
                </li>
              ))}
              <li>
                <Link
                  to="/planos"
                  className="text-primary hover:text-primary/80 transition-colors text-sm font-medium"
                >
                  Ver todas →
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Contato</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{CONTATO.telefone}</p>
                  <p className="text-xs text-background/60">Atendimento 24h</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm">{CONTATO.email}</p>
                  <p className="text-xs text-background/60 mt-1">{CONTATO.emailTelemedicina}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-background/70">
                    {CONTATO.endereco.logradouro}<br />
                    {CONTATO.endereco.complemento}<br />
                    {CONTATO.endereco.bairro}, {CONTATO.endereco.cidade} - {CONTATO.endereco.estado}
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Certifications */}
        <div className="border-t border-background/10 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-8">
            {CERTIFICATIONS.map((cert) => (
              <div key={cert.title} className="text-center">
                <p className="text-xs text-background/60 mb-2">{cert.title}</p>
                <div className="bg-background/10 rounded-lg px-4 py-2">
                  <p className="text-sm font-medium">{cert.primary}</p>
                  <p className="text-xs text-background/60">{cert.secondary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-background/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-background/60">
              © {new Date().getFullYear()} Novità Home Care Serviços em Saúde LTDA. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm text-background/60">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="hover:text-background transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
