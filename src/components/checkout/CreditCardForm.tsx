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
    .refine((val) => /^[\d\s]+$/.test(val), "Número do cartão inválido"),
  holder: z
    .string()
    .min(3, "Nome do titular é obrigatório")
    .refine(
      (val) => /^[A-Za-zÀ-ÿ\s]+$/.test(val),
      "Nome deve conter apenas letras"
    ),
  expirationDate: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/20\d{2}$/, "Data inválida (MM/AAAA)"),
  securityCode: z
    .string()
    .min(3, "CVV inválido")
    .max(4, "CVV inválido")
    .regex(/^\d+$/, "CVV deve conter apenas números"),
});

type CardFormData = z.infer<typeof cardFormSchema>;

interface CreditCardFormProps {
  onSubmit: (data: CardFormData & { brand: CardBrand }) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

const CARD_BRAND_ICONS: Record<CardBrand, string> = {
  Visa: "💳",
  Master: "💳",
  Amex: "💳",
  Elo: "💳",
  Hipercard: "💳",
  Diners: "💳",
  Discover: "💳",
  JCB: "💳",
};

export function CreditCardForm({
  onSubmit,
  isLoading = false,
  submitLabel = "Pagar",
}: CreditCardFormProps) {
  const [detectedBrand, setDetectedBrand] = useState<CardBrand | null>(null);

  const form = useForm<CardFormData>({
    resolver: zodResolver(cardFormSchema),
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
                  <FormControl>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="0000 0000 0000 0000"
                        className="pl-10 pr-12"
                        maxLength={19}
                        onChange={(e) => {
                          field.onChange(formatCardNumber(e.target.value));
                        }}
                      />
                      {detectedBrand && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium">
                          {detectedBrand}
                        </span>
                      )}
                    </div>
                  </FormControl>
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
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="Como está impresso no cartão"
                        className="pl-10 uppercase"
                        onChange={(e) => {
                          field.onChange(e.target.value.toUpperCase());
                        }}
                      />
                    </div>
                  </FormControl>
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
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          placeholder="MM/AAAA"
                          className="pl-10"
                          maxLength={7}
                          onChange={(e) => {
                            field.onChange(formatExpirationDate(e.target.value));
                          }}
                        />
                      </div>
                    </FormControl>
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
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <Lock className="h-4 w-4" />
              <span>Seus dados estão protegidos com criptografia SSL</span>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
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
