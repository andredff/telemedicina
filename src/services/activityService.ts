import { supabase } from "@/integrations/supabase/client";

export interface Activity {
  id: string;
  type: "consultation" | "prescription" | "order";
  title: string;
  description: string;
  time: string;
  icon: string;
}

export async function getRecentActivities(userId: string, limit: number = 10): Promise<Activity[]> {
  const activities: Activity[] = [];

  try {
    // Buscar pedidos do usuário (consulta SQL direta)
    const { data: orders, error: ordersError } = await supabase
      .rpc("get_user_orders", { user_id_param: userId, limit_param: limit })
      .select("*");

    // Se a função RPC não existir, usar consulta direta
    if (ordersError) {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, status, created_at, total_amount")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      ordersData?.forEach((o: any) => {
        const statusMap: Record<string, string> = {
          pending: "Pendente",
          processing: "Em preparação",
          shipped: "Enviado",
          delivered: "Entregue",
          cancelled: "Cancelado",
        };
        activities.push({
          id: o.id,
          type: "order",
          title: "Pedido de medicamentos",
          description: `${statusMap[o.status] || o.status} • R$ ${((o.total_amount || 0) / 100).toFixed(2)}`,
          time: formatDate(o.created_at),
          icon: "Pill",
        });
      });
    } else {
      orders?.forEach((o: any) => {
        const statusMap: Record<string, string> = {
          pending: "Pendente",
          processing: "Em preparação",
          shipped: "Enviado",
          delivered: "Entregue",
          cancelled: "Cancelado",
        };
        activities.push({
          id: o.id,
          type: "order",
          title: "Pedido de medicamentos",
          description: `${statusMap[o.status] || o.status} • R$ ${((o.total_amount || 0) / 100).toFixed(2)}`,
          time: formatDate(o.created_at),
          icon: "Pill",
        });
      });
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
  }

  // Se não houver dados, retornar array vazio (você pode adicionar mock aqui temporariamente)
  return activities;
}

function formatDate(dateString: string): string {
  if (!dateString) return "Recentemente";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return diffMins <= 0 ? "Agora mesmo" : `Há ${diffMins} minuto(s)`;
  }
  if (diffHours < 24) {
    return `Hoje, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1) {
    return `Ontem, ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Função para obter atividades com fallback para mock (temporário)
export async function getRecentActivitiesWithFallback(
  userId: string,
  limit: number = 10
): Promise<Activity[]> {
  const activities = await getRecentActivities(userId, limit);

  // Se não houver dados, retornar mock vazio (para incentivar usuário a criar dados)
  if (activities.length === 0) {
    return [];
  }

  return activities;
}
