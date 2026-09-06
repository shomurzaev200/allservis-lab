import { a as STATUS_TONE, i as STATUS_LABEL } from "./domain-zUVhUtxQ.mjs";
import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as cn } from "./utils-CH_OWAWG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-badge-BMr_179i.js
var import_jsx_runtime = require_jsx_runtime();
function OrderBadge({ status }) {
	const tone = STATUS_TONE[status];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "cyan" && "bg-accent/15 text-accent", tone === "ok" && "bg-ok/15 text-ok", tone === "warn" && "bg-warn/15 text-warn", tone === "danger" && "bg-danger/15 text-danger", tone === "muted" && "bg-surface-2 text-muted"),
		children: STATUS_LABEL[status]
	});
}
function OnlineDot({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "inline-flex items-center gap-1.5 text-xs font-medium",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-full", status === "online" && "bg-ok pulse-dot", status === "busy" && "bg-warn", status === "offline" && "bg-subtle", status === "blocked" && "bg-danger") }), status === "online" ? "ONLINE" : status === "busy" ? "BUSY" : status === "blocked" ? "BLOCKED" : "OFFLINE"]
	});
}
//#endregion
export { OrderBadge as n, OnlineDot as t };
