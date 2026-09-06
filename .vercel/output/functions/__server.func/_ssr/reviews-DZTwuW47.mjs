import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { g as listReviews } from "./api-B2R1vwTw.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reviews-DZTwuW47.js
var import_jsx_runtime = require_jsx_runtime();
function ReviewsPage() {
	const { data = [], isPending } = useQuery({
		queryKey: ["reviews"],
		queryFn: () => listReviews()
	});
	const avg = data.length ? data.reduce((s, r) => s + Number(r.rating), 0) / data.length : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4 p-4 md:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "font-display text-2xl",
				children: "Отзывы"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					data.length,
					" оценок · среднее ",
					avg.toFixed(2)
				]
			})] }),
			isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Загрузка…"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-2",
				children: data.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "glass-card rounded-xl p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-sm",
							children: [
								r.master_name,
								" · оценка ",
								r.rating,
								"/5 · заявка №",
								r.public_no
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-muted",
							children: r.comment
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs text-subtle",
							children: r.client_name
						})
					]
				}, r.id))
			})
		]
	});
}
//#endregion
export { ReviewsPage as component };
