import { o as __toESM } from "../_runtime.mjs";
import { n as DISTRICT_COORDS, o as clientLabel, s as formatSum } from "./domain-zUVhUtxQ.mjs";
import { a as serviceById, i as matchService, n as SERVICES, r as districtById, t as DISTRICTS } from "./catalog-Cq__2iHb.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { T as ArrowLeft, b as EllipsisVertical, d as Send, i as Wind, l as Sofa, m as Paintbrush, p as Paperclip, r as Wrench, t as Zap, x as Droplets, y as KeyRound } from "../_libs/lucide-react.mjs";
import { b as rateOrder, i as createOrder, y as pollOrder } from "./api-B2R1vwTw.mjs";
import { a as nowTime, i as isValidUzPhone, n as formatPhone, o as uid, r as formatSum$1, t as cn } from "./utils-CH_OWAWG.mjs";
import { t as Button } from "./button-PrOHLo0L.mjs";
import { n as UserButton, r as useCurrentUserState } from "./gates-CGuTQVp9.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DHS0g7Ug.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var STATIC_TIME = "12:40";
var CATEGORY_KEYS = [
	[{
		id: "svc:plumb",
		label: "Сантехник"
	}, {
		id: "svc:elec",
		label: "Электрик"
	}],
	[{
		id: "svc:ac",
		label: "Кондиционер"
	}, {
		id: "svc:appliance",
		label: "Техника"
	}],
	[{
		id: "svc:furniture",
		label: "Мебель"
	}, {
		id: "svc:lock",
		label: "Замки"
	}],
	[{
		id: "svc:paint",
		label: "Маляр"
	}, {
		id: "svc:other",
		label: "Другое"
	}]
];
var DISTRICT_KEYS = chunk(DISTRICTS.map((d) => ({
	id: `dist:${d.id}`,
	label: d.title
})), 2);
function chunk(arr, size) {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}
function bot(text, extra) {
	return {
		id: uid("m"),
		from: "bot",
		text,
		time: nowTime(),
		...extra
	};
}
function user(text) {
	return {
		id: uid("m"),
		from: "user",
		text,
		time: nowTime()
	};
}
function emptyDraft() {
	return {
		photos: [],
		name: "Клиент"
	};
}
function welcomeMessages() {
	return [{
		id: "sys-hello",
		from: "system",
		text: "All Servis Bot",
		time: STATIC_TIME
	}, {
		id: "bot-hello",
		from: "bot",
		text: "All Servis — мастер на дом в Ташкенте.\nАдминистратор назначит мастера вручную.\n\nВыберите услугу или напишите, что случилось.",
		time: STATIC_TIME,
		buttons: CATEGORY_KEYS
	}];
}
function summary(d) {
	const svc = d.serviceId ? serviceById(d.serviceId) : void 0;
	const dist = d.districtId ? DISTRICT_COORDS[d.districtId] : void 0;
	const lines = [
		"Проверьте заявку:",
		"",
		`Услуга — ${svc?.title ?? "—"}`,
		`Задача — ${d.problem ?? "—"}`,
		`Район — ${dist?.title ?? "—"}`,
		`Геолокация — ${d.lat?.toFixed(4)}, ${d.lng?.toFixed(4)}`,
		`Телефон — ${d.phone ?? "—"}`,
		`Фото — ${d.photos.length ? d.photos.length + " шт." : "нет"}`,
		`Комментарий — ${d.comment || "нет"}`
	];
	if (svc) lines.push(`Выезд — от ${formatSum$1(svc.from)}`);
	return lines.join("\n");
}
function reduceBot(step, draft, event) {
	if (event.type === "photo") {
		if (step !== "photo") return {
			replies: [],
			step,
			draft
		};
		const photos = [...draft.photos, event.dataUrl].slice(0, 3);
		return {
			userMessage: user("Фото прикреплено"),
			replies: [bot(photos.length >= 3 ? "Три фото достаточно. Укажите район — так мы передадим геолокацию администратору." : "Фото получил. Ещё одно или перейдите к геолокации.", { buttons: photos.length >= 3 ? DISTRICT_KEYS : [[{
				id: "photo:skip",
				label: "Дальше — геолокация"
			}], ...DISTRICT_KEYS] })],
			step: photos.length >= 3 ? "district" : "photo",
			draft: {
				...draft,
				photos
			}
		};
	}
	const raw = event.type === "text" ? event.text.trim() : event.label;
	const tapId = event.type === "tap" ? event.id : "";
	const lower = raw.toLowerCase();
	if (lower === "/start" || tapId === "cmd:start") return {
		userMessage: user("/start"),
		replies: welcomeMessages().filter((m) => m.from !== "system"),
		step: "category",
		draft: emptyDraft()
	};
	if (lower === "/help" || tapId === "cmd:help") return {
		userMessage: user("Помощь"),
		replies: [bot("Заявка идёт администратору All Servis. Мастера система сама не выбирает.\n\n/start — новая заявка\n/cancel — отменить черновик")],
		step,
		draft
	};
	if (lower === "/cancel" || tapId === "cmd:cancel") return {
		userMessage: user("Отменить"),
		replies: [bot("Черновик сброшен. Выберите услугу.", { buttons: CATEGORY_KEYS })],
		step: "category",
		draft: emptyDraft()
	};
	if (tapId.startsWith("rate:")) return {
		userMessage: user(`${tapId.slice(5)} из 5`),
		replies: [bot("Спасибо. Оценка ушла администратору.", { buttons: [[{
			id: "cmd:start",
			label: "Новая заявка"
		}]] })],
		step: "idle",
		draft: emptyDraft()
	};
	if (step === "category") {
		const svc = tapId.startsWith("svc:") ? serviceById(tapId.slice(4)) : matchService(raw);
		const userMessage = user(svc?.title ?? raw);
		if (!svc) return {
			userMessage,
			replies: [bot("Нажмите кнопку или напишите, например: «течёт кран».", { buttons: CATEGORY_KEYS })],
			step: "category",
			draft
		};
		return {
			userMessage,
			replies: [bot(`${svc.title}. Коротко опишите проблему.`)],
			step: "problem",
			draft: {
				...emptyDraft(),
				serviceId: svc.id
			}
		};
	}
	if (step === "problem") {
		const problem = raw.slice(0, 400);
		if (problem.length < 4) return {
			userMessage: user(raw),
			replies: [bot("Нужно чуть конкретнее — что случилось и где.")],
			step: "problem",
			draft
		};
		return {
			userMessage: user(problem),
			replies: [bot("Пришлите фото поломки или пропустите — без фото тоже примем.", { buttons: [[{
				id: "photo:skip",
				label: "Пропустить фото"
			}]] })],
			step: "photo",
			draft: {
				...draft,
				problem
			}
		};
	}
	if (step === "photo") {
		if (tapId === "photo:skip" || lower.includes("пропуст")) return {
			userMessage: user("Пропустить фото"),
			replies: [bot("Укажите район Ташкента — это и будет геолокация заявки.", { buttons: DISTRICT_KEYS })],
			step: "district",
			draft
		};
		return {
			userMessage: user(raw),
			replies: [bot("Нажмите скрепку, чтобы прикрепить фото, или пропустите шаг.", { buttons: [[{
				id: "photo:skip",
				label: "Пропустить фото"
			}]] })],
			step: "photo",
			draft
		};
	}
	if (step === "district") {
		const dist = tapId.startsWith("dist:") ? DISTRICTS.find((d) => d.id === tapId.slice(5)) : DISTRICTS.find((d) => d.title.toLowerCase() === lower);
		const userMessage = user(dist?.title ?? raw);
		if (!dist) return {
			userMessage,
			replies: [bot("Выберите район кнопкой — так передадим координаты.", { buttons: DISTRICT_KEYS })],
			step: "district",
			draft
		};
		return {
			userMessage,
			replies: [bot(`${dist.title}. Координаты записаны.\nОставьте номер телефона.`)],
			step: "phone",
			draft: {
				...draft,
				districtId: dist.id,
				lat: dist.lat,
				lng: dist.lng
			}
		};
	}
	if (step === "phone") {
		const userMessage = user(raw);
		if (!isValidUzPhone(raw)) return {
			userMessage,
			replies: [bot("Нужен номер: +998 90 123 45 67 или 90 123 45 67.")],
			step: "phone",
			draft
		};
		return {
			userMessage,
			replies: [bot("Комментарий для мастера — или пропустите.", { buttons: [[{
				id: "cmt:skip",
				label: "Без комментария"
			}]] })],
			step: "comment",
			draft: {
				...draft,
				phone: formatPhone(raw)
			}
		};
	}
	if (step === "comment") {
		const comment = tapId === "cmt:skip" || lower.includes("без коммент") ? "" : raw.slice(0, 240);
		const next = {
			...draft,
			comment
		};
		return {
			userMessage: user(comment || "Без комментария"),
			replies: [bot(summary(next), {
				kind: "order",
				buttons: [[{
					id: "confirm:yes",
					label: "Подтвердить"
				}, {
					id: "confirm:no",
					label: "Изменить"
				}]]
			})],
			step: "confirm",
			draft: next
		};
	}
	if (step === "confirm") {
		if (tapId === "confirm:no" || lower.includes("измен")) return {
			userMessage: user("Изменить"),
			replies: [bot("Начнём заново. Выберите услугу.", { buttons: CATEGORY_KEYS })],
			step: "category",
			draft: emptyDraft()
		};
		if (tapId === "confirm:yes" || lower.includes("подтвер")) {
			if (!draft.serviceId || !draft.problem || !draft.phone || !draft.districtId) return {
				userMessage: user(raw),
				replies: [bot("Данных не хватает. /start")],
				step: "category",
				draft: emptyDraft()
			};
			return {
				userMessage: user("Подтвердить"),
				replies: [],
				step: "live",
				draft,
				submit: draft
			};
		}
		return {
			userMessage: user(raw),
			replies: [bot("Нажмите «Подтвердить» или «Изменить».", { buttons: [[{
				id: "confirm:yes",
				label: "Подтвердить"
			}, {
				id: "confirm:no",
				label: "Изменить"
			}]] })],
			step: "confirm",
			draft
		};
	}
	if (step === "live") return {
		userMessage: user(raw),
		replies: [bot("Заявка уже у администратора. Статус придёт сюда сам. /start — новая.")],
		step: "live",
		draft
	};
	const svc = matchService(raw);
	if (svc) return {
		userMessage: user(svc.title),
		replies: [bot(`${svc.title}. Коротко опишите проблему.`)],
		step: "problem",
		draft: {
			...emptyDraft(),
			serviceId: svc.id
		}
	};
	return {
		userMessage: user(raw),
		replies: [bot("Чтобы вызвать мастера — /start или кнопка услуги.", { buttons: CATEGORY_KEYS })],
		step: "category",
		draft: emptyDraft()
	};
}
function statusReply(status, masterName) {
	const extra = masterName ? `\n\nМастер: ${masterName}` : "";
	const buttons = status === "completed" ? [[{
		id: "rate:5",
		label: "5 — отлично"
	}, {
		id: "rate:4",
		label: "4"
	}], [{
		id: "rate:3",
		label: "3"
	}, {
		id: "rate:2",
		label: "2"
	}]] : status === "master_rejected" || status === "cancelled" ? [[{
		id: "cmd:start",
		label: "Новая заявка"
	}]] : void 0;
	return bot(clientLabel(status) + extra, {
		kind: "status",
		masterName: masterName ?? void 0,
		buttons
	});
}
var timer = null;
var queue = [];
function pump(get, set) {
	if (timer) return;
	const next = queue[0];
	if (!next) {
		set({ typing: false });
		return;
	}
	if (next.length === 0) {
		queue.shift();
		pump(get, set);
		return;
	}
	set({ typing: true });
	timer = setTimeout(() => {
		timer = null;
		const msg = next.shift();
		if (msg) set({
			messages: [...get().messages, msg],
			typing: next.length > 0
		});
		if (next.length === 0) queue.shift();
		pump(get, set);
	}, 420);
}
function enqueue(get, set, replies) {
	if (!replies.length) return;
	queue.push([...replies]);
	pump(get, set);
}
async function submitDraft(get, set, draft) {
	const dist = draft.districtId ? districtById(draft.districtId) : void 0;
	const svc = draft.serviceId ? serviceById(draft.serviceId) : void 0;
	if (!dist || !svc || !draft.problem || !draft.phone) return;
	try {
		const res = await createOrder({ data: {
			name: draft.name || "Клиент Telegram",
			phone: draft.phone,
			category: svc.id,
			description: draft.problem,
			district: dist.title,
			lat: draft.lat ?? dist.lat,
			lng: draft.lng ?? dist.lng,
			comment: draft.comment,
			photos: draft.photos
		} });
		set({
			live: {
				id: res.id,
				publicNo: res.publicNo,
				status: "waiting_admin"
			},
			lastStatus: "waiting_admin"
		});
		enqueue(get, set, [statusReply("waiting_admin"), {
			id: `ord-${res.id}`,
			from: "bot",
			text: `Заявка №${res.publicNo}\nСтатус: ожидает назначения мастера\nВыезд от ${svc.from.toLocaleString("ru-RU")} сум`,
			time: (/* @__PURE__ */ new Date()).toLocaleTimeString("ru-RU", {
				hour: "2-digit",
				minute: "2-digit"
			}),
			kind: "order",
			orderId: res.id
		}]);
	} catch {
		enqueue(get, set, [{
			id: "err",
			from: "bot",
			text: "Не удалось создать заявку. Войдите в аккаунт и попробуйте снова.",
			time: (/* @__PURE__ */ new Date()).toLocaleTimeString("ru-RU", {
				hour: "2-digit",
				minute: "2-digit"
			})
		}]);
		set({ step: "confirm" });
	}
}
var useChatStore = create((set, get) => ({
	messages: welcomeMessages(),
	step: "category",
	draft: emptyDraft(),
	typing: false,
	sendText: (text) => apply(get, set, {
		type: "text",
		text
	}),
	tapButton: (id, label) => {
		if (id.startsWith("rate:") && get().live) {
			const rating = Number(id.slice(5));
			rateOrder({ data: {
				orderId: get().live.id,
				rating
			} });
		}
		apply(get, set, {
			type: "tap",
			id,
			label
		});
	},
	attachPhoto: (dataUrl) => apply(get, set, {
		type: "photo",
		dataUrl
	}),
	resetChat: () => {
		if (timer) clearTimeout(timer);
		timer = null;
		queue.length = 0;
		set({
			messages: welcomeMessages(),
			step: "category",
			draft: emptyDraft(),
			typing: false,
			live: void 0,
			lastStatus: void 0
		});
	},
	syncLive: async () => {
		const live = get().live;
		if (!live) return;
		try {
			const o = await pollOrder({ data: live.id });
			if (!o) return;
			if (o.status !== get().lastStatus) {
				set({
					lastStatus: o.status,
					live: {
						...live,
						status: o.status,
						masterName: o.master_name
					},
					step: o.status === "completed" ? "rate" : o.status === "cancelled" ? "idle" : "live"
				});
				enqueue(get, set, [statusReply(o.status, o.master_name)]);
			}
		} catch {}
	}
}));
function apply(get, set, event) {
	const state = get();
	const result = reduceBot(state.step, state.draft, event);
	if (result.userMessage) set({ messages: [...get().messages, result.userMessage] });
	set({
		step: result.step,
		draft: result.draft
	});
	if (result.submit) {
		submitDraft(get, set, result.submit);
		return;
	}
	enqueue(get, set, result.replies);
}
function TelegramPhone({ framed = true }) {
	const inner = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelegramChat, {});
	if (!framed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-full min-h-0 flex-col bg-tg-bg",
		children: inner
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "phone-bezel mx-auto w-full max-w-sm overflow-hidden p-2",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex phone-screen flex-col overflow-hidden rounded-phone-inner bg-tg-bg",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-5 w-24 rounded-full bg-black/80" })
			}), inner]
		})
	});
}
function TelegramChat() {
	const messages = useChatStore((s) => s.messages);
	const typing = useChatStore((s) => s.typing);
	const sendText = useChatStore((s) => s.sendText);
	const tapButton = useChatStore((s) => s.tapButton);
	const attachPhoto = useChatStore((s) => s.attachPhoto);
	const syncLive = useChatStore((s) => s.syncLive);
	const live = useChatStore((s) => s.live);
	const [value, setValue] = (0, import_react.useState)("");
	const scroller = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const el = scroller.current;
		if (!el) return;
		el.scrollTo({
			top: el.scrollHeight,
			behavior: "smooth"
		});
	}, [messages, typing]);
	(0, import_react.useEffect)(() => {
		if (!live) return;
		const t = setInterval(() => void syncLive(), 3500);
		return () => clearInterval(t);
	}, [live, syncLive]);
	function onSubmit(e) {
		e.preventDefault();
		const t = value.trim();
		if (!t) return;
		sendText(t);
		setValue("");
	}
	const lastBot = [...messages].reverse().find((m) => m.from === "bot");
	const keyboard = lastBot?.buttons?.length ? lastBot : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-2 bg-tg-header px-2 pb-2 pt-7 text-tg-text",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-10 items-center justify-center text-tg-meta",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-10 items-center justify-center rounded-full bg-accent/20 font-display text-sm font-semibold text-accent",
						children: "A"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "truncate text-sm font-semibold leading-tight",
							children: "All Servis"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-tg-meta",
							children: typing ? "печатает…" : "бот · онлайн"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-10 items-center justify-center text-tg-link",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EllipsisVertical, { className: "size-5" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: scroller,
				className: "tg-wallpaper min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3",
				children: [messages.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bubble, { message: m }, m.id)), typing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypingBubble, {}) : null]
			}),
			keyboard && !typing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "shrink-0 space-y-1.5 bg-tg-composer px-2 pb-2 pt-1",
				children: keyboard.buttons.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: cn("grid gap-1.5", row.length > 1 ? "grid-cols-2" : "grid-cols-1"),
					children: row.map((btn) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => tapButton(btn.id, btn.label),
						className: "min-h-11 rounded-md bg-tg-btn px-2 text-center text-sm font-medium text-tg-btn-text transition-opacity duration-150 hover:opacity-90 active:scale-[0.98]",
						children: btn.label
					}, btn.id))
				}, i))
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: "flex shrink-0 items-center gap-1 bg-tg-composer px-2 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: "image/*",
						className: "hidden",
						onChange: (e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							const reader = new FileReader();
							reader.onload = () => {
								if (typeof reader.result === "string") attachPhoto(reader.result);
							};
							reader.readAsDataURL(file);
							e.target.value = "";
						}
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center text-tg-meta",
						onClick: () => fileRef.current?.click(),
						"aria-label": "Фото",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value,
						onChange: (e) => setValue(e.target.value),
						placeholder: "Сообщение",
						className: "h-10 min-w-0 flex-1 rounded-full bg-tg-input px-4 text-sm text-tg-text placeholder:text-tg-meta outline-none",
						autoComplete: "off"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						className: "flex size-10 items-center justify-center rounded-full text-tg-link transition-transform duration-150 active:scale-[0.96]",
						"aria-label": "Отправить",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "size-5" })
					})
				]
			})
		]
	});
}
function Bubble({ message }) {
	if (message.from === "system") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-center py-1",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "rounded-full bg-tg-date px-3 py-1 text-xs font-medium text-tg-meta",
			children: message.text
		})
	});
	const mine = message.from === "user";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("flex", mine ? "justify-end" : "justify-start"),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: cn("max-w-xs rounded-lg px-2.5 py-1.5 text-sm leading-snug text-tg-text", mine ? "rounded-br-sm bg-tg-out" : "rounded-bl-sm bg-tg-in"),
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "whitespace-pre-wrap",
				children: message.text
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-0.5 flex justify-end",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-tg-meta",
					children: message.time
				})
			})]
		})
	});
}
function TypingBubble() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex justify-start",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-1 rounded-lg rounded-bl-sm bg-tg-in px-3 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "typing-dot size-1.5 rounded-full bg-tg-meta" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "typing-dot size-1.5 rounded-full bg-tg-meta" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "typing-dot size-1.5 rounded-full bg-tg-meta" })
			]
		})
	});
}
var ICONS = {
	plumb: Droplets,
	elec: Zap,
	ac: Wind,
	appliance: Wrench,
	furniture: Sofa,
	lock: KeyRound,
	paint: Paintbrush,
	other: Wrench
};
function Home() {
	const { user, isPending } = useCurrentUserState();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh flex-col bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center justify-between gap-2 border-b border-border px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-lg font-semibold text-accent",
				children: "All Servis"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "flex items-center gap-1 sm:gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/admin",
							children: "Админка"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						className: "hidden sm:inline-flex",
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/master",
							children: "Мастер"
						})
					}),
					isPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-8 w-20 animate-pulse rounded-md bg-surface-2" }) : user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/login",
							children: "Войти"
						})
					})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-5 lg:grid lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-10 lg:py-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "lg:order-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelegramPhone, {})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-5 lg:order-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-wider text-accent",
							children: "Telegram-бот · Ташкент"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "mt-2 font-display text-3xl font-medium tracking-tight",
							children: "Вызов мастера"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 max-w-xl text-sm leading-relaxed text-muted",
							children: "Клиент создаёт заявку. Она сразу появляется у администратора. Система сама мастера не выбирает — назначение только вручную."
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "grid grid-cols-2 gap-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]",
								children: "1. Клиент описывает задачу"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]",
								children: "2. Заявка ждёт администратора"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]",
								children: "3. Админ назначает мастера"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]",
								children: "4. Мастер принимает или отказывается"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
						children: SERVICES.map((s) => {
							const Icon = ICONS[s.id];
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-lg bg-surface-2 px-3 py-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4 text-accent" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-2 text-sm font-medium",
										children: s.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 font-mono text-xs text-muted",
										children: ["от ", formatSum(s.from)]
									})
								]
							}, s.id);
						})
					})
				]
			})]
		})]
	});
}
//#endregion
export { Home as component };
