import { assignmentCity, canonicalCity, cityFromCoords, isInsideServiceArea, isBekabadName, isTashkentDistrictName, sameDispatchCity } from "./geo.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isInsideServiceArea(40.2206, 69.2697), "Bekabad must be inside Uzbekistan");
assert(isInsideServiceArea(41.3111, 69.2797), "Tashkent must be inside");
assert(isInsideServiceArea(39.6542, 66.9597), "Samarkand must be inside");
assert(isInsideServiceArea(41.277, 69.215), "Chilanzar must be inside");
assert(!isInsideServiceArea(55.7558, 37.6173), "Moscow must be outside");
assert(!isInsideServiceArea(43.238, 76.945), "Almaty must be outside");
assert(isBekabadName("Bekobod"), "Bekobod name");
assert(isBekabadName("Бекабад"), "Bekabad ru");
assert(isBekabadName("Bekabad City"), "Bekabad city");
assert(!isBekabadName("Tashkent Region"), "region is not Bekabad");
assert(isTashkentDistrictName("Чиланзар"), "Chilanzar district");
assert(isTashkentDistrictName("Tashkent"), "Tashkent district name");
assert(canonicalCity("Чиланзар") === "Ташкент", "Chilanzar is Tashkent");
assert(canonicalCity("Bekobod") === "Бекабад", "Bekobod");
assert(canonicalCity("Самарканд") === "Самарканд", "Samarkand name");
assert(canonicalCity("Tashkent Region") === "", "oblast is not the city");
assert(canonicalCity("Ташкентская область") === "", "oblast ru");
assert(cityFromCoords(41.3111, 69.2797) === "Ташкент", "Tashkent center");
assert(cityFromCoords(41.277, 69.215) === "Ташкент", "Chilanzar is Tashkent");
assert(cityFromCoords(40.2206, 69.2697) === "Бекабад", "Bekabad center");
assert(cityFromCoords(39.6542, 66.9597) === "Самарканд", "Samarkand center");
assert(cityFromCoords(41.4689, 69.5822) === "Чирчик", "Chirchiq is not Tashkent");
assert(assignmentCity("Бекабад", 41.3111, 69.2797) === "Ташкент", "stale Bekabad label must not beat Tashkent GPS");
assert(assignmentCity("Ташкент", 40.2206, 69.2697) === "Бекабад", "stale Tashkent label must not beat Bekabad GPS");
assert(sameDispatchCity("Бекабад", 40.22, 69.27, "Ташкент", 41.31, 69.28) === false, "Bekabad order must not reach Tashkent");
assert(sameDispatchCity("Самарканд", 39.65, 66.96, "Ташкент", 41.31, 69.28) === false, "Samarkand order must not reach Tashkent");
assert(sameDispatchCity("Ташкент", 41.31, 69.24, "Бекабад", 41.28, 69.22) === true, "same city even if the label is stale");
console.log("geo tests ok");
