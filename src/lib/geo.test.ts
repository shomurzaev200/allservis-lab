import { isInsideServiceArea, isBekabadName, isTashkentDistrictName } from "./geo.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(isInsideServiceArea(40.2206, 69.2697), "Bekabad center must be inside");
assert(isInsideServiceArea(40.221, 69.270), "Bekabad nearby must be inside");
assert(!isInsideServiceArea(41.3111, 69.2797), "Tashkent center must be outside");
assert(!isInsideServiceArea(41.277, 69.215), "Chilanzar must be outside");
assert(!isInsideServiceArea(41.297, 69.277), "Mirabad must be outside");
assert(!isInsideServiceArea(41.289, 69.256), "Yakkasaray must be outside");
assert(!isInsideServiceArea(41.365, 69.289), "Yunusabad must be outside");
assert(isBekabadName("Bekobod"));
assert(isBekabadName("Бекабад"));
assert(isBekabadName("Bekabad City"));
assert(!isBekabadName("Tashkent Region"));
assert(isTashkentDistrictName("Чиланзар"));
assert(isTashkentDistrictName("Tashkent"));
console.log("geo tests ok");
