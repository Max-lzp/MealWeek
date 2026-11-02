import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今天，好好吃饭。" }),
  ).toBeVisible();
});
const nav = (page: import("@playwright/test").Page, name: string) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
test("照片、审核、幂等、运动、日估算、周报、偏好、刷新与删除", async ({
  page,
}) => {
  await nav(page, "添加");
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 200;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#82a76f";
    ctx.fillRect(0, 0, 200, 200);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("上传食物照片")
    .setInputFiles({
      name: "meal.png",
      mimeType: "image/png",
      buffer: Buffer.from(image, "base64"),
    });
  await expect(page.getByAltText("待确认餐食照片")).toBeVisible();
  await page
    .getByRole("button", { name: "模拟识别 · 非真实图片识别", exact: true })
    .click();
  await expect(
    page.getByText("演示结果，非真实图片识别。请逐项核对并更正。"),
  ).toBeVisible();
  await page.getByLabel("食物名称", { exact: true }).fill("鸡肉饭");
  await page.getByLabel("份量", { exact: true }).fill("1碗 300g");
  await page.getByLabel("热量下限", { exact: true }).fill("600");
  await page.getByLabel("热量上限", { exact: true }).fill("700");
  await page.locator("form.add-form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByTestId("intake")).toContainText("600–700");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("mealweek.v1")!).personal.foods
            .length,
      ),
    )
    .toBe(1);
  await page.getByRole("button", { name: "修改鸡肉饭", exact: true }).click();
  await page.getByLabel("热量下限", { exact: true }).fill("650");
  await page.getByLabel("热量上限", { exact: true }).fill("750");
  await page.getByRole("button", { name: "确认保存这一项" }).click();
  await expect(page.getByTestId("intake")).toContainText("650–750");
  await page.getByRole("button", { name: "记录运动", exact: true }).click();
  await page.getByLabel("运动名称").fill("篮球");
  await page.getByLabel("运动消耗（kcal）").fill("500");
  await page.getByRole("button", { name: "确认保存运动" }).click();
  await expect(page.getByText("暂不判断日能量盈亏")).toBeVisible();
  await page.getByRole("button", { name: "填写消耗" }).click();
  await page.getByLabel("全天总消耗（kcal）").fill("2300");
  await page.getByRole("button", { name: "确认保存全天消耗" }).click();
  await page.getByLabel("我确认这一天的饮食已记录完整").check();
  await expect(
    page.getByText("-1650–-1550 kcal · 摄入 − 全天总消耗"),
  ).toBeVisible();
  await nav(page, "周报");
  await expect(page.locator(".week-row").last()).toContainText("650–750");
  await expect(page.locator(".week-row").last()).toContainText("2300");
  await expect(page.locator(".missing")).toHaveCount(12);
  await nav(page, "我的");
  await page.getByRole("button", { name: "添加偏好" }).click();
  await page.getByLabel("我的偏好").fill("不喜欢香菜");
  await page.getByRole("button", { name: "确认记住这个偏好" }).click();
  await nav(page, "今日");
  await expect(page.locator(".memory-hint")).toContainText("不喜欢香菜");
  await nav(page, "我的");
  await page.getByRole("button", { name: "删除偏好不喜欢香菜" }).click();
  await nav(page, "今日");
  await expect(page.locator(".memory-hint")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("intake")).toContainText("650–750");
  await expect(page.getByText("篮球", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "删除鸡肉饭", exact: true }).click();
  await expect(page.getByTestId("intake")).toContainText("待补充");
  await nav(page, "周报");
  await expect(page.locator(".week-row").last()).toContainText("待补充");
});
test("360/390无横向滚动，演示隔离与清除，目标确认", async ({ page }) => {
  for (const width of [360, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of ["今日", "添加", "周报", "我的"]) {
      await nav(page, tab);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.getByLabel("新目标（kcal / 天）").fill("2100");
  await page.getByRole("button", { name: "确认修改目标" }).click();
  await expect(page.locator(".current-goal")).toContainText("2100");
  await page.getByRole("button", { name: "加载七日演示数据" }).click();
  await expect(page.locator(".demo-banner")).toBeVisible();
  await nav(page, "周报");
  await expect(page.locator(".missing")).toHaveCount(4);
  await nav(page, "我的");
  await page.getByRole("button", { name: "清除演示数据" }).click();
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  await expect(page.locator(".current-goal")).toContainText("2100");
  await nav(page, "今日");
  await expect(page.getByTestId("intake")).toContainText("待补充");
});
