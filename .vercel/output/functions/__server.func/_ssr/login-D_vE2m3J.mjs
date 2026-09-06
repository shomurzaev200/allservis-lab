import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as GROK_PROVIDERS } from "./server-CErzAQtl.mjs";
import { r as signIn } from "./client-B40BzJxt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-D_vE2m3J.js
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "grid min-h-dvh place-items-center bg-bg px-6 text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass-card w-full max-w-sm space-y-4 rounded-xl p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-xs tracking-[0.2em] text-accent",
					children: "ALL SERVIS"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-2xl font-medium",
					children: "Вход администратора"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Только авторизованный оператор видит заявки, карту и парк мастеров."
				}),
				GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => signIn(p.providerId, { callbackURL: "/admin" }),
					className: "h-11 w-full rounded-md bg-accent text-sm font-medium text-primary-fg",
					children: ["Войти через ", p.label]
				}, p.providerId))
			]
		})
	});
}
//#endregion
export { Login as component };
