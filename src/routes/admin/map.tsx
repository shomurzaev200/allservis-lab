import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMapData } from "@/lib/server/api";
import { MapCanvas } from "@/components/admin/map-canvas";

export const Route = createFileRoute("/admin/map")({ component: MapPage });

function MapPage() {
  const { data, isPending } = useQuery({
    queryKey: ["map"],
    queryFn: () => getMapData(),
  });
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl">Карта</h1>
        <p className="text-sm text-muted">Клиент — заявка — мастер. Линии только после назначения администратором.</p>
      </div>
      {isPending || !data ? (
        <div className="h-96 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <MapCanvas masters={data.masters} orders={data.orders} />
      )}
    </div>
  );
}
