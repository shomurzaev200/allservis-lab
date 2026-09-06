import { createFileRoute } from "@tanstack/react-router";
import { handleTelegramWebhook } from "@/lib/server/telegram";

export const Route = createFileRoute("/api/telegram/$hookId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const secret = request.headers.get("x-telegram-bot-api-secret-token");
        let body: unknown = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: false }), { status: 400 });
        }
        const result = await handleTelegramWebhook(params.hookId, secret, body as never);
        return Response.json(result);
      },
      GET: () => Response.json({ ok: true, service: "allservis-telegram" }),
    },
  },
});
