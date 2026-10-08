"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  const [convexQueryClient] = useState(
    () => new ConvexQueryClient(new ConvexReactClient(convexUrl))
  );
  // ...
  return (
    <ConvexProvider client={convexQueryClient.convexClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConvexProvider>
  );
}
