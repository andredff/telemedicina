import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface ProfileData {
  cpf?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
}

/**
 * Hook para gerenciar autenticação no Assemed de forma centralizada.
 * Retorna o accessToken que pode ser usado pelo ActiveConsultationBanner.
 */
export function useAssemedToken() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const authenticate = useCallback(async (profile: ProfileData) => {
    if (!profile?.cpf || !profile?.email) return;

    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return;

    setIsLoading(true);
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      
      // Tenta login direto
      try {
        const loginResponse = await assemedClient.login(cpf);
        console.log("[useAssemedToken] Login Assemed OK, token obtido");
        setAccessToken(loginResponse.accessToken);
        assemedClient.setAccessToken(loginResponse.accessToken);
      } catch (loginError: unknown) {
        // Se falhar com 404 (não cadastrado), silently fail
        const isNotRegistered =
          (loginError instanceof Error &&
            (loginError.message.includes("404") ||
              loginError.message.toLowerCase().includes("não cadastrado")));

        if (isNotRegistered) {
          logger.info("[useAssemedToken] Paciente não registrado no Assemed");
        } else {
          logger.error("[useAssemedToken] Erro ao fazer login:", loginError);
        }
        setAccessToken(null);
      }
    } catch (err) {
      logger.error("[useAssemedToken] Erro ao autenticar:", err);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchProfileAndAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[useAssemedToken] Sem usuário autenticado");
        return;
      }

      try {
        // Tenta buscar do banco
        let dbData: Record<string, unknown> | null = null;
        try {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          dbData = data;
        } catch {
          // tabela pode não ter todos os campos, segue com metadata
        }

        // Busca CPF de múltiplas fontes
        const cpf = 
          (dbData?.cpf as string) || 
          (user.user_metadata?.cpf as string) || 
          (user.identities?.[0]?.identity_data?.cpf as string) ||
          "";
        
        const profile: ProfileData = {
          cpf,
          email: (dbData?.email as string) || user.email || "",
          full_name: (dbData?.full_name as string) || (user.user_metadata?.full_name as string) || "",
          phone: (dbData?.phone as string) || (user.user_metadata?.phone as string) || "",
          birth_date: (dbData?.birth_date as string) || (user.user_metadata?.birth_date as string) || "",
          gender: (dbData?.gender as string) || (user.user_metadata?.gender as string) || "",
        };

        console.log("[useAssemedToken] Perfil carregado, CPF:", cpf ? `${cpf.substring(0, 3)}***` : "vazio");
        await authenticate(profile);
      } catch (error) {
        logger.error("[useAssemedToken] Erro ao buscar perfil:", error);
      }
    };

    fetchProfileAndAuth();
  }, [authenticate]);

  return { accessToken, isLoading };
}
