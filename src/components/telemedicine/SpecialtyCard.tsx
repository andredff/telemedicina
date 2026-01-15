import { Stethoscope, Baby, Heart, Brain, Bone, Eye, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Specialty } from "@/integrations/assemed";

interface SpecialtyCardProps {
  specialty: Specialty;
  onSelect: (specialty: Specialty) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

// Mapeamento de icones por nome de especialidade
const specialtyIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Clínico Geral": Stethoscope,
  "Clinico Geral": Stethoscope,
  Pediatria: Baby,
  Cardiologia: Heart,
  Neurologia: Brain,
  Ortopedia: Bone,
  Oftalmologia: Eye,
  default: Stethoscope,
};

function getSpecialtyIcon(name: string) {
  return specialtyIcons[name] || specialtyIcons.default;
}

export function SpecialtyCard({
  specialty,
  onSelect,
  isLoading = false,
  disabled = false,
}: SpecialtyCardProps) {
  const Icon = getSpecialtyIcon(specialty.nome);
  const isIncluded = specialty.precoConsulta === 0;

  return (
    <Card
      className={`
        relative overflow-hidden transition-all
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-card hover:border-primary/20 cursor-pointer"}
      `}
    >
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Icone */}
          <div
            className={`
              w-16 h-16 rounded-2xl flex items-center justify-center
              ${isIncluded ? "bg-primary/10" : "bg-accent/10"}
            `}
          >
            <Icon
              className={`h-8 w-8 ${isIncluded ? "text-primary" : "text-accent"}`}
            />
          </div>

          {/* Nome e tipo profissional */}
          <div>
            <h3 className="font-semibold text-lg text-foreground">
              {specialty.nome}
            </h3>
            <p className="text-sm text-muted-foreground">
              {specialty.tipoProfissionalDescricao}
            </p>
          </div>

          {/* Preco ou incluido no plano */}
          {isIncluded ? (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              Incluido no plano
            </Badge>
          ) : (
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                R$ {specialty.precoConsulta.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-muted-foreground">por consulta</p>
            </div>
          )}

          {/* Botao */}
          <Button
            onClick={() => onSelect(specialty)}
            disabled={disabled || isLoading}
            className="w-full mt-2"
            variant={isIncluded ? "default" : "outline"}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Iniciando...
              </>
            ) : (
              "Iniciar Consulta"
            )}
          </Button>
        </div>

        {/* Indicador de triagem */}
        {specialty.triagem && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-xs">
              Triagem
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
