//#region node_modules/.nitro/vite/services/ssr/assets/domain-zUVhUtxQ.js
var ORDER_STATUSES = [
	"waiting_admin",
	"assigned",
	"master_accepted",
	"master_rejected",
	"enroute",
	"arrived",
	"in_progress",
	"completed",
	"cancelled"
];
var STATUS_LABEL = {
	waiting_admin: "Ожидает назначения",
	assigned: "Назначен, ждёт мастера",
	master_accepted: "Мастер принял",
	master_rejected: "Мастер отказался",
	enroute: "В пути",
	arrived: "На месте",
	in_progress: "В работе",
	completed: "Завершён",
	cancelled: "Отменён"
};
var STATUS_TONE = {
	waiting_admin: "warn",
	assigned: "cyan",
	master_accepted: "ok",
	master_rejected: "danger",
	enroute: "cyan",
	arrived: "ok",
	in_progress: "ok",
	completed: "muted",
	cancelled: "danger"
};
var ASSIGNABLE = [
	"waiting_admin",
	"master_rejected",
	"assigned"
];
var DISTRICT_COORDS = {
	chilanzar: {
		lat: 41.277,
		lng: 69.215,
		title: "Чиланзар"
	},
	yunusabad: {
		lat: 41.365,
		lng: 69.289,
		title: "Юнусабад"
	},
	mirzo: {
		lat: 41.327,
		lng: 69.334,
		title: "Мирзо-Улугбек"
	},
	yakkasaray: {
		lat: 41.289,
		lng: 69.256,
		title: "Яккасарай"
	},
	mirabad: {
		lat: 41.297,
		lng: 69.277,
		title: "Мирабад"
	},
	shayhantahur: {
		lat: 41.318,
		lng: 69.236,
		title: "Шайхантахур"
	},
	almazar: {
		lat: 41.362,
		lng: 69.209,
		title: "Алмазар"
	},
	uchtepa: {
		lat: 41.296,
		lng: 69.176,
		title: "Учтепа"
	},
	sergeli: {
		lat: 41.226,
		lng: 69.219,
		title: "Сергели"
	},
	yashnabad: {
		lat: 41.307,
		lng: 69.334,
		title: "Яшнабад"
	},
	bektemir: {
		lat: 41.243,
		lng: 69.334,
		title: "Бектемир"
	}
};
function haversineKm(aLat, aLng, bLat, bLng) {
	const R = 6371;
	const dLat = (bLat - aLat) * Math.PI / 180;
	const dLng = (bLng - aLng) * Math.PI / 180;
	const x = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
	return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) * 10) / 10;
}
function formatSum(n) {
	return `${Math.round(n).toLocaleString("ru-RU")} сум`;
}
function clientLabel(status) {
	switch (status) {
		case "waiting_admin": return "Администратор подбирает мастера";
		case "assigned": return "Мастер назначен — ожидает подтверждения";
		case "master_accepted": return "Мастер принял заявку";
		case "master_rejected": return "Мастер отказался. Администратор назначит другого";
		case "enroute": return "Мастер выехал к вам";
		case "arrived": return "Мастер на месте";
		case "in_progress": return "Работа начата";
		case "completed": return "Работа завершена. Оцените мастера";
		case "cancelled": return "Заявка отменена";
		default: return STATUS_LABEL[status];
	}
}
//#endregion
export { STATUS_TONE as a, haversineKm as c, STATUS_LABEL as i, DISTRICT_COORDS as n, clientLabel as o, ORDER_STATUSES as r, formatSum as s, ASSIGNABLE as t };
