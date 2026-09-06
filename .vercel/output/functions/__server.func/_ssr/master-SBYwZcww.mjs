import { o as __toESM } from "../_runtime.mjs";
import { a as serviceById } from "./catalog-Cq__2iHb.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { _ as masterAdvance, h as listOrders, p as listMasters, u as heartbeatMaster, v as masterDecision } from "./api-B2R1vwTw.mjs";
import { n as OrderBadge } from "./status-badge-BMr_179i.mjs";
import { t as Button } from "./button-PrOHLo0L.mjs";
import { t as AuthGuard } from "./auth-guard-B2jCjgH2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/master-SBYwZcww.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function MasterRoute() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MasterDesk, {}) });
}
function MasterDesk() {
	const qc = useQueryClient();
	const masters = useQuery({
		queryKey: ["masters"],
		queryFn: () => listMasters()
	});
	const [masterId, setMasterId] = (0, import_react.useState)(null);
	const current = masters.data?.find((m) => m.id === masterId) ?? masters.data?.[0];
	const id = current?.id;
	(0, import_react.useEffect)(() => {
		if (current && masterId == null) setMasterId(current.id);
	}, [current, masterId]);
	(0, import_react.useEffect)(() => {
		if (!id) return;
		heartbeatMaster({ data: id });
		const t = setInterval(() => void heartbeatMaster({ data: id }), 2e4);
		return () => clearInterval(t);
	}, [id]);
	const mine = (useQuery({
		queryKey: ["orders", "all"],
		queryFn: () => listOrders({ data: { status: "all" } })
	}).data ?? []).filter((o) => o.master_id === id);
	const inbox = mine.filter((o) => o.status === "assigned");
	const active = mine.filter((o) => [
		"master_accepted",
		"enroute",
		"arrived",
		"in_progress"
	].includes(o.status));
	const decide = useMutation({
		mutationFn: (p) => masterDecision({ data: {
			orderId: p.orderId,
			accept: p.accept,
			masterId: id
		} }),
		onSuccess: () => qc.invalidateQueries()
	});
	const adv = useMutation({
		mutationFn: (p) => masterAdvance({ data: {
			orderId: p.orderId,
			masterId: id,
			to: p.to
		} }),
		onSuccess: () => qc.invalidateQueries()
	});
	const next = {
		master_accepted: "enroute",
		enroute: "arrived",
		arrived: "in_progress",
		in_progress: "completed"
	};
	const nextLabel = {
		master_accepted: "Выехать",
		enroute: "На месте",
		arrived: "Начать работу",
		in_progress: "Завершить"
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center justify-between border-b border-border px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/admin",
				className: "font-display text-accent",
				children: "All Servis"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
				className: "h-11 rounded-md bg-surface-2 px-3 text-sm",
				value: id ?? "",
				onChange: (e) => setMasterId(Number(e.target.value)),
				children: (masters.data ?? []).map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
					value: m.id,
					children: [
						m.first_name,
						" ",
						m.last_name,
						" — ",
						serviceById(m.specialization)?.title
					]
				}, m.id))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-2xl space-y-6 p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-2xl",
					children: "Кабинет мастера"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm text-muted",
						children: "Новые назначения от администратора"
					}), inbox.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-xl bg-surface px-4 py-8 text-center text-sm text-subtle",
						children: "Нет входящих"
					}) : inbox.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "glass-card rounded-xl p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-xs text-subtle",
								children: ["№", o.public_no]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "font-medium",
								children: serviceById(o.category_slug)?.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted",
								children: o.description
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-xs text-muted",
								children: [
									o.district,
									" · ",
									o.phone
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									onClick: () => decide.mutate({
										orderId: o.id,
										accept: true
									}),
									children: "Принять"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "outline",
									onClick: () => decide.mutate({
										orderId: o.id,
										accept: false
									}),
									children: "Отклонить"
								})]
							})
						]
					}, o.id))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "space-y-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm text-muted",
						children: "В работе"
					}), active.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "glass-card rounded-xl p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
									className: "font-medium",
									children: ["№", o.public_no]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OrderBadge, { status: o.status })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-muted",
								children: o.description
							}),
							next[o.status] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								className: "mt-4 w-full",
								onClick: () => adv.mutate({
									orderId: o.id,
									to: next[o.status]
								}),
								children: nextLabel[o.status]
							}) : null
						]
					}, o.id))]
				})
			]
		})]
	});
}
//#endregion
export { MasterRoute as component };
