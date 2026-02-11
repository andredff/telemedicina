import { ShoppingCart, User, LogOut, Settings, CreditCard, HelpCircle, Package } from "lucide-react";
import LogoNovita from "@/assets/logo-novita.png";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

interface HeaderProps {
  isAuthenticated?: boolean;
  onLogout?: () => void;
  cartItemsCount?: number;
}

const Header = ({ isAuthenticated = false, onLogout, cartItemsCount = 0 }: HeaderProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) {
      onLogout();
    }
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border/50 shadow-soft">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(isAuthenticated ? "/dashboard" : "/")}
        >
          <img 
            src={LogoNovita} 
            alt="Novità" 
            className="h-10 w-auto"
          />
        </div>

        <nav className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/cart")}
                type="button"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {cartItemsCount}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" type="button">
                    <Settings className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 z-[100]">
                  <DropdownMenuLabel>Configurações</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/planos")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Meu Plano
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/pedidos")}>
                    <Package className="mr-2 h-4 w-4" />
                    Meus Pedidos
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/como-funciona")}>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Ajuda
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-2"
                type="button"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
};

export default Header;
