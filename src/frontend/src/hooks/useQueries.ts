import type { DriverProfile, Trip } from "@/backend";
import { useActor } from "@/hooks/useActor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useGetTrips() {
  const { actor, isFetching } = useActor();
  return useQuery<Trip[]>({
    queryKey: ["trips"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLast10Trips();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddTrip() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      distance_km: number;
      waiting_minutes: number;
      total_fare: number;
      is_night: boolean;
    }) => {
      if (!actor) throw new Error("Not connected");
      await actor.addTrip(
        params.distance_km,
        BigInt(Math.round(params.waiting_minutes)),
        params.total_fare,
        params.is_night,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

export function useGetProfile() {
  const { actor, isFetching } = useActor();
  return useQuery<DriverProfile>({
    queryKey: ["profile"],
    queryFn: async () => {
      if (!actor) return { name: "", phone: "", licence: "", upi_id: "" };
      return actor.getProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useSaveProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: DriverProfile) => {
      if (!actor) throw new Error("Not connected");
      await actor.saveProfile(
        params.name,
        params.phone,
        params.licence,
        params.upi_id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
