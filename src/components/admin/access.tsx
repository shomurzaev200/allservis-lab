import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAccess } from "@/lib/server/api";

export type PermKey = "invite" | "delete" | "assign" | "finance" | "bots";

const NONE = { invite: false, delete: false, assign: false, finance: false, bots: false };

export function useAccess() {
  const q = useQuery({ queryKey: ["access"], queryFn: () => getAccess(), refetchInterval: 20_000 });
  const role = q.data?.role ?? null;
  const owner = role === "owner";
  const perms = q.data?.perms ?? NONE;
  function allowed(perm: PermKey) {
    if (owner) return true;
    return Boolean(perms[perm]);
  }
  return {
    ...q,
    role,
    owner,
    perms,
    allowed,
    denied: q.data && q.data.ok === false ? q.data.error : null,
  };
}

export function NeedPerm({
  perm,
  children,
  fallback,
}: {
  perm: PermKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const a = useAccess();
  if (a.isPending) return <p className="p-6 text-sm text-muted">Проверяю доступ…</p>;
  if (!a.allowed(perm)) {
    return (
      fallback ?? (
        <p className="p-6 text-sm text-warn">
          Нет права. Попросите владельца включить это в разделе «Команда». Пустая галочка = запрет, обойти нельзя.
        </p>
      )
    );
  }
  return <>{children}</>;
}
