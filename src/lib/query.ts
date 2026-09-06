import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 4000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});
