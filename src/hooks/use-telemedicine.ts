import { useQuery } from "@tanstack/react-query";
import {
  checkSubscriptionStatus,
  canAccessTelemedicine as checkCanAccessTelemedicine,
  type SubscriptionStatus,
} from "@/services/telemedicineService";

// ==========================================
// HOOK: useSubscriptionStatus
// ==========================================

export function useSubscriptionStatus(userId: string | null) {
  return useQuery<SubscriptionStatus>({
    queryKey: ["subscription-status", userId],
    queryFn: () => checkSubscriptionStatus(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}

// ==========================================
// HOOK: useCanAccessTelemedicine
// ==========================================

export function useCanAccessTelemedicine(userId: string | null) {
  return useQuery({
    queryKey: ["can-access-telemedicine", userId],
    queryFn: () => checkCanAccessTelemedicine(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
