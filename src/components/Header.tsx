import { ShoppingCart, User, LogOut, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  isAuthenticated?: boolean;
  onLogout?: () => void;
  cartItemsCount?: number;
}

const Header = ({ isAuthenticated = false, onLogout, cartItemsCount = 0 }: HeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate(isAuthenticated ? "/dashboard" : "/")}
        >
          <div className="flex items-center gap-2">
            <div className="bg-primary rounded-lg p-2">
              <Pill className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Novità</h1>
              <p className="text-xs text-muted-foreground -mt-1">Medicamentos</p>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/cart")}
              >
                <ShoppingCart className="h-5 w-5" />
                {cartItemsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {cartItemsCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/profile")}
              >
                <User className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
};

export default Header;
