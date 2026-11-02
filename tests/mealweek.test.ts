import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeMemories,
  dates,
  demoData,
  empty,
  goalAt,
  parseStore,
  initial,
  summary,
  upsert,
  validateFood,
  validNumber,
  type Food,
} from "../src/lib/mealweek";
const date = "2026-11-02";
function food(low: number | null, high: number | null, id = "f"): Food {
  return {
    id,
    date,
    meal: "午餐",
    name: "饭",
    portion: "200g，整份估算",
    low,
    high,
    source: "手工",
    updatedAt: "2026-11-02T00:00:00Z",
  };
}
function fixture(
  low: number | null,
  high: number | null,
  total: number | null,
  complete = true,
) {
  const d = empty();
  d.foods = [food(low, high)];
  d.days[date] = { total, complete, source: "设备全天" };
  return d;
}
test("摄入范围减去全天消耗；负数缺口、跨零不确定", () => {
  assert.deepEqual(
    summary(fixture(1800, 2100, 2500), date).balance,
    [-700, -400],
  );
  assert.deepEqual(
    summary(fixture(2000, 2400, 2200), date).balance,
    [-200, 200],
  );
});
test("设备全天2300加运动500，总消耗仍2300", () => {
  const d = fixture(1800, 2000, 2300);
  d.exercises = [
    { id: "e", date, name: "篮球", minutes: 60, kcal: 500, source: "手工" },
  ];
  assert.equal(summary(d, date).total, 2300);
  assert.deepEqual(summary(d, date).balance, [-500, -300]);
});
test("只有运动或饮食未完整，不算日盈亏", () => {
  assert.equal(summary(fixture(1800, 2000, null), date).balance, null);
  assert.equal(summary(fixture(1800, 2000, 2300, false), date).balance, null);
});
test("未知日期和全部未知摄入不为零，部分估算保留已知小计", () => {
  assert.equal(summary(empty(), date).low, null);
  const d = fixture(null, null, 2300);
  assert.equal(summary(d, date).low, null);
  assert.equal(summary(d, date).complete, false);
  d.foods.push(food(100, 200, "known"));
  assert.equal(summary(d, date).low, 100);
  assert.equal(summary(d, date).unknown, true);
  assert.equal(summary(d, date).balance, null);
});
test("确认后的整份热量不再乘克数，编辑删除即时重算", () => {
  const d = fixture(200, 200, 2300);
  assert.equal(summary(d, date).low, 200);
  d.foods = upsert(d.foods, food(300, 350));
  assert.equal(summary(d, date).high, 350);
  d.foods = [];
  assert.equal(summary(d, date).low, null);
});
test("同一ID重复保存幂等", () => {
  let rows: Food[] = [];
  rows = upsert(rows, food(200, 200));
  rows = upsert(rows, food(200, 200));
  assert.equal(rows.length, 1);
});
test("删除与过期记忆不参与提示，有效期包含当天", () => {
  const d = empty();
  d.memories = [
    {
      id: "a",
      text: "不喜欢香菜",
      source: "用户确认",
      updatedAt: "",
      expires: date,
    },
    {
      id: "b",
      text: "临时偏好",
      source: "用户确认",
      updatedAt: "",
      expires: "2026-11-01",
    },
  ];
  assert.equal(activeMemories(d, date).length, 1);
  d.memories = d.memories.filter((m) => m.id !== "a");
  assert.deepEqual(activeMemories(d, date), []);
});
test("七日含月界且缺失日期留空，演示不含个人记录", () => {
  assert.deepEqual(dates("2026-11-02"), [
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
    "2026-11-02",
  ]);
  const d = demoData(date);
  assert.equal(summary(d, "2026-10-29").low, null);
  assert.equal(initial().personal.foods.length, 0);
});
test("目标版本不重写历史", () => {
  const d = empty();
  d.goals = [
    { id: "a", value: 2000, effective: "2026-11-01", createdAt: "1" },
    { id: "b", value: 2100, effective: date, createdAt: "2" },
  ];
  assert.equal(goalAt(d, "2026-11-01"), 2000);
  assert.equal(goalAt(d, date), 2100);
  assert.equal(goalAt(d, "2026-10-31"), null);
});
test("本地序列化可恢复，拒绝异常存储和范围", () => {
  const s = initial();
  s.personal = fixture(200, 300, 2200);
  assert.deepEqual(parseStore(JSON.stringify(s)), s);
  assert.throws(() => parseStore("{}"));
  assert.throws(() => validateFood(food(200, 100)));
  assert.throws(() => validateFood(food(null, 100)));
  assert.throws(() => validNumber("-1"));
  assert.equal(validNumber(""), null);
  assert.equal(validNumber("0"), 0);
});
