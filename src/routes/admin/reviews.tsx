import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listReviews } from "@/lib/server/api";

export const Route = createFileRoute("/admin/reviews")({ component: ReviewsPage });

function ReviewsPage() {
  const { data = [], isPending } = useQuery({
    queryKey: ["reviews"],
    queryFn: () => listReviews(),
  });
  const avg = data.length ? data.reduce((s, r) => s + Number(r.rating), 0) / data.length : 0;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl">Отзывы</h1>
        <p className="text-sm text-muted">
          {data.length} оценок · среднее {avg.toFixed(2)}
        </p>
      </div>
      {isPending ? <p className="text-sm text-muted">Загрузка…</p> : null}
      <div className="space-y-2">
        {data.map((r) => (
          <article key={r.id} className="glass-card rounded-xl p-4">
            <p className="text-sm">
              {r.master_name} · оценка {r.rating}/5 · заявка №{r.public_no}
            </p>
            <p className="mt-1 text-sm text-muted">{r.comment}</p>
            <p className="mt-2 text-xs text-subtle">{r.client_name}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
