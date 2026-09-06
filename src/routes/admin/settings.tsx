import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="font-display text-2xl">Настройки</h1>
        <p className="text-sm text-muted">Правила диспетчерской All Servis.</p>
      </div>
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-medium">Назначение мастера</h2>
        <p className="mt-2 text-sm text-muted">
          Автоматический подбор выключен и не включается. Администратор всегда выбирает мастера сам.
        </p>
        <p className="mt-4 inline-flex h-10 items-center rounded-full bg-danger/15 px-3 text-sm text-danger">
          Auto-assign: OFF
        </p>
      </section>
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-medium">Присутствие</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>Heartbeat кабинета мастера — 20 секунд</li>
          <li>Offline, если нет сигнала 2 минуты и нет активного заказа</li>
          <li>Busy — есть назначенный или выполняемый заказ</li>
        </ul>
      </section>
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-medium">Город</h2>
        <p className="mt-2 text-sm text-muted">Ташкент. Расстояние на карте и в диалоге назначения — подсказка, не автовыбор.</p>
      </section>
    </div>
  );
}
