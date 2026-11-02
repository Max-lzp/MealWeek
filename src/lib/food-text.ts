// Product reference estimates, not a verified nutrition database or an AI model.
// Grams refer to edible portions; preparation/brands/oils can change the result.
export type ReferenceFood = {
  name: string;
  aliases: string[];
  per100g: number;
  unit?: string;
  unitGrams?: number;
  note: string;
};
export const REFERENCE_FOODS: ReferenceFood[] = [
  {
    name: "米饭",
    aliases: ["白米饭", "熟米饭", "米饭"],
    per100g: 116,
    note: "熟米饭",
  },
  {
    name: "鸡胸肉",
    aliases: ["熟鸡胸肉", "鸡胸肉"],
    per100g: 165,
    note: "熟、去皮，不含额外油",
  },
  {
    name: "鸡蛋",
    aliases: ["水煮鸡蛋", "水煮蛋", "煮鸡蛋", "鸡蛋"],
    per100g: 144,
    unit: "个",
    unitGrams: 50,
    note: "中等大小，每个可食部约50克",
  },
  {
    name: "香蕉",
    aliases: ["香蕉"],
    per100g: 89,
    unit: "根",
    unitGrams: 118,
    note: "中等大小，去皮后每根约118克",
  },
  {
    name: "苹果",
    aliases: ["苹果"],
    per100g: 52,
    unit: "个",
    unitGrams: 180,
    note: "中等大小，每个可食部约180克",
  },
  {
    name: "牛奶",
    aliases: ["纯牛奶", "牛奶"],
    per100g: 62,
    note: "普通全脂奶，1毫升近似1克",
  },
  {
    name: "酸奶",
    aliases: ["原味酸奶", "酸奶"],
    per100g: 75,
    note: "普通原味，品牌与含糖量差异大；1毫升近似1克",
  },
  {
    name: "豆腐",
    aliases: ["北豆腐", "豆腐"],
    per100g: 80,
    note: "普通豆腐，种类有差异",
  },
  {
    name: "西兰花",
    aliases: ["西蓝花", "西兰花"],
    per100g: 35,
    note: "不含额外油",
  },
  { name: "生菜", aliases: ["生菜"], per100g: 15, note: "不含沙拉酱" },
  {
    name: "土豆",
    aliases: ["蒸土豆", "土豆"],
    per100g: 77,
    note: "蒸煮，不含额外油",
  },
  {
    name: "红薯",
    aliases: ["蒸红薯", "红薯"],
    per100g: 86,
    note: "蒸煮可食部",
  },
  {
    name: "馒头",
    aliases: ["白馒头", "馒头"],
    per100g: 223,
    note: "普通白馒头，需输入克数",
  },
  {
    name: "面包",
    aliases: ["白面包", "面包"],
    per100g: 265,
    note: "普通面包，品牌差异大，需输入克数",
  },
  {
    name: "燕麦片",
    aliases: ["干燕麦片", "燕麦片"],
    per100g: 380,
    note: "干重，不是煮好的燕麦粥",
  },
  {
    name: "牛肉",
    aliases: ["熟牛肉", "牛肉"],
    per100g: 250,
    note: "熟肉参考，部位与油脂差异大",
  },
  {
    name: "猪肉",
    aliases: ["熟猪肉", "猪肉"],
    per100g: 250,
    note: "熟肉参考，部位与油脂差异大",
  },
  {
    name: "三文鱼",
    aliases: ["三文鱼"],
    per100g: 208,
    note: "可食部，不含额外油",
  },
  { name: "虾仁", aliases: ["虾仁"], per100g: 99, note: "可食部，不含额外油" },
  {
    name: "食用油",
    aliases: ["橄榄油", "食用油"],
    per100g: 900,
    note: "按克计算，请补充实际用油量",
  },
];
export type TextItem = {
  original: string;
  name: string;
  portion: string;
  grams: number | null;
  low: number | null;
  high: number | null;
  note: string;
};
const quantityPattern =
  "([0-9]+(?:\\.[0-9]+)?|[零〇一二两三四五六七八九十百半]+)\\s*(千克|公斤|毫升|克|kg|ml|g|个|根|碗|份|片|杯|瓶)";
export function chineseNumber(input: string): number | null {
  if (input === "半") return 0.5;
  if (/^\d+(\.\d+)?$/.test(input)) {
    const n = Number(input);
    return Number.isFinite(n) ? n : null;
  }
  const map: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (
    !/^[零〇一二两三四五六七八九十百]+$/.test(input) ||
    /^[零〇一二两三四五六七八九]{2,}$/.test(input) ||
    /百[一二两三四五六七八九]$/.test(input)
  )
    return null;
  let value = 0,
    current = 0;
  for (const char of input) {
    if (char === "十" || char === "百") {
      value += (current || 1) * (char === "十" ? 10 : 100);
      current = 0;
    } else current = map[char];
  }
  return value + current;
}
function clean(segment: string) {
  return segment
    .trim()
    .replace(/\s+/g, "")
    .replace(
      /^(?:(?:我|今天|早上|中午|晚上|早餐|午餐|晚餐|加餐|吃了|吃|大约|约|还有|再加|加了|然后))+/,
      "",
    );
}
export function estimateFoodText(text: string) {
  const segments = text
    .split(/[，,、；;。\n]+|还有|加上|和/)
    .map(clean)
    .filter(Boolean);
  const items: TextItem[] = segments.map((original) => {
    const unknown = (
      note: string,
      name = original,
      portion = "份量待补充",
    ): TextItem => ({
      original,
      name,
      portion,
      grams: null,
      low: null,
      high: null,
      note,
    });
    const food = REFERENCE_FOODS.find((f) =>
      f.aliases.some((alias) => original.includes(alias)),
    );
    if (!food)
      return unknown("参考表没有此食物；请手动补充热量或更准确的食物名称。");
    const alias = [...food.aliases]
      .sort((a, b) => b.length - a.length)
      .find((a) => original.includes(a))!;
    const rest = original.replace(alias, "").replace(/^(大约|约)/, "");
    const match = rest.match(new RegExp("^" + quantityPattern + "$", "i"));
    if (!match)
      return unknown(
        "请说出明确数量和单位，如“米饭200克”；不默认一份。",
        food.name,
        rest || "份量待补充",
      );
    const amount = chineseNumber(match[1]),
      unit = match[2].toLowerCase();
    if (amount === null || amount <= 0 || amount > 100000)
      return unknown("数量无效，请填写大于0的合理数量。", food.name, rest);
    let grams: number | null = null;
    if (["g", "克"].includes(unit)) grams = amount;
    if (["kg", "千克", "公斤"].includes(unit)) grams = amount * 1000;
    if (["ml", "毫升"].includes(unit) && ["牛奶", "酸奶"].includes(food.name))
      grams = amount;
    if (unit === food.unit && food.unitGrams) grams = amount * food.unitGrams;
    if (grams === null || grams > 10000)
      return unknown(
        "无法可靠换算这个单位，请改用克数；不会猜测一碗或一份的重量。",
        food.name,
        rest,
      );
    const point = (food.per100g * grams) / 100;
    return {
      original,
      name: food.name,
      portion: rest,
      grams,
      low: Math.floor((point * 0.8) / 10) * 10,
      high: Math.ceil((point * 1.2) / 10) * 10,
      note: food.note + "；内置参考表粗估，范围非统计置信区间。",
    };
  });
  const known = items.filter((i) => i.low !== null),
    complete = items.length > 0 && known.length === items.length;
  return {
    items,
    complete,
    knownLow: known.length ? known.reduce((s, i) => s + i.low!, 0) : null,
    knownHigh: known.length ? known.reduce((s, i) => s + i.high!, 0) : null,
    name: items.map((i) => i.name).join("、"),
    portion: items.map((i) => i.name + i.portion).join("；"),
    low: complete ? known.reduce((s, i) => s + i.low!, 0) : null,
    high: complete ? known.reduce((s, i) => s + i.high!, 0) : null,
  };
}
export function rewriteFoodText(
  previous: string,
  spoken: string,
  mode: "replace" | "append",
) {
  const text = spoken.trim().replace(/[。！!]+$/, "");
  const command = text.match(/^(?:把|将)?(.+?)(?:改成|改为|换成)(.+)$/);
  if (command) {
    const name = command[1].trim(),
      quantity = command[2].trim();
    const parts = previous.split(/[，,、；;。\n]+/).filter(Boolean);
    const matches = parts
      .map((p, i) => (p.includes(name) ? i : -1))
      .filter((i) => i >= 0);
    if (matches.length !== 1)
      return {
        text: previous,
        error: "没找到唯一对应的食物，请直接改写完整描述。",
      };
    if (
      !new RegExp("^" + quantityPattern + "$", "i").test(
        quantity.replace(/\s+/g, ""),
      )
    )
      return {
        text: previous,
        error: "修改时请说“把米饭改成200克”这样的数量与单位。",
      };
    parts[matches[0]] = name + quantity;
    return { text: parts.join("，"), error: "" };
  }
  return {
    text:
      mode === "append" && previous.trim()
        ? previous.trim() + "，" + text
        : text,
    error: "",
  };
}
