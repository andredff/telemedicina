import { useEffect, useState } from "react";
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
  showBackButton?: boolean;
  backTo?: string | number;
  title?: string;
}

const Header = ({ 
  isAuthenticated = false, 
  onLogout, 
  cartItemsCount,
  showBackButton = false,
  backTo = "/dashboard",
  title
}: HeaderProps) => {
  const navigate = useNavigate();
  const [internalCartCount, setInternalCartCount] = useState(0);

  // Auto-load cart count if not provided
  useEffect(() => {
    if (cartItemsCount === undefined && isAuthenticated) {
      const loadCartCount = () => {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        setInternalCartCount(cart.length);
      };
      
      loadCartCount();
      
      // Listen for storage changes (when cart is updated in other components)
      const handleStorageChange = () => loadCartCount();
      window.addEventListener("storage", handleStorageChange);
      
      // Also listen for custom cart update events
      window.addEventListener("cartUpdated", handleStorageChange);
      
      return () => {
        window.removeEventListener("storage", handleStorageChange);
        window.removeEventListener("cartUpdated", handleStorageChange);
      };
    }
  }, [cartItemsCount, isAuthenticated]);

  const displayCartCount = cartItemsCount ?? internalCartCount;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (onLogout) {
      onLogout();
    }
    navigate("/auth");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-card/95 backdrop-blur-md border-b border-border/50 shadow-soft">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 relative">
        <div className="flex items-center gap-3">
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
        </div>

        {title && (
          <span className="absolute left-1/2 -translate-x-1/2 font-heading font-semibold text-foreground">
            {title}
          </span>
        )}

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
                {displayCartCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {displayCartCount}
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
                  <DropdownMenuItem onClick={() => navigate("/perfil")}>
                    <User className="mr-2 h-4 w-4" />
                    Meu Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/meu-plano")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Meu Plano
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/orders")}>
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
