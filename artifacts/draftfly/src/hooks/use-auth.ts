import { useQuery } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  teamId: string;
  avatar?: string;
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch auth state");
  return res.json() as Promise<AuthUser>;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  return { user: user ?? null, loading: isLoading };
}
