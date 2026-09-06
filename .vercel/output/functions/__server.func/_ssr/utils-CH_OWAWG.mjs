import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-CH_OWAWG.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function uid(prefix = "id") {
	return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
function formatSum(value) {
	return `${value.toLocaleString("ru-RU")} сум`;
}
function formatPhone(raw) {
	const digits = raw.replace(/\D/g, "");
	if (digits.startsWith("998") && digits.length >= 12) return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
	if (digits.length === 9) return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
	return raw.trim();
}
function isValidUzPhone(raw) {
	const digits = raw.replace(/\D/g, "");
	if (digits.startsWith("998")) return digits.length === 12;
	if (digits.startsWith("9") || digits.startsWith("8") || digits.startsWith("7")) return digits.length === 9;
	return false;
}
function nowTime() {
	return (/* @__PURE__ */ new Date()).toLocaleTimeString("ru-RU", {
		hour: "2-digit",
		minute: "2-digit"
	});
}
//#endregion
export { nowTime as a, isValidUzPhone as i, formatPhone as n, uid as o, formatSum as r, cn as t };
