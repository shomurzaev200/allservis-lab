import { STATUS_LABEL, STATUS_TONE, type OrderStatus, type OnlineStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function OrderBadge({ status }: { status: OrderStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "cyan" && "bg-accent/15 text-accent",
        tone === "ok" && "bg-ok/15 text-ok",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "muted" && "bg-surface-2 text-muted",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OnlineDot({ status }: { status: OnlineStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span
        className={cn(
          "size-2 rounded-full",
          status === "online" && "bg-ok pulse-dot",
          status === "busy" && "bg-warn",
          status === "offline" && "bg-subtle",
          status === "blocked" && "bg-danger",
        )}
      />
      {status === "online" ? "ONLINE" : status === "busy" ? "BUSY" : status === "blocked" ? "BLOCKED" : "OFFLINE"}
    </span>
  );
}
