import { Link } from "react-router-dom";
import { Heart, Phone, Mail, MapPin, Instagram, Facebook, Linkedin } from "lucide-react";

const Footer = () => {
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
              </div>
            </div>
            <p className="text-background/70 text-sm leading-relaxed">
              Cuidamos da sua saúde com excelência há 15 anos. Oferecemos serviços de Home Care e 
              Telemedicina com a dedicação e qualidade que sua família merece.
            </p>
            <div className="flex gap-2 text-xs">
              <span className="bg-primary/20 text-primary px-3 py-1 rounded-full">Home Care</span>
              <span className="bg-primary/20 text-primary px-3 py-1 rounded-full">Telemedicina</span>
            </div>
            <div className="flex gap-4">
              <a href="#" className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-background/10 hover:bg-background/20 transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Navegação</h3>
            <ul className="space-y-3">
              {[
                { label: "Início", href: "/" },
                { label: "Nossos Planos", href: "/planos" },
                { label: "Como Funciona", href: "/como-funciona" },
                { label: "Medicamentos", href: "/medicamentos" },
                { label: "Blog", href: "/blog" },
              ].map((link) => (
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

          {/* Services */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Serviços</h3>
            <ul className="space-y-3">
              {[
                "Consultas Online 24h",
                "Especialistas",
                "Receitas Digitais",
                "Medicamentos em Casa",
                "Check-up Anual",
              ].map((service) => (
                <li key={service}>
                  <span className="text-background/70 text-sm">{service}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading font-semibold text-lg mb-4">Contato</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium">(61) 3333-3333</p>
                  <p className="text-xs text-background/60">Seg-Sex: 8h às 18h</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm">contato@novitatelemedicina.com.br</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-background/70">
                    SEPS 709/909 - Asa Sul<br />
                    Brasília - DF
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-background/10 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-background/60">
              © {new Date().getFullYear()} Novità Home Care & Telemedicina. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm text-background/60">
              <Link to="/termos" className="hover:text-background transition-colors">
                Termos de Uso
              </Link>
              <Link to="/privacidade" className="hover:text-background transition-colors">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;