import { expect, test } from "@playwright/test";

test.describe("Northstar Life OS", () => {
  test("拒绝非本机 Host 与 Origin", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "security boundary only needs one browser project");
    const foreignHost = await request.get("/", { headers: { host: "northstar.example" } });
    expect(foreignHost.status()).toBe(403);
    const foreignOrigin = await request.get("/api/items", { headers: { origin: "https://northstar.example" } });
    expect(foreignOrigin.status()).toBe(403);
  });

  test("真实空库只展示引导，不混入演示个人数据", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "desktop empty-state coverage");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "今天，从清晰开始" })).toBeVisible();
    await expect(page.getByText("完成 Northstar 首次启动体验")).toHaveCount(0);
    await expect(page.locator(".metric-card").filter({ hasText: "未完成任务" })).toContainText("0");
    await page.getByRole("button", { name: "项目任务", exact: true }).click();
    await expect(page.getByText("还没有项目")).toBeVisible();
  });

  test("项目、任务与派生进度形成持久闭环", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "desktop creation workflow");
    await page.goto("/");
    await page.getByRole("button", { name: "项目任务", exact: true }).click();
    await page.getByRole("button", { name: /创建第一个项目|新建项目/ }).first().click();
    await page.getByLabel("项目名称").fill("E2E 核心闭环");
    await page.getByLabel("所属领域").fill("产品");
    await page.getByRole("button", { name: "创建项目", exact: true }).click();
    await expect(page.getByText("E2E 核心闭环")).toBeVisible();

    await page.getByRole("button", { name: "新建任务", exact: true }).first().click();
    await page.getByLabel("任务名称").fill("E2E 完成第一次行动");
    await page.getByLabel("所属项目").selectOption({ label: "E2E 核心闭环" });
    await page.getByRole("button", { name: "创建任务", exact: true }).click();
    const row = page.locator(".task-row").filter({ hasText: "E2E 完成第一次行动" }).first();
    await expect(row).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "项目任务", exact: true }).click();
    const persistedRow = page.locator(".task-row").filter({ hasText: "E2E 完成第一次行动" }).first();
    await persistedRow.getByRole("button", { name: "完成任务" }).click();
    await expect(persistedRow.getByRole("button", { name: "标记未完成" })).toBeVisible();
    await expect(page.locator(".card").filter({ hasText: "E2E 核心闭环" }).first()).toContainText("100%");
  });

  test("习惯、日程、收件箱与复盘都能创建并刷新保留", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "desktop core workflows");
    await page.goto("/");
    await page.getByRole("button", { name: "日历习惯", exact: true }).click();
    await page.getByRole("button", { name: "添加习惯", exact: true }).click();
    await page.getByLabel("习惯名称").fill("E2E 晨间阅读");
    await page.getByRole("button", { name: "创建习惯", exact: true }).click();
    const habitBlock = page.locator(".card").filter({ hasText: "E2E 晨间阅读" }).first();
    await habitBlock.getByRole("button", { name: "今天打卡" }).click();
    await expect(habitBlock.getByRole("button", { name: "今天已完成" })).toBeVisible();

    await page.getByRole("button", { name: "添加日程", exact: true }).first().click();
    await page.getByLabel("日程名称").fill("E2E 明日安排");
    const futureStart = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16);
    await page.getByLabel("开始时间").fill(futureStart);
    await page.getByLabel("地点").fill("本地工作台");
    await page.getByRole("button", { name: "创建日程", exact: true }).click();
    await expect(page.getByText("E2E 明日安排")).toBeVisible();

    await page.getByRole("button", { name: "项目任务", exact: true }).click();
    await page.getByRole("button", { name: "快速收集", exact: true }).click();
    await page.getByLabel("内容").fill("E2E 稍后分类的想法");
    await page.getByRole("button", { name: "放入收件箱" }).click();
    await expect(page.getByText("E2E 稍后分类的想法")).toBeVisible();

    await page.getByRole("button", { name: "日记复盘", exact: true }).click();
    await page.getByRole("button", { name: "开始今日复盘" }).click();
    await page.getByLabel("今天什么事情值得保留？").fill("E2E 复盘留下的一个真实回声");
    await page.getByLabel("明天最重要的一步是？").fill("继续完成下一步");
    await page.getByRole("button", { name: "完成复盘" }).click();
    await expect(page.getByText("E2E 复盘留下的一个真实回声")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "日历习惯", exact: true }).click();
    await expect(page.getByText("E2E 晨间阅读")).toBeVisible();
    await expect(page.getByRole("button", { name: "今天已完成" })).toBeVisible();
    await expect(page.getByText("E2E 明日安排")).toBeVisible();
  });

  test("JSON 导入先预览、去重并事务应用", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "desktop import workflow");
    const source = JSON.stringify({ schema_version: 1, records: [{ id: "e2e-import-project", type: "project", title: "E2E 导入项目", data: { area: "导入" } }] });
    await page.goto("/");
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "导入并预览" }).click();
    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /选择 JSON 文件/ }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: "e2e-import.json", mimeType: "application/json", buffer: Buffer.from(source) });
    await expect(page.locator(".metric-card").filter({ hasText: "可新增" })).toContainText("1");
    await page.getByRole("button", { name: "确认应用" }).click();
    await expect(page.getByText("已导入 1 条记录")).toBeVisible();
    await page.getByRole("button", { name: "项目任务", exact: true }).click();
    await expect(page.getByText("E2E 导入项目")).toBeVisible();

    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "导入并预览" }).click();
    const duplicateChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /选择 JSON 文件/ }).click();
    const duplicateChooser = await duplicateChooserPromise;
    await duplicateChooser.setFiles({ name: "e2e-import.json", mimeType: "application/json", buffer: Buffer.from(source) });
    await expect(page.locator(".metric-card").filter({ hasText: "重复" })).toContainText("1");
    await expect(page.getByRole("button", { name: "确认应用" })).toBeDisabled();
  });

  test("演示模式是可交互但不持久化的独立沙盒", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "desktop demo workflow");
    await page.goto("/");
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "进入演示" }).click();
    await expect(page.getByText(/演示模式：所有操作只在当前会话生效/)).toBeVisible();
    await page.getByRole("button", { name: "指挥中心", exact: true }).click();
    await expect(page.getByText("完成 Northstar 首次启动体验")).toBeVisible();
    await page.getByRole("button", { name: "新建任务" }).first().click();
    await page.getByLabel("任务名称").fill("E2E 演示临时任务");
    await page.getByRole("button", { name: "创建任务" }).click();
    await expect(page.getByText("E2E 演示临时任务")).toBeVisible();
    await page.reload();
    await expect(page.getByText("E2E 演示临时任务")).toHaveCount(0);
    await expect(page.getByText("完成 Northstar 首次启动体验")).toBeVisible();
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await expect(page.getByRole("button", { name: "导出普通备份" })).toBeDisabled();
    await page.getByRole("button", { name: "退出演示" }).last().click();
    await page.getByRole("button", { name: "指挥中心", exact: true }).click();
    await expect(page.getByText("完成 Northstar 首次启动体验")).toHaveCount(0);
  });

  test("私密库保持客户端加密边界", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "desktop vault workflow");
    await page.goto("/");
    await page.getByRole("button", { name: "私密库", exact: true }).click();
    await page.getByLabel("解锁口令").fill("e2e-only-password");
    await page.getByRole("button", { name: "解锁私密库" }).click();
    await expect(page.getByText("私密库 · 已解锁")).toBeVisible();
    await page.getByLabel("私密内容").fill("这段内容只在浏览器内解密。");
    await page.getByRole("button", { name: "加密保存" }).click();
    await expect(page.getByText("已加密保存")).toBeVisible();
  });

  test("移动端使用底部导航", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "mobile layout smoke test");
    await page.goto("/");
    await expect(page.locator(".mobile-bar")).toBeVisible();
    await expect(page.locator(".sidebar")).toBeHidden();
    await page.locator(".mobile-nav").filter({ hasText: "项目" }).click();
    await expect(page.getByRole("heading", { name: "把意图落到下一步" })).toBeVisible();
  });
});
