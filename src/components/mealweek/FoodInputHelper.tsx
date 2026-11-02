"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Mic, Square, Sparkles, PenLine, ArrowDownToLine } from "lucide-react";
import {
  estimateFoodText,
  rewriteFoodText,
  REFERENCE_FOODS,
} from "@/lib/food-text";
import type { Food } from "@/lib/mealweek";
import "./food-input.css";
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechCtor = new () => SpeechInstance;
type SpeechWindow = {
  SpeechRecognition?: SpeechCtor;
  webkitSpeechRecognition?: SpeechCtor;
};
const subscribeSupport = () => () => {};
const getSpeechSupport = () => {
  const w = window as unknown as SpeechWindow;
  return (
    !!(w.SpeechRecognition || w.webkitSpeechRecognition) &&
    window.isSecureContext
  );
};
export default function FoodInputHelper({
  onApply,
}: {
  onApply: (
    fields: Pick<Food, "name" | "portion" | "low" | "high" | "source">,
  ) => void;
}) {
  const [mode, setMode] = useState<"ai" | "manual">("manual"),
    [text, setText] = useState(""),
    [listening, setListening] = useState(false),
    [voiceMode, setVoiceMode] = useState<"replace" | "append">("replace"),
    [voiceText, setVoiceText] = useState(""),
    [error, setError] = useState("");
  const speechSession = useRef({
    generation: 0,
    recognition: null as SpeechInstance | null,
  });
  const supported = useSyncExternalStore(
    subscribeSupport,
    getSpeechSupport,
    () => false,
  );
  const estimate = useMemo(() => estimateFoodText(text), [text]);
  useEffect(() => {
    const session = speechSession.current;
    return () => {
      session.generation++;
      session.recognition?.abort();
    };
  }, []);
  function startVoice() {
    const w = window as unknown as SpeechWindow,
      Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    speechSession.current.recognition?.abort();
    const ticket = ++speechSession.current.generation,
      r = new Ctor();
    speechSession.current.recognition = r;
    r.lang = "zh-CN";
    r.continuous = false;
    r.interimResults = true;
    setError("");
    setVoiceText("");
    let final = "";
    const previous = text,
      operation = voiceMode;
    r.onresult = (event) => {
      if (ticket !== speechSession.current.generation) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i];
        if (part.isFinal) final += part[0].transcript;
        else interim += part[0].transcript;
      }
      setVoiceText(final + interim);
      if (final) {
        const result = rewriteFoodText(previous, final, operation);
        setText(result.text.slice(0, 500));
        setError(result.error);
      }
    };
    r.onerror = (event) => {
      if (ticket !== speechSession.current.generation) return;
      const errors: Record<string, string> = {
        "not-allowed": "麦克风权限被拒绝，请在浏览器设置中允许，或直接打字。",
        "service-not-allowed": "当前浏览器不允许语音服务，请直接打字。",
        "audio-capture": "无法访问麦克风，请检查设备权限。",
        "no-speech": "没有听清，请重试或直接打字。",
        network: "浏览器语音服务连接失败，请直接打字。",
        aborted: "语音已取消，可直接打字。",
      };
      setError(errors[event.error] || "语音输入未完成，请重试或直接打字。");
      setListening(false);
    };
    r.onend = () => {
      if (ticket === speechSession.current.generation) {
        setListening(false);
        speechSession.current.recognition = null;
      }
    };
    try {
      setListening(true);
      r.start();
    } catch {
      setError("无法启动语音，请检查浏览器支持与麦克风权限。");
      setListening(false);
    }
  }
  function cancelVoice() {
    speechSession.current.generation++;
    speechSession.current.recognition?.abort();
    speechSession.current.recognition = null;
    setListening(false);
    setVoiceText("");
    setError("语音已取消，已完成的文字仍可编辑。");
  }
  const bounds = (low: number | null, high: number | null) =>
    low === null ? "待补充" : `${low}–${high} kcal`;
  return (
    <section className="food-input-helper" aria-label="填写方式与语音输入">
      <div className="input-mode" role="group" aria-label="填写方式">
        <button
          type="button"
          aria-pressed={mode === "ai"}
          className={mode === "ai" ? "selected" : ""}
          onClick={() => setMode("ai")}
        >
          <Sparkles size={16} />
          AI 识别填入
        </button>
        <button
          type="button"
          aria-pressed={mode === "manual"}
          className={mode === "manual" ? "selected" : ""}
          onClick={() => setMode("manual")}
        >
          <PenLine size={16} />
          人工填写
        </button>
      </div>
      {mode === "ai" ? (
        <div className="ai-pending">
          <span className="pill">模型选型中 · 未接入 API</span>
          <h3>照片识别入口已预留</h3>
          <p>
            真实 AI
            识别尚未完成，上传照片不会自动识别或预估热量。接入后将在下方填入可编辑结果，确认后才入账。
          </p>
          <button type="button" className="secondary full" disabled>
            AI 照片识别暂不可用
          </button>
          <p>
            现在可以使用下方文字 /
            语音参考估算，或切换人工填写。固定模拟结果位于表单底部，明确标注为演示。
          </p>
        </div>
      ) : (
        <p className="input-explanation">
          直接填写食物和热量，或先用文字 / 语音描述快速填入；所有数值均可修改。
        </p>
      )}
      <div className="text-estimator">
        <h3>说一句，记下这一餐</h3>
        <p>
          例如“米饭200克，一个鸡蛋”。也可以说“把米饭改成150克”，快速改写已有数量。
        </p>
        <label htmlFor="meal-description">
          食物描述
          <textarea
            id="meal-description"
            maxLength={500}
            rows={3}
            placeholder="米饭200克，鸡胸肉100克，鸡蛋1个"
            value={text}
            disabled={listening}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
          />
        </label>
        <div className="voice-controls">
          <label>
            语音用途
            <select
              aria-label="语音用途"
              value={voiceMode}
              disabled={listening}
              onChange={(e) =>
                setVoiceMode(e.target.value as "replace" | "append")
              }
            >
              <option value="replace">替换描述 / 修改数量</option>
              <option value="append">追加食物描述</option>
            </select>
          </label>
          {listening ? (
            <>
              <button
                type="button"
                className="secondary"
                onClick={() => speechSession.current.recognition?.stop()}
              >
                <Square size={15} />
                说完了
              </button>
              <button
                type="button"
                className="text-button"
                onClick={cancelVoice}
              >
                取消语音
              </button>
            </>
          ) : (
            <button
              type="button"
              className="secondary"
              onClick={startVoice}
              disabled={!supported}
            >
              <Mic size={17} />
              语音输入
            </button>
          )}
        </div>
        <p className="voice-privacy">
          {supported
            ? "语音由浏览器 / 系统服务转成文字，可能发送至其语音服务；点击后才请求麦克风。本应用不保存音频。"
            : "当前浏览器不支持可用的语音输入；请直接打字，或使用手机键盘自带的语音按钮。"}
        </p>
        <div className="voice-feedback" role="status" aria-live="polite">
          {listening && <span>正在听… 请清晰说出食物、数量和单位。</span>}
          {voiceText && <p>听到：{voiceText}</p>}
          {error && <p className="voice-error">{error}</p>}
        </div>
        {text.trim() && (
          <div className="text-estimate-results">
            <div className="text-estimate-title">
              <strong>参考表估算</strong>
              <span>确定性规则 · 非 AI</span>
            </div>
            {estimate.items.map((item, i) => (
              <div className="text-item" key={i}>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.portion}
                    {item.grams !== null
                      ? ` · 约${Math.round(item.grams)}克可食部`
                      : ""}
                  </span>
                  <small>{item.note}</small>
                </div>
                <strong>{bounds(item.low, item.high)}</strong>
              </div>
            ))}
            <p className="estimate-total">
              {estimate.complete ? "整份参考估算" : "已知项小计"}：
              {bounds(estimate.knownLow, estimate.knownHigh)}
            </p>
            {!estimate.complete && (
              <p className="unknown-note">
                有食物或份量无法判断。填入时总热量留空，不把已知小计当成整餐热量。
              </p>
            )}
            <button
              type="button"
              className="secondary full"
              disabled={!estimate.items.length || listening}
              onClick={() => {
                onApply({
                  name: estimate.name,
                  portion: estimate.portion,
                  low: estimate.low,
                  high: estimate.high,
                  source: "内置参考表估算（非AI）",
                });
                setError("已填入下方待审核表单，请核对后确认保存。");
              }}
            >
              <ArrowDownToLine size={16} />
              {estimate.complete
                ? "填入待审核表单"
                : "仅填入食物与份量，热量待补充"}
            </button>
          </div>
        )}
        <details className="reference-details">
          <summary>查看参考表与估算限制</summary>
          <p>
            这是用于原型的通用食物参考值，尚未逐项校验为权威营养数据库。按可食部计算，不含额外油、酱料；结果取参考值上下约20%并向外取整，只是粗估范围，不是置信区间。复杂菜品、品牌、烹饪方法差异可能超出范围。未知不默认0或一份。
          </p>
          <div className="reference-list">
            {REFERENCE_FOODS.map((food) => (
              <div key={food.name}>
                <span>{food.name}</span>
                <span>{food.per100g} kcal / 100克</span>
                <small>{food.note}</small>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
