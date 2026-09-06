import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-rmRr0XO7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-B2R1vwTw.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("bcee57888284512163ce188ef314601cbe1872c893a3cb32212c42475e952876"));
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("4303ff2527037c84f7e30b270e3f6e8a6118e8bf6a13e0e3f4d48144dd33a3ab"));
var listOrders = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((q) => q ?? {}).handler(createSsrRpc("202fbb145d2052de8349c5e1f4290bfb8ba1a4b77fb94f23ecd2a258156ed6fb"));
var getOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("453d097a7c34892f9bd6191b8fff54cdbd80cd8c29e0d7b0c460a5ed586968b9"));
var listMasters = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("5e417ceff8cef4b1a7aceeef244eb450c166dd5f3343d639e9c2449c3dda1757"));
var getMaster = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("089abd061d1b05f1569598e712a50563d15a89d7498c1cf127b7a93ae9585855"));
var listClients = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("e97090349ac20a696306f2e3bb514ace9e3f94429545a22f9e237ad7ab72b861"));
var candidatesForOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((orderId) => orderId).handler(createSsrRpc("039ed02e2cf72d530f94e43b3df30b754b8896bdd94a786b0da5f10df778b6c7"));
var assignMaster = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("3915cf46293774e384236bcabc185f12ef0e24cd084b8ac72a8f330f10f9668e"));
var cancelOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((orderId) => orderId).handler(createSsrRpc("6017d46f10284f0e86b960d2ff3addeca29517995bcdaa38324909d3db0c6739"));
var masterDecision = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("ba1c7b0ba3e4dbff43f472ea8d14d65ba6d11c5e276240b298451db5aafc5c79"));
var masterAdvance = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("5a6c98f82d6a7c87424440a9a2bd303e27a2813fbab8c7094dff50c45fdc3db2"));
var heartbeatMaster = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((masterId) => masterId).handler(createSsrRpc("28996e49bd3e2d1b68355ed9ddfafb9b247000d8836be2b442d90f48f4764904"));
var createOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("90fd3c78b75753d13c0d8c571c4d9f025a05c757f33fc65c5b5732924d2770f4"));
var rateOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((d) => d).handler(createSsrRpc("f93cb4c7119028cb25ec3b46abd4bd7440c71023f65b0166920bdd5d08ed5a65"));
var getMapData = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("862c476a59719f767f96324bc02e68e49a16e1af07ee37d3683ef7281871592c"));
var getAnalytics = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("4cb0c004d1395b50a3d126168a8cdd18353f3971a6159e50c5b1c895a32f7625"));
var listReviews = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("6c04d81788a3c57d766af26335d2a82b9ab514e7c7ce26545d83c260a93e473f"));
var listAudit = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("84aef8fa63c4455597f669a5df96a0a760073d7655821458f5c8c8c3d2236a55"));
var listNotifications = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("c3972ee4d0736a00df2095b11cc29da4af69edc7462b684c3b8b7d301bd86b49"));
var pollOrder = createServerFn({ method: "GET" }).middleware([authMiddleware]).validator((id) => id).handler(createSsrRpc("1e0f2965b7521f4746fce81272de642d119351d8918684efa0ad549530ab2cde"));
//#endregion
export { masterAdvance as _, getAnalytics as a, rateOrder as b, getMaster as c, listAudit as d, listClients as f, listReviews as g, listOrders as h, createOrder as i, getOrder as l, listNotifications as m, cancelOrder as n, getDashboard as o, listMasters as p, candidatesForOrder as r, getMapData as s, assignMaster as t, heartbeatMaster as u, masterDecision as v, pollOrder as y };
