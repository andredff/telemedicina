import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Lock, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { detectCardBrand, type CardBrand } from "@/services/paymentService";

const cardFormSchema = z.object({
  cardNumber: z
    .string()
    .min(16, "Número do cartão inválido")
    .max(19, "Número do cartão inválido")
    .refine((val) => /^(\d{4}\s){3}\d{4}$/.test(val), "Número do cartão inválido"),
  holder: z
    .string()
    .min(3, "Nome do titular é obrigatório")
    .max(25, "Nome deve ter no máximo 25 caracteres")
    .refine(
      (val) => /^[A-Z\s]+$/.test(val),
      "Nome deve conter apenas letras sem acentuação"
    ),
  expirationDate: z
    .string()
    .min(7, "Data inválida (MM/AAAA)")
    .regex(/^(0[1-9]|1[0-2])\/20\d{2}$/, "Data inválida (MM/AAAA)"),
  securityCode: z
    .string()
    .min(3, "CVV deve ter 3-4 dígitos")
    .max(4, "CVV deve ter 3-4 dígitos")
    .regex(/^\d+$/, "CVV deve conter apenas números"),
});

type CardFormData = z.infer<typeof cardFormSchema>;

interface CreditCardFormProps {
  onSubmit: (data: CardFormData & { brand: CardBrand }) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

const CARD_BRAND_CONFIG: Record<CardBrand, { name: string; color: string; bgColor: string }> = {
  Visa: { name: "Visa", color: "#1A1F71", bgColor: "#1A1F71" },
  Master: { name: "Mastercard", color: "#EB001B", bgColor: "#EB001B" },
  Amex: { name: "Amex", color: "#006FCF", bgColor: "#006FCF" },
  Elo: { name: "Elo", color: "#FF7800", bgColor: "#FF7800" },
  Hipercard: { name: "Hipercard", color: "#8B1D3A", bgColor: "#8B1D3A" },
  Diners: { name: "Diners", color: "#004AAD", bgColor: "#004AAD" },
  Discover: { name: "Discover", color: "#FF6000", bgColor: "#FF6000" },
  JCB: { name: "JCB", color: "#B61B28", bgColor: "#B61B28" },
};

function CardBrandFlag({ brand, size = "sm" }: { brand: CardBrand; size?: "sm" | "md" }) {
  const config = CARD_BRAND_CONFIG[brand];
  const sizeClass = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  
  return (
    <span 
      className={`inline-flex items-center justify-center font-bold rounded ${sizeClass}`}
      style={{ 
        backgroundColor: config.bgColor, 
        color: "white",
        minWidth: size === "md" ? "60px" : "45px"
      }}
    >
      {config.name}
    </span>
  );
}

export function CreditCardForm({
  onSubmit,
  isLoading = false,
  submitLabel = "Pagar",
}: CreditCardFormProps) {
  const [detectedBrand, setDetectedBrand] = useState<CardBrand | null>(null);

  const form = useForm<CardFormData>({
    resolver: zodResolver(cardFormSchema),
    mode: "onChange",
    defaultValues: {
      cardNumber: "",
      holder: "",
      expirationDate: "",
      securityCode: "",
    },
  });

  const cardNumber = form.watch("cardNumber");

  useEffect(() => {
    const brand = detectCardBrand(cardNumber);
    setDetectedBrand(brand);
  }, [cardNumber]);

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    const groups = numbers.match(/.{1,4}/g);
    return groups ? groups.join(" ").slice(0, 19) : "";
  };

  const formatExpirationDate = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length >= 2) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 6)}`;
    }
    return numbers;
  };

  const handleSubmit = (data: CardFormData) => {
    if (!detectedBrand) {
      form.setError("cardNumber", { message: "Bandeira do cartão não reconhecida" });
      return;
    }
    onSubmit({ ...data, brand: detectedBrand });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Dados do Cartão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="cardNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número do Cartão</FormLabel>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="0000 0000 0000 0000"
                        className="pl-10 pr-12"
                        maxLength={19}
                        onChange={(e) => {
                          field.onChange(formatCardNumber(e.target.value));
                        }}
                      />
                    </FormControl>
                    {detectedBrand && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CardBrandFlag brand={detectedBrand} />
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="holder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Titular</FormLabel>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="JOAO SILVA (sem acentos, como no cartão)"
                        className="pl-10 uppercase"
                        maxLength={25}
                        onChange={(e) => {
                          field.onChange(
                            e.target.value
                              .toUpperCase()
                              .normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                              .replace(/[^A-Z\s]/g, "")
                          );
                        }}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validade</FormLabel>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="MM/AAAA"
                          className="pl-10"
                          maxLength={7}
                          onChange={(e) => {
                            field.onChange(formatExpirationDate(e.target.value));
                          }}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="securityCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CVV</FormLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="123"
                          className="pl-10"
                          maxLength={4}
                          onChange={(e) => {
                            field.onChange(e.target.value.replace(/\D/g, ""));
                          }}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Lock className="h-4 w-4" />
              <span>Seus dados estão protegidos com criptografia SSL</span>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !form.formState.isValid}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processando...
                </span>
              ) : (
                submitLabel
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
