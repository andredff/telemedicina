
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { AuthService } from "@/integrations/assemed/authService";
import { getTokenExpiration, isTokenExpired } from "@/integrations/assemed/tokenUtils";

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
  const [isLoading, setIsLoading] = useState(true);


  const authenticate = useCallback(async (profile: ProfileData) => {
    if (!profile?.cpf || !profile?.email) return;
    const cpf = profile.cpf.replace(/\D/g, "");
    if (cpf.length !== 11) return;

    setIsLoading(true);
    try {
      const { assemedClient } = await import("@/integrations/assemed/client");
      assemedClient.setCpfPaciente(cpf);

      // 1. Tenta restaurar token do storage (somente se pertencer ao mesmo CPF)
      const stored = AuthService.getTokenForCpf(cpf);
      if (stored && stored.accessToken && !AuthService.isTokenExpired(stored)) {
        setAccessToken(stored.accessToken);
        assemedClient.setAccessToken(stored.accessToken);
        return;
      }

      // 2. Faz login-externo e salva token
      try {
        const loginResponse = await assemedClient.login(cpf);
        const expiresAt = getTokenExpiration(loginResponse.accessToken) || (Date.now() + 60 * 60 * 1000);
        AuthService.saveToken(loginResponse.accessToken, expiresAt, cpf);
        setAccessToken(loginResponse.accessToken);
        assemedClient.setAccessToken(loginResponse.accessToken);
        return;
      } catch (loginError: unknown) {
        // Se falhar com 401/404 (não cadastrado), tenta cadastro e login novamente
        const isNotRegistered =
          (loginError instanceof Error &&
            (loginError.message.includes("401") ||
              loginError.message.includes("404") ||
              loginError.message.toLowerCase().includes("unauthorized") ||
              loginError.message.toLowerCase().includes("não cadastrado")));

        if (isNotRegistered) {
          logger.info("[useAssemedToken] Paciente não registrado, tentando cadastro...");
          try {
            // Tenta cadastrar e fazer login novamente
            const registerData = buildRegisterData(cpf, profile);
            await assemedClient.registerPatient(registerData);
            logger.info("[useAssemedToken] Cadastro realizado, tentando login...");
            const retryLogin = await assemedClient.login(cpf);
            const expiresAt = getTokenExpiration(retryLogin.accessToken) || (Date.now() + 60 * 60 * 1000);
            AuthService.saveToken(retryLogin.accessToken, expiresAt, cpf);
            setAccessToken(retryLogin.accessToken);
            assemedClient.setAccessToken(retryLogin.accessToken);
            return;
          } catch (registerErr) {
            logger.error("[useAssemedToken] Erro ao cadastrar/relogar:", registerErr);
          }
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
        setIsLoading(false);
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
        // Se authenticate não setou token (CPF vazio/inválido), garante isLoading = false
        if (!cpf || cpf.replace(/\D/g, "").length !== 11) {
          setIsLoading(false);
        }
      } catch (error) {
        logger.error("[useAssemedToken] Erro ao buscar perfil:", error);
        setIsLoading(false);
      }
    };

    fetchProfileAndAuth();
  }, [authenticate]);

  return { accessToken, isLoading };
}

function buildRegisterData(
  cpf: string,
  profile: ProfileData,
) {
  const gender = profile.gender === "F" ? "F" : "M";

  let dataNascimento = "1990-01-01T00:00:00.000Z";
  if (profile.birth_date) {
    if (profile.birth_date.includes("/")) {
      const [day, month, year] = profile.birth_date.split("/");
      dataNascimento = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`;
    } else if (profile.birth_date.includes("-")) {
      dataNascimento = profile.birth_date.includes("T")
        ? profile.birth_date
        : `${profile.birth_date}T00:00:00.000Z`;
    }
  }

  let telefone = profile.phone?.replace(/\D/g, "") || "";
  if (telefone.length < 10) {
    telefone = "00000000000";
  }

  // Gera alias de email para telemedicina
  let username = "";
  if (profile.email) {
    username = profile.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  }
  const aliasEmail = `paciente+${username}@novitatelemedicina.com.br`;

  return {
    nome: (profile.full_name || "Paciente").substring(0, 250),
    cpf,
    dataNascimento,
    sexo: gender,
    telefone: telefone.substring(0, 20),
    email: aliasEmail.substring(0, 100),
  };
}
