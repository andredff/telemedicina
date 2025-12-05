import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Heart, Phone } from "lucide-react";

const PublicHeader = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const navLinks = [
    { href: "/", label: "Início" },
    { href: "/planos", label: "Planos" },
    { href: "/como-funciona", label: "Como Funciona" },
    { href: "/medicamentos", label: "Medicamentos" },
    { href: "/blog", label: "Blog" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border/50 shadow-soft">
      <div className="container mx-auto">
        <div className="flex h-20 items-center justify-between px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 gradient-hero rounded-xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
              <div className="relative gradient-hero rounded-xl p-2.5">
                <Heart className="h-6 w-6 text-primary-foreground" fill="currentColor" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold text-foreground tracking-tight">
                Novità
              </h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive(link.href)
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <a 
              href="tel:+556133333333" 
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="h-4 w-4" />
              <span>(61) 3333-3333</span>
            </a>
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button 
              className="gradient-hero text-primary-foreground shadow-glow hover:shadow-elevated transition-all"
              onClick={() => navigate("/planos")}
            >
              Assine Agora
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 text-foreground" />
            ) : (
              <Menu className="h-6 w-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden border-t border-border/50 bg-card pb-4 animate-fade-in">
            <nav className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-3 px-4 pt-4 border-t border-border/50">
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                Entrar
              </Button>
              <Button 
                className="w-full gradient-hero text-primary-foreground"
                onClick={() => navigate("/planos")}
              >
                Assine Agora
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default PublicHeader;