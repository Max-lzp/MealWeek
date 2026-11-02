"use client";
/* Browser-local data URLs: keep images off the Next image optimization server. */
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Flame,
  House,
  Leaf,
  Plus,
  Settings2,
  Trash2,
  Utensils,
  Camera,
  ChartNoAxesCombined,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import {
  activeMemories,
  Data,
  dates,
  demoData,
  empty,
  Exercise,
  Food,
  goalAt,
  initial,
  KEY,
  localDate,
  Memory,
  parseStore,
  Store,
  summary,
  uid,
  upsert,
  validNumber,
  validateFood,
} from "@/lib/mealweek";
import FoodInputHelper from "./FoodInputHelper";
import "./mealweek.css";
type Tab = "今日" | "添加" | "周报" | "我的";
const slots = ["早餐", "午餐", "晚餐", "加餐"];
const range = (a: number | null, b: number | null) =>
  a === null
    ? "待补充"
    : a === b
      ? `${Math.round(a)}`
      : `${Math.round(a)}–${Math.round(b ?? a)}`;
const blankFood = (date: string): Food => ({
  id: uid(),
  date,
  meal: "午餐",
  name: "",
  portion: "",
  low: null,
  high: null,
  source: "手动估计",
  updatedAt: new Date().toISOString(),
});
const inputNumber = (value: string) => (value === "" ? null : Number(value));
const numberText = (x: number | null) => (x === null ? "" : String(x));
export default function MealWeek() {
  const [store, setStore] = useState<Store>(initial),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState<Tab>("今日"),
    [date, setDate] = useState(""),
    [message, setMessage] = useState(""),
    [fatal, setFatal] = useState(false);
  const current = useRef(store),
    lock = useRef(false);
  const [draft, setDraft] = useState<Food | null>(null),
    [photoBusy, setPhotoBusy] = useState(false),
    [exercise, setExercise] = useState<Exercise | null>(null),
    [energyOpen, setEnergyOpen] = useState(false),
    [energy, setEnergy] = useState(""),
    [energySource, setEnergySource] = useState("设备全天总消耗"),
    [memory, setMemory] = useState<Memory | null>(null),
    [goal, setGoal] = useState("");
  useEffect(() => {
    setDate(localDate());
    try {
      const raw = localStorage.getItem(KEY);
      const s = raw ? parseStore(raw) : initial();
      current.current = s;
      setStore(s);
    } catch {
      setFatal(true);
      setMessage(
        "无法读取本地数据。为保护原记录，已停止写入；请先导出原始数据并检查浏览器存储。",
      );
    }
    setReady(true);
    const sync = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        try {
          const s = parseStore(e.newValue);
          current.current = s;
          setStore(s);
          setMessage("已同步其他标签页的修改");
        } catch {
          setFatal(true);
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const data = store[store.mode],
    s = summary(data, date),
    today = localDate(),
    week = dates(date),
    memories = activeMemories(data, today);
  function commit(
    fn: (s: Store) => Store,
    success = "已保存，仅保存在当前浏览器",
  ) {
    if (fatal || lock.current) return false;
    lock.current = true;
    try {
      const next = fn(current.current);
      localStorage.setItem(KEY, JSON.stringify(next));
      current.current = next;
      setStore(next);
      setMessage(success);
      return true;
    } catch {
      setMessage(
        "保存失败：浏览器存储空间不足或不可用。请导出记录后释放空间，当前修改未入账。",
      );
      return false;
    } finally {
      queueMicrotask(() => {
        lock.current = false;
      });
    }
  }
  function update(fn: (d: Data) => Data, success?: string) {
    return commit((st) => ({ ...st, [st.mode]: fn(st[st.mode]) }), success);
  }
  function switchTab(t: Tab) {
    setTab(t);
    if (t === "添加") setDraft(blankFood(date));
    setMessage("");
  }
  function saveFood(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    try {
      validateFood(draft);
      const f = {
        ...draft,
        name: draft.name.trim(),
        portion: draft.portion.trim(),
        updatedAt: new Date().toISOString(),
      };
      if (
        update((d) => ({
          ...d,
          foods: upsert(d.foods, f),
          days: {
            ...d.days,
            [f.date]: {
              ...(d.days[f.date] ?? { total: null, source: "" }),
              complete: false,
            },
          },
        }))
      ) {
        setDraft(null);
        setDate(f.date);
        setTab("今日");
      }
    } catch (err) {
      setMessage((err as Error).message);
    }
  }
  function removeFood(f: Food) {
    if (window.confirm(`删除“${f.name}”？删除后会重新计算。`))
      update(
        (d) => ({
          ...d,
          foods: d.foods.filter((x) => x.id !== f.id),
          days: {
            ...d.days,
            [f.date]: {
              ...(d.days[f.date] ?? { total: null, source: "" }),
              complete: false,
            },
          },
        }),
        "已删除食物，请重新确认当日记录完整性",
      );
  }
  async function photo(file?: File) {
    if (!file || !draft) return;
    if (file.size > 12 * 1024 * 1024) {
      setMessage("照片请小于 12 MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("请使用 JPG、PNG 或 WebP；HEIC 请先转换。");
      return;
    }
    setPhotoBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 50000000) {
        bitmap.close();
        throw new Error("图片像素过大，请缩小后重试");
      }
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = bitmap.width * scale;
      canvas.height = bitmap.height * scale;
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const url = canvas.toDataURL("image/jpeg", 0.7);
      setDraft((d) => (d ? { ...d, photo: url } : d));
      setMessage("照片已在本地压缩；不会发送给模型。请填写并审核下方信息。");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "图片无法读取，请更换照片",
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  function startEnergy() {
    setEnergy(numberText(s.total));
    setEnergySource(data.days[date]?.source || "设备全天总消耗");
    setEnergyOpen(true);
  }
  function download(raw = false) {
    const blob = new Blob(
      [
        raw
          ? localStorage.getItem(KEY) || "{}"
          : JSON.stringify(
              {
                app: "MealWeek",
                exportedAt: new Date().toISOString(),
                mode: store.mode,
                data,
              },
              null,
              2,
            ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `mealweek-${store.mode}-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  if (!ready)
    return (
      <main className="mw">
        <p>正在读取本地记录…</p>
      </main>
    );
  const balanceText = s.balance
    ? s.balance[1] < 0
      ? "估算缺口"
      : s.balance[0] > 0
        ? "估算盈余"
        : "方向不确定"
    : "暂不判断日能量盈亏";
  return (
    <div className="mw-shell">
      <aside className="desktop-note">
        <Leaf size={32} />
        <h2>
          一餐一记，
          <br />
          让运动有迹可循。
        </h2>
        <p>MEALWEEK / PERSONAL JOURNAL</p>
        <span>
          少一点猜测，多一点记录。
          <br />
          用一周，看见自己的节奏。
        </span>
        <div className="side-lines">食物 · 运动 · 复盘</div>
      </aside>
      <main className="mw">
        <header className="topbar">
          <Link href="/" className="wordmark">
            <span className="brand-icon">
              <Leaf size={20} />
            </span>
            MealWeek<span className="beta">个人实验</span>
          </Link>
          <button
            className="icon-button"
            aria-label="打开我的"
            onClick={() => switchTab("我的")}
          >
            <Settings2 size={20} />
          </button>
        </header>
        <div className="privacy">
          仅保存在当前浏览器 · 无云同步 · 非医疗产品
        </div>
        {store.mode === "demo" && (
          <div className="demo-banner">
            <Sparkles size={16} />
            <span>演示空间 · 所有记录均为示例</span>
            <button
              onClick={() =>
                commit((st) => ({ ...st, mode: "personal" }), "已返回个人空间")
              }
            >
              回到个人
            </button>
          </div>
        )}
        {message && (
          <div role="status" className="notice">
            <span>{message}</span>
            <button aria-label="关闭提示" onClick={() => setMessage("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {fatal && (
          <button className="secondary" onClick={() => download(true)}>
            导出原始数据
          </button>
        )}
        <div className="page-title">
          <div>
            <div className="eyebrow">
              {tab === "今日"
                ? "YOUR DAILY RHYTHM"
                : tab === "添加"
                  ? "MAKE EVERY MEAL COUNT"
                  : tab === "周报"
                    ? "A WEEK IN PERSPECTIVE"
                    : "YOUR OWN PACE"}
            </div>
            <h1>
              {tab === "今日"
                ? "今天，好好吃饭。"
                : tab === "添加"
                  ? draft && data.foods.some((f) => f.id === draft.id)
                    ? "修改这一餐"
                    : "记录这一餐"
                  : tab === "周报"
                    ? "看见一周的节奏"
                    : "我的生活，自己定义"}
            </h1>
            <p>
              {tab === "今日"
                ? "记录是理解自己的开始。"
                : tab === "添加"
                  ? "照片留住这一餐，数值由你确认。"
                  : tab === "周报"
                    ? "不追求完美，先让记录慢慢完整。"
                    : "目标与偏好，都由你主动确认。"}
            </p>
          </div>
        </div>
        {(tab === "今日" || tab === "周报") && (
          <div className="datebar">
            <span>{tab === "今日" ? "记录日期" : "七日报告截至"}</span>
            <input
              aria-label="记录日期"
              type="date"
              max={today}
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
            {date === today && <span className="pill">今天</span>}
          </div>
        )}
        {tab === "今日" && (
          <>
            <section className="hero">
              <div className="hero-top">
                <span>
                  <Flame size={17} /> 已记录摄入
                </span>
                <span className="hero-tag">
                  {s.complete ? "饮食已确认完整" : "饮食记录待补全"}
                </span>
              </div>
              <div className="hero-value" data-testid="intake">
                {range(s.low, s.high)} <small>kcal</small>
              </div>
              <p>
                {s.unknown
                  ? "含未知热量项 · 上方为已知小计"
                  : s.foods.length
                    ? "来自你确认的食物估算"
                    : "从记录第一餐开始，未知不记为零"}
              </p>
              <div className="hero-bottom">
                <div>
                  <span>全天总消耗</span>
                  <strong>
                    {s.total === null ? "待补充" : `${s.total} kcal`}
                  </strong>
                </div>
                <button onClick={startEnergy}>
                  填写消耗 <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
            <div className="balance-box">
              <Activity size={20} />
              <div>
                <strong>{balanceText}</strong>
                <p>
                  {s.balance
                    ? `${range(s.balance[0], s.balance[1])} kcal · 摄入 − 全天总消耗`
                    : "需确认饮食完整，并填写有来源的全天总消耗。"}
                </p>
              </div>
            </div>
            {s.target !== null && (
              <div className="target-note">
                手动摄入目标 {s.target} kcal ·{" "}
                {s.low === null
                  ? "尚无记录"
                  : `已记录摄入与目标差 ${range(s.low - s.target, s.high! - s.target)} kcal`}
                <small>与目标差额不是实际能量盈亏；目标按生效日期显示。</small>
              </div>
            )}
            <section>
              <div className="section-heading">
                <h2>
                  餐桌手记 <span>{s.foods.length} 条</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() => switchTab("添加")}
                >
                  <Plus size={16} />
                  记一餐
                </button>
              </div>
              {!s.foods.length ? (
                <div className="empty-card">
                  <div className="empty-icon">
                    <Utensils size={28} />
                  </div>
                  <h3>你的下一餐，从这里开始</h3>
                  <p>
                    拍一张照片，记下食物与份量。
                    <br />
                    不用精确，也可以慢慢补充。
                  </p>
                  <button className="primary" onClick={() => switchTab("添加")}>
                    <Plus size={18} />
                    记录第一餐
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      commit(
                        (st) => ({
                          ...st,
                          mode: "demo",
                          demo: demoData(today),
                        }),
                        "已加载独立演示数据，不影响个人记录",
                      )
                    }
                  >
                    先看看七日演示 <ChevronRight size={16} />
                  </button>
                </div>
              ) : (
                <div className="meal-list">
                  {slots.map((slot) => {
                    const foods = s.foods.filter((f) => f.meal === slot);
                    return (
                      foods.length > 0 && (
                        <div key={slot}>
                          <div className="slot-label">
                            {slot}
                            <span>{foods.length} 条记录</span>
                          </div>
                          {foods.map((f) => (
                            <article className="food-card" key={f.id}>
                              {f.photo ? (
                                <img
                                  src={f.photo}
                                  alt={`${f.name}的餐食照片`}
                                />
                              ) : (
                                <div className="food-icon">
                                  <Utensils size={21} />
                                </div>
                              )}
                              <div className="food-info">
                                <h3>{f.name}</h3>
                                <p>
                                  {f.portion} · {f.source}
                                </p>
                                <strong>
                                  {range(f.low, f.high)} <small>kcal</small>
                                </strong>
                              </div>
                              <div className="food-actions">
                                <button
                                  aria-label={`修改${f.name}`}
                                  onClick={() => {
                                    setDraft({ ...f });
                                    setTab("添加");
                                    setMessage("");
                                  }}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  aria-label={`删除${f.name}`}
                                  onClick={() => removeFood(f)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )
                    );
                  })}
                </div>
              )}
              <label className="complete-check">
                <input
                  type="checkbox"
                  checked={!!data.days[date]?.complete}
                  disabled={s.foods.length === 0 || s.unknown || fatal}
                  onChange={(e) => {
                    const complete = e.target.checked;
                    update((d) => ({
                      ...d,
                      days: {
                        ...d.days,
                        [date]: {
                          ...(d.days[date] ?? { total: null, source: "" }),
                          complete,
                        },
                      },
                    }));
                  }}
                />
                <span>
                  我确认这一天的饮食已记录完整
                  <small>新增、修改或删除食物后，需再次确认。</small>
                </span>
              </label>
            </section>
            <section>
              <div className="section-heading">
                <h2>
                  动起来 <span>运动记录</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() =>
                    setExercise({
                      id: uid(),
                      date,
                      name: "",
                      minutes: 30,
                      kcal: null,
                      source: "手工估计",
                    })
                  }
                >
                  <Plus size={16} />
                  记录运动
                </button>
              </div>
              <div className="exercise-panel">
                {data.exercises.filter((x) => x.date === date).length === 0 ? (
                  <div className="muted-row">
                    <Dumbbell size={24} />
                    <p>
                      今天的运动，也值得被记住。
                      <small>只有运动消耗时，不计算全天盈亏。</small>
                    </p>
                  </div>
                ) : (
                  data.exercises
                    .filter((x) => x.date === date)
                    .map((x) => (
                      <div className="exercise-row" key={x.id}>
                        <Dumbbell size={20} />
                        <div>
                          <strong>{x.name}</strong>
                          <p>
                            {x.minutes} 分钟 ·{" "}
                            {x.kcal === null ? "热量未知" : `${x.kcal} kcal`} ·{" "}
                            {x.source}
                          </p>
                        </div>
                        <button
                          aria-label={`修改运动${x.name}`}
                          onClick={() => setExercise({ ...x })}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          aria-label={`删除运动${x.name}`}
                          onClick={() => {
                            if (confirm("删除这条运动记录？"))
                              update((d) => ({
                                ...d,
                                exercises: d.exercises.filter(
                                  (e) => e.id !== x.id,
                                ),
                              }));
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                )}
                <p className="footnote">
                  {s.total === null
                    ? "尚未填写全天总消耗。"
                    : `全天总消耗来源：${data.days[date]?.source}。`}
                  设备全天数值已包含运动，不会再次叠加。
                </p>
              </div>
            </section>
            {memories.length > 0 && (
              <div className="memory-hint">
                <Leaf size={18} />
                <div>
                  <strong>你的偏好，记在这里</strong>
                  <p>
                    {memories.map((m) => m.text).join("；")}
                    。选餐时可参考这些偏好。
                  </p>
                </div>
              </div>
            )}
          </>
        )}
        {tab === "添加" && draft && (
          <form onSubmit={saveFood} className="add-form">
            <FoodInputHelper
              key={draft.id}
              onApply={(fields) => {
                setDraft((d) => (d ? { ...d, ...fields } : d));
                setMessage(
                  "文字参考估算已填入，请核对名称、份量与热量，确认后才入账。",
                );
              }}
            />
            <div className="photo-upload">
              {draft.photo ? (
                <>
                  <img src={draft.photo} alt="待确认餐食照片" />
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={() => setDraft({ ...draft, photo: undefined })}
                  >
                    移除照片
                  </button>
                </>
              ) : (
                <>
                  <Camera size={32} />
                  <h3>把这一餐，留在手记里</h3>
                  <p>支持 JPG / PNG / WebP，最大 12 MB</p>
                </>
              )}
              <label className="upload-button">
                {photoBusy
                  ? "正在处理…"
                  : draft.photo
                    ? "更换照片"
                    : "拍照 / 上传照片"}
                <input
                  aria-label="上传食物照片"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={photoBusy}
                  onChange={(e) => photo(e.target.files?.[0])}
                />
              </label>
              <small>图片仅在本地压缩保存，不发送给 AI。</small>
            </div>
            <div className="form-card">
              <div className="section-heading">
                <h2>核对餐食信息</h2>
                <span className="pill">待确认</span>
              </div>
              <label>
                记录日期
                <input
                  required
                  aria-label="餐食日期"
                  type="date"
                  max={today}
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <fieldset>
                <legend>餐次</legend>
                <div className="slot-picker">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={draft.meal === slot ? "selected" : ""}
                      onClick={() => setDraft({ ...draft, meal: slot })}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label>
                食物名称
                <input
                  required
                  maxLength={500}
                  placeholder="例如：鸡肉蔬菜饭"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                份量
                <input
                  required
                  maxLength={500}
                  placeholder="例如：1 碗 / 约 300 克"
                  value={draft.portion}
                  onChange={(e) =>
                    setDraft({ ...draft, portion: e.target.value })
                  }
                />
              </label>
              <div className="field-pair">
                <label>
                  热量下限（kcal）
                  <input
                    aria-label="热量下限"
                    type="number"
                    min="0"
                    max="50000"
                    step="any"
                    placeholder="未知可留空"
                    value={numberText(draft.low)}
                    onChange={(e) =>
                      setDraft({ ...draft, low: inputNumber(e.target.value) })
                    }
                  />
                </label>
                <label>
                  热量上限（kcal）
                  <input
                    aria-label="热量上限"
                    type="number"
                    min="0"
                    max="50000"
                    step="any"
                    placeholder="与下限相同可填同值"
                    value={numberText(draft.high)}
                    onChange={(e) =>
                      setDraft({ ...draft, high: inputNumber(e.target.value) })
                    }
                  />
                </label>
              </div>
              <p className="footnote">
                填写当前整份食物的总热量估算，不会再次乘以克数。未知时上下限均留空；范围不代表统计置信区间。
              </p>
              <label>
                估算来源
                <select
                  value={draft.source}
                  onChange={(e) =>
                    setDraft({ ...draft, source: e.target.value })
                  }
                >
                  {[
                    "手动估计",
                    "营养标签",
                    "用户确认的数据源",
                    "内置参考表估算（非AI）",
                    "模拟识别（演示）",
                    "演示数据",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              {draft.source.includes("演示") && (
                <div className="mock-warning">
                  演示结果，非真实图片识别。请逐项核对并更正。
                </div>
              )}
              <details className="mock-details">
                <summary>仅供演示：固定模拟结果（不分析照片）</summary>
                <button
                  type="button"
                  className="secondary full"
                  onClick={() => {
                    if (
                      confirm(
                        "填入固定演示结果？这不分析照片，也不是真实图片识别。",
                      )
                    ) {
                      setDraft({
                        ...draft,
                        name: "鸡肉蔬菜饭（请审核）",
                        portion: "1 碗，约 350 克",
                        low: 550,
                        high: 750,
                        source: "模拟识别（演示）",
                      });
                    }
                  }}
                >
                  <Sparkles size={16} />
                  模拟识别 · 非真实图片识别
                </button>
              </details>
            </div>
            <div className="review-note">
              <Check size={18} />
              <p>
                确认食物、份量和热量后再入账。
                <br />
                可以保存后继续添加同一餐的其他食物。
              </p>
            </div>
            <button
              type="submit"
              className="primary full"
              disabled={photoBusy || fatal}
            >
              <Check size={18} />
              确认保存这一项
            </button>
            <button
              type="button"
              className="text-button full"
              onClick={() => {
                setDraft(null);
                setTab("今日");
              }}
            >
              取消，不入账
            </button>
          </form>
        )}
        {tab === "周报" && (
          <>
            <section className="week-intro">
              <div>
                <span className="eyebrow">WEEKLY REFLECTION</span>
                <h2>
                  有效记录{" "}
                  <strong>
                    {
                      week.filter(
                        (d) =>
                          summary(data, d).complete &&
                          summary(data, d).total !== null,
                      ).length
                    }
                  </strong>{" "}
                  / 7 天
                </h2>
                <p>
                  {week[0].slice(5).replace("-", ".")} —{" "}
                  {date.slice(5).replace("-", ".")} · 完整饮食且有全天消耗
                </p>
              </div>
              <ChartNoAxesCombined size={38} />
            </section>
            <section className="chart-card">
              <div className="section-heading">
                <h2>七日能量估算</h2>
                <span className="unit">kcal</span>
              </div>
              <div className="legend">
                <span>
                  <i />
                  摄入估算范围
                </span>
                <span>
                  <i className="gray" />
                  全天消耗
                </span>
              </div>
              <div className="chart">
                {(() => {
                  const max = Math.max(
                    2500,
                    ...week.flatMap((d) => {
                      const r = summary(data, d);
                      return [r.high ?? 0, r.total ?? 0];
                    }),
                  );
                  return week.map((d) => {
                    const r = summary(data, d);
                    return (
                      <div className="chart-day" key={d}>
                        <div className="bars">
                          <div className="bar-space">
                            {r.low !== null ? (
                              <div
                                className="bar intake"
                                style={{
                                  height: `${Math.max(1, ((r.high ?? r.low) / max) * 100)}%`,
                                }}
                                title={`摄入 ${range(r.low, r.high)} kcal`}
                              >
                                <div
                                  className="range-cap"
                                  style={{
                                    height: `${r.high ? ((r.high - r.low) / r.high) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="missing">—</span>
                            )}
                          </div>
                          <div className="bar-space">
                            {r.total !== null ? (
                              <div
                                className="bar expenditure"
                                style={{
                                  height: `${Math.max(1, (r.total / max) * 100)}%`,
                                }}
                                title={`消耗 ${r.total} kcal`}
                              />
                            ) : (
                              <span className="missing">—</span>
                            )}
                          </div>
                        </div>
                        <span>{d.slice(8)}</span>
                        <i
                          className={
                            r.complete ? "day-dot complete" : "day-dot"
                          }
                        />
                      </div>
                    );
                  });
                })()}
              </div>
              <p className="footnote">
                缺失日期留空（—），不补零。浅色条顶表示摄入估算范围；圆点实心表示饮食完整。图表用已知值，部分记录见下表。
              </p>
            </section>
            <div className="week-table">
              <div className="week-row table-head">
                <span>日期 / 状态</span>
                <span>摄入</span>
                <span>总消耗</span>
              </div>
              {week.map((d) => {
                const r = summary(data, d);
                return (
                  <button
                    className="week-row"
                    key={d}
                    onClick={() => {
                      setDate(d);
                      setTab("今日");
                    }}
                  >
                    <span>
                      <strong>{d.slice(5).replace("-", "/")}</strong>
                      <small>
                        {r.complete
                          ? "饮食完整"
                          : r.foods.length
                            ? "部分记录"
                            : "未记录"}
                      </small>
                    </span>
                    <span>
                      {range(r.low, r.high)}
                      {r.unknown ? " *" : ""}
                    </span>
                    <span>{r.total ?? "待补充"}</span>
                  </button>
                );
              })}
            </div>
            <div className="reflection">
              <Leaf size={22} />
              <h3>这周，先照顾好记录的节奏</h3>
              <p>
                留空的日子不代表没有吃饭。先补齐记录与消耗来源，再复盘训练和饮食；不根据某一天自动调整目标。
              </p>
              {memories.length > 0 && (
                <p>当前有效偏好：{memories.map((m) => m.text).join("；")}</p>
              )}
            </div>
            <button
              className="secondary full"
              onClick={() => switchTab("我的")}
            >
              到「我的」查看 / 手动调整目标 <ChevronRight size={16} />
            </button>
          </>
        )}
        {tab === "我的" && (
          <>
            <div className="profile-card">
              <div className="profile-avatar">
                <Leaf size={30} />
              </div>
              <div>
                <h2>自己的节奏，自己掌握</h2>
                <p>个人作品实验 · 本地模式</p>
              </div>
            </div>
            <section className="form-card">
              <h2>个人摄入目标</h2>
              <p className="footnote">
                由你手工设定，不自动推荐减脂目标。修改需确认，自今天生效，保留历史版本。
              </p>
              <p className="current-goal">
                {goalAt(data, today) ?? "尚未设定"}{" "}
                <small>{goalAt(data, today) !== null ? "kcal / 天" : ""}</small>
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    const value = validNumber(goal);
                    if (value === null || value <= 0)
                      throw new Error("请输入大于 0 的目标");
                    if (
                      confirm(
                        `确认将今天起的手动摄入目标设为 ${value} kcal？这不代表推荐摄入量。`,
                      )
                    ) {
                      if (
                        update((d) => ({
                          ...d,
                          goals: [
                            ...d.goals,
                            {
                              id: uid(),
                              value,
                              effective: today,
                              createdAt: new Date().toISOString(),
                            },
                          ],
                        }))
                      )
                        setGoal("");
                    }
                  } catch (err) {
                    setMessage((err as Error).message);
                  }
                }}
              >
                <label>
                  新目标（kcal / 天）
                  <input
                    type="number"
                    required
                    min="1"
                    max="50000"
                    placeholder="自行填写"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </label>
                <button className="secondary full" type="submit">
                  确认修改目标
                </button>
              </form>
              {data.goals.length > 0 && (
                <details>
                  <summary>目标修改历史（{data.goals.length}）</summary>
                  {data.goals.map((g) => (
                    <p className="footnote" key={g.id}>
                      {g.effective} 起 · {g.value} kcal ·{" "}
                      {new Date(g.createdAt).toLocaleTimeString("zh-CN")}
                    </p>
                  ))}
                </details>
              )}
            </section>
            <section>
              <div className="section-heading">
                <h2>
                  偏好记忆 <span>{memories.length} 条有效</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() =>
                    setMemory({
                      id: uid(),
                      text: "",
                      source: "用户主动确认",
                      updatedAt: "",
                      expires: "",
                    })
                  }
                >
                  <Plus size={16} />
                  添加偏好
                </button>
              </div>
              <p className="footnote">
                一次饮食不会自动变成长期偏好。只有你确认且未过期的偏好参与提示。
              </p>
              {data.memories.length === 0 ? (
                <div className="simple-empty">
                  让选择更贴近自己。
                  <br />
                  <small>例如：不喜欢香菜、喜欢清淡口味。</small>
                </div>
              ) : (
                data.memories.map((m) => (
                  <div className="memory-card" key={m.id}>
                    <div>
                      <strong>{m.text}</strong>
                      <span className="pill">
                        {m.expires && m.expires < today ? "已过期" : "有效"}
                      </span>
                      <p>
                        {m.source} · 更新于{" "}
                        {new Date(m.updatedAt).toLocaleDateString("zh-CN")}
                      </p>
                      <small>
                        {m.expires
                          ? `有效至 ${m.expires}`
                          : "长期有效，直到你修改或删除"}
                      </small>
                    </div>
                    <div className="food-actions">
                      <button
                        aria-label={`修改偏好${m.text}`}
                        onClick={() => setMemory({ ...m })}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        aria-label={`删除偏好${m.text}`}
                        onClick={() => {
                          if (confirm("删除此偏好？删除后不再用于当前提示。"))
                            update(
                              (d) => ({
                                ...d,
                                memories: d.memories.filter(
                                  (x) => x.id !== m.id,
                                ),
                              }),
                              "偏好已删除，不再参与提示",
                            );
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
            <section className="form-card">
              <h2>数据与演示</h2>
              <p className="footnote">
                个人与演示空间独立。记录仅保存在当前浏览器；更换设备、清理网站数据可能丢失，请定期导出。
              </p>
              <button className="settings-row" onClick={() => download()}>
                <ArrowDownToLine size={19} />
                <span>导出当前空间 JSON 记录</span>
                <ChevronRight size={16} />
              </button>
              <button
                className="settings-row"
                onClick={() => {
                  if (
                    store.demo.foods.length &&
                    !confirm("重新加载会替换演示空间，个人记录不受影响。继续？")
                  )
                    return;
                  commit(
                    (st) => ({ ...st, mode: "demo", demo: demoData(today) }),
                    "已加载七日演示数据",
                  );
                }}
              >
                <Sparkles size={19} />
                <span>加载七日演示数据</span>
                <ChevronRight size={16} />
              </button>
              <button
                className="settings-row"
                onClick={() =>
                  commit(
                    (st) => ({
                      ...st,
                      mode: st.mode === "demo" ? "personal" : "demo",
                    }),
                    "已切换数据空间",
                  )
                }
              >
                <ClipboardList size={19} />
                <span>
                  {store.mode === "demo" ? "切换到个人空间" : "切换到演示空间"}
                </span>
                <ChevronRight size={16} />
              </button>
              <button
                className="settings-row"
                onClick={() => {
                  if (confirm("清除全部演示记录与偏好？个人数据不受影响。"))
                    commit(
                      (st) => ({ ...st, demo: empty(), mode: "personal" }),
                      "演示数据已清除",
                    );
                }}
              >
                <Trash2 size={19} />
                <span>清除演示数据</span>
              </button>
              <button
                className="settings-row danger"
                onClick={() => {
                  if (confirm("永久清除个人空间全部记录？建议先导出。"))
                    commit(
                      (st) => ({ ...st, personal: empty() }),
                      "个人记录已清除",
                    );
                }}
              >
                <Trash2 size={19} />
                <span>清除个人数据</span>
              </button>
            </section>
            <div className="about">
              <strong>MealWeek / 运动与饮食手记</strong>
              <p>
                基于 Tally 的 Next.js + TypeScript 底座二次开发
                <br />
                Tally © 2026 Gene Arnold · MIT
                <br />
                MealWeek 中文流程、计算、本地记录与偏好：Max 的产品实验，Codex
                协助实现。
              </p>
              <p>
                AI 模型选型中 · 未接入 API
                <br />
                文字参考估算非 AI · 无云同步 · 无医疗建议
              </p>
            </div>
          </>
        )}
        <footer className="page-footer">
          用记录了解自己，给生活留一点余地。<span>MEALWEEK</span>
        </footer>
        <nav className="bottom-nav" aria-label="主导航">
          {(
            [
              { name: "今日", Icon: House },
              { name: "添加", Icon: Plus },
              { name: "周报", Icon: ChartNoAxesCombined },
              { name: "我的", Icon: Leaf },
            ] as const
          ).map(({ name, Icon }) => (
            <button
              key={name}
              aria-current={tab === name ? "page" : undefined}
              className={tab === name ? "active" : ""}
              onClick={() => switchTab(name)}
            >
              <span className={name === "添加" ? "add-nav" : ""}>
                <Icon size={21} />
              </span>
              {name}
            </button>
          ))}
        </nav>
        {energyOpen && (
          <div className="modal-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="energy-title"
              className="modal"
            >
              <div className="section-heading">
                <h2 id="energy-title">全天总消耗</h2>
                <button
                  aria-label="关闭消耗表单"
                  onClick={() => setEnergyOpen(false)}
                >
                  <X />
                </button>
              </div>
              <p>
                填写设备或其他明确来源的全天总数，已包含运动，不再叠加运动记录。
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    const total = validNumber(energy);
                    if (!energySource.trim()) throw new Error("请填写来源");
                    if (
                      update((d) => ({
                        ...d,
                        days: {
                          ...d.days,
                          [date]: {
                            complete: d.days[date]?.complete ?? false,
                            total,
                            source: energySource.trim(),
                          },
                        },
                      }))
                    )
                      setEnergyOpen(false);
                  } catch (err) {
                    setMessage((err as Error).message);
                  }
                }}
              >
                <label>
                  全天总消耗（kcal）
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    max="50000"
                    step="any"
                    placeholder="未知请留空"
                    value={energy}
                    onChange={(e) => setEnergy(e.target.value)}
                  />
                </label>
                <label>
                  来源（必填）
                  <input
                    required
                    maxLength={80}
                    value={energySource}
                    onChange={(e) => setEnergySource(e.target.value)}
                  />
                </label>
                <p className="footnote">
                  留空保存可清除总消耗。仅有运动数据时不计算日盈亏。本版不提供基线＋运动模式。
                </p>
                <button className="primary full">确认保存全天消耗</button>
              </form>
            </section>
          </div>
        )}
        {exercise && (
          <div className="modal-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="exercise-title"
              className="modal"
            >
              <div className="section-heading">
                <h2 id="exercise-title">记录运动</h2>
                <button
                  aria-label="关闭运动表单"
                  onClick={() => setExercise(null)}
                >
                  <X />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!exercise.name.trim()) {
                    setMessage("请填写运动名称");
                    return;
                  }
                  if (
                    update((d) => ({
                      ...d,
                      exercises: upsert(d.exercises, exercise),
                    }))
                  )
                    setExercise(null);
                }}
              >
                <label>
                  运动名称
                  <input
                    required
                    maxLength={60}
                    placeholder="例如：篮球 / 慢跑"
                    value={exercise.name}
                    onChange={(e) =>
                      setExercise({ ...exercise, name: e.target.value })
                    }
                  />
                </label>
                <div className="field-pair">
                  <label>
                    时长（分钟）
                    <input
                      required
                      type="number"
                      min="0"
                      max="1440"
                      value={exercise.minutes}
                      onChange={(e) =>
                        setExercise({
                          ...exercise,
                          minutes: inputNumber(e.target.value) ?? 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    运动消耗（kcal）
                    <input
                      type="number"
                      min="0"
                      max="50000"
                      placeholder="未知可留空"
                      value={numberText(exercise.kcal)}
                      onChange={(e) =>
                        setExercise({
                          ...exercise,
                          kcal: inputNumber(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  估算来源
                  <input
                    required
                    maxLength={80}
                    value={exercise.source}
                    onChange={(e) =>
                      setExercise({ ...exercise, source: e.target.value })
                    }
                  />
                </label>
                <p className="footnote">
                  运动数据仅作说明，不叠加到设备全天总消耗。
                </p>
                <button className="primary full">确认保存运动</button>
              </form>
            </section>
          </div>
        )}
        {memory && (
          <div className="modal-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="memory-title"
              className="modal"
            >
              <div className="section-heading">
                <h2 id="memory-title">确认偏好记忆</h2>
                <button
                  aria-label="关闭偏好表单"
                  onClick={() => setMemory(null)}
                >
                  <X />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!memory.text.trim()) return;
                  if (confirm("确认保存这个由你主动声明的偏好？")) {
                    if (
                      update((d) => ({
                        ...d,
                        memories: upsert(d.memories, {
                          ...memory,
                          text: memory.text.trim(),
                          updatedAt: new Date().toISOString(),
                        }),
                      }))
                    )
                      setMemory(null);
                  }
                }}
              >
                <label>
                  我的偏好
                  <input
                    required
                    maxLength={120}
                    placeholder="例如：不喜欢香菜"
                    value={memory.text}
                    onChange={(e) =>
                      setMemory({ ...memory, text: e.target.value })
                    }
                  />
                </label>
                <label>
                  有效至（可选，包含当天）
                  <input
                    type="date"
                    value={memory.expires}
                    onChange={(e) =>
                      setMemory({ ...memory, expires: e.target.value })
                    }
                  />
                </label>
                <p className="footnote">
                  来源：用户主动确认。过期或删除后不参与提示。更正冲突偏好时请编辑原条目。
                </p>
                <button className="primary full">确认记住这个偏好</button>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
