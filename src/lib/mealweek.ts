export type Food = {
  id: string;
  date: string;
  meal: string;
  name: string;
  portion: string;
  low: number | null;
  high: number | null;
  source: string;
  photo?: string;
  updatedAt: string;
};
export type Exercise = {
  id: string;
  date: string;
  name: string;
  minutes: number;
  kcal: number | null;
  source: string;
};
export type Day = { complete: boolean; total: number | null; source: string };
export type Memory = {
  id: string;
  text: string;
  source: string;
  updatedAt: string;
  expires: string;
};
export type Goal = {
  id: string;
  value: number;
  effective: string;
  createdAt: string;
};
export type Data = {
  foods: Food[];
  exercises: Exercise[];
  days: Record<string, Day>;
  memories: Memory[];
  goals: Goal[];
};
export type Store = {
  version: 1;
  mode: "personal" | "demo";
  personal: Data;
  demo: Data;
};
export const KEY = "mealweek.v1";
export const empty = (): Data => ({
  foods: [],
  exercises: [],
  days: {},
  memories: [],
  goals: [],
});
export const initial = (): Store => ({
  version: 1,
  mode: "personal",
  personal: empty(),
  demo: empty(),
});
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dates(end: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end + "T12:00:00");
    d.setDate(d.getDate() - 6 + i);
    return localDate(d);
  });
}
export const uid = () => crypto.randomUUID();
export function upsert<T extends { id: string }>(rows: T[], item: T) {
  return [...rows.filter((x) => x.id !== item.id), item];
}
export function activeMemories(data: Data, date = localDate()) {
  return data.memories.filter((x) => !x.expires || x.expires >= date);
}
export function goalAt(data: Data, date: string) {
  return (
    [...data.goals]
      .filter((x) => x.effective <= date)
      .sort(
        (a, b) =>
          b.effective.localeCompare(a.effective) ||
          b.createdAt.localeCompare(a.createdAt),
      )[0]?.value ?? null
  );
}
export function summary(data: Data, date: string) {
  const foods = data.foods.filter((x) => x.date === date),
    day = data.days[date];
  const known = foods.filter((x) => x.low !== null && x.high !== null);
  const low = known.length ? known.reduce((n, x) => n + x.low!, 0) : null;
  const high = known.length ? known.reduce((n, x) => n + x.high!, 0) : null;
  const unknown = known.length !== foods.length;
  const total = day?.total ?? null;
  const complete = !!day?.complete && !unknown && foods.length > 0;
  return {
    foods,
    low,
    high,
    unknown,
    total,
    complete,
    balance:
      complete && total !== null
        ? ([low! - total, high! - total] as [number, number])
        : null,
    target: goalAt(data, date),
  };
}
export function demoData(end: string): Data {
  const data = empty();
  dates(end).forEach((date, i) => {
    if (i === 2 || i === 5) return;
    data.foods.push({
      id: `demo-${i}`,
      date,
      meal: "午餐",
      name: i === 6 ? "鸡肉饭（示例）" : "一日饮食汇总（示例）",
      portion: i === 6 ? "1 碗" : "演示汇总",
      low: i === 6 ? 580 : 1800 + i * 60,
      high: i === 6 ? 720 : 2000 + i * 60,
      source: "演示数据",
      updatedAt: new Date().toISOString(),
    });
    data.days[date] = {
      complete: i !== 6,
      total: 2300 + i * 30,
      source: "设备全天总消耗（演示）",
    };
    data.exercises.push({
      id: `exercise-${i}`,
      date,
      name: i % 2 ? "篮球" : "休息",
      minutes: i % 2 ? 60 : 0,
      kcal: i % 2 ? 400 : 0,
      source: "手工估计（演示）",
    });
  });
  return data;
}
export function validNumber(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0)
    throw new Error("数值须为大于或等于 0 的有限数字");
  return n;
}
export function validateFood(f: Food) {
  if (!f.name.trim() || !f.portion.trim())
    throw new Error("请填写食物名称和份量");
  if ((f.low === null) !== (f.high === null))
    throw new Error("请同时填写估算下限和上限，或都留空");
  if (
    f.low !== null &&
    f.high !== null &&
    (f.low < 0 ||
      f.high < f.low ||
      !Number.isFinite(f.low) ||
      !Number.isFinite(f.high))
  )
    throw new Error("热量范围无效：上限不能低于下限");
}
export function parseStore(raw: string): Store {
  const s = JSON.parse(raw) as Store;
  if (s.version !== 1 || !["personal", "demo"].includes(s.mode))
    throw new Error("数据版本不支持");
  for (const data of [s.personal, s.demo]) {
    if (
      !data ||
      !Array.isArray(data.foods) ||
      !Array.isArray(data.exercises) ||
      !Array.isArray(data.memories) ||
      !Array.isArray(data.goals) ||
      !data.days
    )
      throw new Error("存储数据结构异常");
    data.foods.forEach(validateFood);
  }
  return s;
}
