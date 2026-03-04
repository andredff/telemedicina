import { useState, useCallback } from "react";
import { assemedClient, AssemedApiError } from "@/integrations/assemed/client";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { RegisterPatientRequest } from "@/integrations/assemed/types";

interface ProfileData {
  full_name: string;
  email: string;
  cpf?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
}

/**
 * Hook para autenticação no Assemed (telemedicina).
 * Faz login com CPF; se paciente não existir (404), registra automaticamente e tenta login novamente.
 */
export function useAssemedAuth() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(
    async (cpf: string, profile: ProfileData): Promise<string> => {
      setIsAuthenticating(true);
      setError(null);

      const cleanCpf = cpf.replace(/\D/g, "");

      try {
        // Tenta login direto
        const loginResponse = await assemedClient.login(cleanCpf);

        if (loginResponse?.accessToken) {
          return loginResponse.accessToken;
        }

        throw new Error("Falha ao autenticar na plataforma de telemedicina");
      } catch (loginError: unknown) {
        // Detecta paciente não cadastrado: 400 "não cadastrado", 401, 404, "not found", "não encontrado"
        const isNotRegistered =
          (loginError instanceof AssemedApiError &&
            (loginError.statusCode === 404 ||
              loginError.statusCode === 401 ||
              (loginError.statusCode === 400 &&
                loginError.message.toLowerCase().includes("não cadastrado")))) ||
          (loginError instanceof Error &&
            (loginError.message.includes("404") ||
              loginError.message.includes("401") ||
              loginError.message.toLowerCase().includes("unauthorized") ||
              loginError.message.toLowerCase().includes("not found") ||
              loginError.message.toLowerCase().includes("não encontrado") ||
              loginError.message.toLowerCase().includes("não cadastrado")));

        if (!isNotRegistered) {
          const msg =
            loginError instanceof Error
              ? loginError.message
              : "Erro ao autenticar na telemedicina";
          setError(msg);
          throw loginError;
        }

        // Log: tentando cadastro após falha no login
        logger.info("[useAssemedAuth] Paciente não cadastrado, tentando registro automático...", {
          cpf: cleanCpf.substring(0, 3) + "***",
          errorCode: loginError instanceof AssemedApiError ? loginError.statusCode : "unknown",
        });

        // Registra o paciente
        const registerData = buildRegisterData(cleanCpf, profile);
        await assemedClient.registerPatient(registerData);

        // Salva o emailTelemedicina no banco de dados do usuário
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("profiles")
              .update({ email_telemedicina: registerData.email })
              .eq("id", user.id);
            logger.info("[useAssemedAuth] emailTelemedicina salvo:", registerData.email);
          }
        } catch (updateErr) {
          logger.error("[useAssemedAuth] Erro ao salvar emailTelemedicina:", updateErr);
        }

        // Login após registro
        const retryLogin = await assemedClient.login(cleanCpf);

        if (retryLogin?.accessToken) {
          return retryLogin.accessToken;
        }

        throw new Error("Falha ao autenticar após cadastro na telemedicina");
      } finally {
        setIsAuthenticating(false);
      }
    },
    [],
  );

  return { authenticate, isAuthenticating, error };
}

function buildRegisterData(
  cpf: string,
  profile: ProfileData,
): Omit<RegisterPatientRequest, "identificacao" | "cnpj"> {
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
    nome: profile.full_name.substring(0, 250),
    cpf,
    dataNascimento,
    sexo: gender,
    telefone: telefone.substring(0, 20),
    email: aliasEmail.substring(0, 100),
  };
}
