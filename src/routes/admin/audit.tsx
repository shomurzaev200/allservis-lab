import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAudit } from "@/lib/server/api";

export const Route = createFileRoute("/admin/audit")({ component: AuditPage });

function AuditPage() {
  const { data = [], isPending } = useQuery({
    queryKey: ["audit"],
    queryFn: () => listAudit(),
  });
  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="font-display text-2xl">Журнал действий</h1>
      {isPending ? <p className="text-sm text-muted">Загрузка…</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-3">Время</th>
              <th className="px-3 py-3">Кто</th>
              <th className="px-3 py-3">Действие</th>
              <th className="px-3 py-3">Объект</th>
              <th className="px-3 py-3">Было</th>
              <th className="px-3 py-3">Стало</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleString("ru-RU")}</td>
                <td className="px-3 py-2 text-xs">{r.actor_name || r.actor_email || "—"}</td>
                <td className="px-3 py-2">{r.action}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.object_type} #{r.object_id}
                </td>
                <td className="px-3 py-2 text-xs text-muted">{r.old_value ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.new_value ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
