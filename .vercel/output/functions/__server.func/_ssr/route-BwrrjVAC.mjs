import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { d as useRouterState, m as Outlet, v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { C as Bell, S as ClipboardList, _ as Map, a as Wallet, c as Star, f as ScrollText, g as Menu, h as MessageCircle, n as X, o as Users, r as Wrench, u as Settings, v as LayoutDashboard } from "../_libs/lucide-react.mjs";
import { m as listNotifications } from "./api-B2R1vwTw.mjs";
import { t as cn } from "./utils-CH_OWAWG.mjs";
import { n as UserButton } from "./gates-CGuTQVp9.mjs";
import { t as AuthGuard } from "./auth-guard-B2jCjgH2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-BwrrjVAC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var NAV = [
	{
		to: "/admin",
		label: "Dashboard",
		icon: LayoutDashboard
	},
	{
		to: "/admin/orders",
		label: "Заявки",
		icon: ClipboardList,
		children: [
			{
				to: "/admin/orders",
				label: "Все",
				search: { status: "all" }
			},
			{
				to: "/admin/orders",
				label: "Ожидают",
				search: { status: "waiting" }
			},
			{
				to: "/admin/orders",
				label: "Назначенные",
				search: { status: "assigned" }
			},
			{
				to: "/admin/orders",
				label: "В работе",
				search: { status: "work" }
			},
			{
				to: "/admin/orders",
				label: "Завершённые",
				search: { status: "completed" }
			}
		]
	},
	{
		to: "/admin/masters",
		label: "Мастера",
		icon: Wrench,
		children: [
			{
				to: "/admin/masters",
				label: "Все"
			},
			{
				to: "/admin/masters",
				label: "Онлайн",
				search: { filter: "online" }
			},
			{
				to: "/admin/masters",
				label: "Занятые",
				search: { filter: "busy" }
			},
			{
				to: "/admin/masters",
				label: "Рейтинг",
				search: { filter: "rating" }
			}
		]
	},
	{
		to: "/admin/clients",
		label: "Клиенты",
		icon: Users
	},
	{
		to: "/admin/map",
		label: "Карта",
		icon: Map
	},
	{
		to: "/admin/analytics",
		label: "Аналитика",
		icon: LayoutDashboard
	},
	{
		to: "/admin/finance",
		label: "Финансы",
		icon: Wallet
	},
	{
		to: "/admin/reviews",
		label: "Отзывы",
		icon: Star
	},
	{
		to: "/admin/notifications",
		label: "Уведомления",
		icon: Bell
	},
	{
		to: "/admin/audit",
		label: "Audit Log",
		icon: ScrollText
	},
	{
		to: "/admin/settings",
		label: "Настройки",
		icon: Settings
	}
];
function AdminShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const searchStr = useRouterState({ select: (s) => s.location.searchStr });
	const [open, setOpen] = (0, import_react.useState)(false);
	const unread = (useQuery({
		queryKey: ["notifications"],
		queryFn: () => listNotifications()
	}).data ?? []).filter((n) => n.kind === "admin" && !n.read).length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: cn("fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-surface/95 p-4 backdrop-blur-md transition-transform duration-200 md:static md:translate-x-0", open ? "translate-x-0" : "-translate-x-full"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-6 flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/admin",
						className: "font-display text-lg font-semibold tracking-tight text-accent",
						children: "ALL SERVIS"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "size-10 md:hidden",
						onClick: () => setOpen(false),
						"aria-label": "Закрыть",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto",
					children: NAV.map((item) => {
						const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							onClick: () => setOpen(false),
							className: cn("flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-150", active ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "size-4" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "flex-1",
									children: item.label
								}),
								item.to === "/admin/notifications" && unread > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded-full bg-danger px-1.5 font-mono text-[10px] text-fg",
									children: unread
								}) : null
							]
						}), item.children && active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mb-1 ml-6 mt-1 flex flex-col gap-0.5 border-l border-border pl-2",
							children: item.children.map((ch) => {
								const qs = ch.search ? new URLSearchParams(ch.search).toString() : "";
								const childActive = qs ? searchStr.includes(qs) : searchStr === "" || searchStr === "?status=all";
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: ch.to,
									search: ch.search,
									onClick: () => setOpen(false),
									className: cn("flex min-h-9 items-center rounded-md px-2 text-xs", childActive ? "text-accent" : "text-subtle hover:text-fg"),
									children: ch.label
								}, ch.label);
							})
						}) : null] }, item.to + item.label);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 space-y-1 border-t border-border pt-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/",
						className: "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageCircle, { className: "size-4" }), "Telegram-бот"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/master",
						className: "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-muted hover:text-fg",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Wrench, { className: "size-4" }), "Кабинет мастера"]
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 flex-1 flex-col",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-md",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "size-11 md:hidden",
						onClick: () => setOpen(true),
						"aria-label": "Меню",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "hidden text-sm text-muted md:block",
						children: "Клиент → заявка → администратор → мастер"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/admin/notifications",
							className: "relative flex size-11 items-center justify-center text-muted hover:text-accent",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "size-5" }), unread > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute right-2 top-2 size-2 rounded-full bg-danger" }) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
				className: "min-w-0 flex-1",
				children
			})]
		})]
	});
}
function AdminLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthGuard, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) });
}
//#endregion
export { AdminLayout as component };
