import { n as DISTRICT_COORDS } from "./domain-zUVhUtxQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/catalog-Cq__2iHb.js
var SERVICES = [
	{
		id: "plumb",
		title: "Сантехник",
		hint: "Краны, трубы, унитаз, засор",
		from: 8e4,
		diag: 3e4,
		etaMin: 25,
		keywords: [
			"сантех",
			"кран",
			"труб",
			"унитаз",
			"смесит",
			"засор",
			"протеч",
			"вода",
			"стояк",
			"слив"
		]
	},
	{
		id: "elec",
		title: "Электрик",
		hint: "Розетки, щиток, свет, проводка",
		from: 7e4,
		diag: 3e4,
		etaMin: 30,
		keywords: [
			"электр",
			"свет",
			"розет",
			"щит",
			"провод",
			"автомат",
			"ламп",
			"выключ"
		]
	},
	{
		id: "ac",
		title: "Кондиционер",
		hint: "Заправка, чистка, монтаж",
		from: 15e4,
		diag: 4e4,
		etaMin: 40,
		keywords: [
			"кондиц",
			"сплит",
			"заправ",
			"фреон",
			"охлажд",
			"кондёр",
			"кондер"
		]
	},
	{
		id: "appliance",
		title: "Бытовая техника",
		hint: "Стиралка, холодильник, плита",
		from: 1e5,
		diag: 4e4,
		etaMin: 45,
		keywords: [
			"стирал",
			"холодиль",
			"плит",
			"духов",
			"посудом",
			"техника",
			"машинк"
		]
	},
	{
		id: "furniture",
		title: "Сборка мебели",
		hint: "Шкафы, кухни, IKEA",
		from: 12e4,
		diag: 0,
		etaMin: 60,
		keywords: [
			"мебел",
			"сборк",
			"шкаф",
			"ikea",
			"икеа",
			"кухн",
			"стол",
			"кровать"
		]
	},
	{
		id: "lock",
		title: "Замки и двери",
		hint: "Вскрытие, замена, броня",
		from: 9e4,
		diag: 0,
		etaMin: 20,
		keywords: [
			"замк",
			"дверь",
			"двери",
			"вскры",
			"ключ",
			"личинк",
			"броне"
		]
	},
	{
		id: "paint",
		title: "Малярные работы",
		hint: "Стены, потолок, обои",
		from: 2e5,
		diag: 0,
		etaMin: 90,
		keywords: [
			"маляр",
			"покрас",
			"обои",
			"шпакл",
			"потолок",
			"стен"
		]
	},
	{
		id: "other",
		title: "Другое",
		hint: "Подберём мастера под задачу",
		from: 8e4,
		diag: 3e4,
		etaMin: 40,
		keywords: [
			"друг",
			"не знаю",
			"мастер",
			"помощь"
		]
	}
];
var DISTRICTS = Object.entries(DISTRICT_COORDS).map(([id, d]) => ({
	id,
	title: d.title,
	lat: d.lat,
	lng: d.lng
}));
function serviceById(id) {
	return SERVICES.find((s) => s.id === id);
}
function districtById(id) {
	return DISTRICTS.find((d) => d.id === id);
}
function matchService(text) {
	const q = text.toLowerCase();
	const exact = SERVICES.find((s) => s.title.toLowerCase() === q);
	if (exact) return exact;
	return SERVICES.find((s) => s.keywords.some((k) => q.includes(k)));
}
//#endregion
export { serviceById as a, matchService as i, SERVICES as n, districtById as r, DISTRICTS as t };
