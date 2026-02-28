// Serviço para integração com API Assemed
import { supabase } from "@/integrations/supabase/client";

const API_BASE_URL = "https://dev-api-assemed.azurewebsites.net";
const CLIENT_ID = import.meta.env.VITE_ASSEMED_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_ASSEMED_CLIENT_SECRET;
const CNPJ_CLIENT = import.meta.env.VITE_ASSEMED_CNPJ_CLIENT;

export type ConsultaStatus = "AGUARDANDO" | "EM_ATENDIMENTO" | "CONCLUIDO" | "CANCELADO";

export interface Consulta {
  id: number;
  status: ConsultaStatus;
  pacienteToken: string;
  dataHoraCriacao: string;
  especialidade: string;
}

export async function cadastrarPaciente({ nome, cpf, email, telefone, dataNascimento, sexo }: {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  dataNascimento: string;
  sexo: "M" | "F";
}) {
  const res = await fetch(`${API_BASE_URL}/api/Pacientes/cadastro-externo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identificacao: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
      nome, cpf, cnpj: CNPJ_CLIENT, dataNascimento, sexo, telefone, email
    })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function loginPaciente(cpf: string) {
  const res = await fetch(`${API_BASE_URL}/api/Auth/login-externo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpfPaciente: cpf, clientId: CLIENT_ID, clientSecret: CLIENT_SECRET })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function obterEspecialidades(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/Especialidades/obterTodas`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ pageSize: 0, pageIndex: 0 })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function criarAtendimento({ accessToken, pacienteId, especialidadeId, tipoProfissional }: {
  accessToken: string;
  pacienteId: number;
  especialidadeId: number;
  tipoProfissional: number;
}) {
  const res = await fetch(`${API_BASE_URL}/api/Atendimentos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ tipoAtendimento: 1, tipoProfissional, especialidadeId, pacienteId, exames: [] })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function obterConsultas(accessToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/Atendimentos/obter`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ pageSize: 10, pageIndex: 0 })
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}
