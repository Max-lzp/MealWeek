import { test, expect } from "@playwright/test";
async function add(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "添加", exact: true })
    .click();
}
test("AI入口明确未接入；人工与文字参考估算可填入、编辑、确认保存", async ({
  page,
}) => {
  await add(page);
  await page.getByRole("button", { name: "AI 识别填入", exact: true }).click();
  await expect(page.getByText("模型选型中 · 未接入 API")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "AI 照片识别暂不可用" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "人工填写", exact: true }).click();
  await page.getByLabel("食物描述").fill("米饭200克，一个鸡蛋");
  await expect(page.getByText("整份参考估算：230–370 kcal")).toBeVisible();
  await page
    .getByRole("button", { name: "填入待审核表单", exact: true })
    .click();
  await expect(page.getByLabel("食物名称", { exact: true })).toHaveValue(
    "米饭、鸡蛋",
  );
  await expect(page.getByLabel("热量下限", { exact: true })).toHaveValue("230");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("mealweek.v1") || "null")?.personal
          .foods.length ?? 0,
    ),
  ).toBe(0);
  await page.getByLabel("热量下限", { exact: true }).fill("250");
  await page.getByRole("button", { name: "确认保存这一项" }).click();
  await expect(page.getByTestId("intake")).toContainText("250–370");
  await page.reload();
  await expect(page.getByTestId("intake")).toContainText("250–370");
});
test("语音事件可替换名称和数量，再用文字表估算；非真实麦克风测试", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class MockSpeech {
      lang = "";
      continuous = false;
      interimResults = true;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { testSpeech: MockSpeech }).testSpeech = this;
      }
      stop() {
        this.onend?.();
      }
      abort() {
        this.onend?.();
      }
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: MockSpeech,
      configurable: true,
    });
  });
  await add(page);
  await page.getByLabel("食物描述").fill("米饭100克，鸡蛋1个");
  await page.getByRole("button", { name: "语音输入", exact: true }).click();
  await expect(
    page.getByText("正在听… 请清晰说出食物、数量和单位。"),
  ).toBeVisible();
  await page.evaluate(() => {
    const r = (
      window as unknown as {
        testSpeech: { onresult: (e: unknown) => void; onend: () => void };
      }
    ).testSpeech;
    r.onresult({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: "把米饭改成两百克" } }],
    });
    r.onend();
  });
  await expect(page.getByLabel("食物描述")).toHaveValue("米饭两百克，鸡蛋1个");
  await expect(page.getByText("整份参考估算：230–370 kcal")).toBeVisible();
  await page
    .getByRole("button", { name: "填入待审核表单", exact: true })
    .click();
  await expect(page.getByLabel("份量", { exact: true })).toHaveValue(
    "米饭两百克；鸡蛋1个",
  );
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("未知项不补零；语音不支持和权限拒绝均可继续打字", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await add(page);
  await expect(
    page.getByRole("button", { name: "语音输入", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("当前浏览器不支持可用的语音输入；请直接打字"),
  ).toBeVisible();
  await page.getByLabel("食物描述").fill("米饭100克，火锅一份");
  await page
    .getByRole("button", { name: "仅填入食物与份量，热量待补充" })
    .click();
  await expect(page.getByLabel("热量下限", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("热量上限", { exact: true })).toHaveValue("");
});
test("语音被拒绝后可手动编辑，不生成假转录", async ({ page }) => {
  await page.addInitScript(() => {
    class Denied {
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        this.onerror?.({ error: "not-allowed" });
        this.onend?.();
      }
      stop() {}
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Denied,
      configurable: true,
    });
  });
  await add(page);
  await page.getByRole("button", { name: "语音输入", exact: true }).click();
  await expect(
    page.getByText("麦克风权限被拒绝，请在浏览器设置中允许，或直接打字。"),
  ).toBeVisible();
  await expect(page.getByLabel("食物描述")).toBeEnabled();
  await page.getByLabel("食物描述").fill("鸡蛋一个");
  await expect(page.getByText("整份参考估算：50–90 kcal")).toBeVisible();
});
