import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const base = process.env.BASE_URL || "http://127.0.0.1:3000";
let executablePath = process.env.CHROMIUM_PATH;
if (!executablePath) {
  try {
    await fs.access("/opt/thorium-browser/thorium");
    executablePath = "/opt/thorium-browser/thorium";
  } catch {
    // Fall back to the Chromium installed by Playwright on other machines.
  }
}
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "vi-VN",
});
const errors = [];

try {
  const page = await context.newPage();
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("Failed to load resource")
    )
      errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Đăng nhập cửa hàng" }).waitFor();
  await page.getByRole("button", { name: /^Đăng nhập$/ }).click();
  await page.getByRole("heading", { name: "Tổng quan cửa hàng" }).waitFor();
  await page.getByRole("button", { name: "Mở cố vấn kinh doanh" }).click();
  await page.getByRole("heading", { name: "Cố vấn kinh doanh" }).waitFor();
  await page.getByRole("button", { name: "Tồn kho nào cần nhập?" }).click();
  await page
    .locator(".advisor-message.user")
    .filter({ hasText: "Tồn kho nào cần nhập?" })
    .waitFor();
  await page.getByRole("button", { name: "Lô nào sắp hết hạn?" }).click();
  await page
    .locator(".advisor-message.user")
    .filter({ hasText: "Lô nào sắp hết hạn?" })
    .waitFor();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  assert.match(
    await page.locator("body").innerText(),
    /EasyRetail/,
  );

  await page.goto(`${base}/products`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Sản phẩm & danh mục" }).waitFor();
  assert.ok(
    (await page.locator("tbody tr").count()) >= 20,
    "admin product table must contain seeded catalog",
  );
  await page.screenshot({ path: "test-results/products.png", fullPage: true });
  await page.locator("tbody tr").first().getByTitle("Sửa").click();
  await page.getByText("Ảnh sản phẩm", { exact: true }).waitFor();
  await page.screenshot({
    path: "test-results/product-image-editor.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");

  for (const [path, heading] of [
    ["/pos", "Bán hàng tại quầy"],
    ["/orders", "Quản lý đơn hàng"],
    ["/inventory", "Quản lý kho"],
    ["/purchases", "Nhập hàng"],
    ["/customers", "Khách hàng"],
    ["/staff", "Nhân viên & phân quyền"],
    ["/settings", "Thiết lập điểm bán"],
  ]) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    if (path === "/inventory") {
      await page
        .getByRole("heading", { name: "Lô hàng & hạn sử dụng" })
        .waitFor();
      await page
        .getByRole("button", { name: "Kiểm kê / xuất hủy" })
        .first()
        .click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("dialog").getByRole("combobox").first().waitFor();
      await page.keyboard.press("Escape");
      await page.screenshot({
        path: "test-results/inventory.png",
        fullPage: true,
      });
    }
    if (path === "/purchases") {
      await page
        .getByRole("heading", { name: "Chi tiết phiếu nhập" })
        .waitFor();
      await page.getByLabel("Nhà cung cấp", { exact: true }).waitFor();
      await page.getByLabel("Giá nhập").waitFor();
      await page.screenshot({
        path: "test-results/purchases.png",
        fullPage: true,
      });
    }
  }

  const hiddenKiosk = await context.newPage();
  await hiddenKiosk.goto(`${base}/kiosk`);
  await hiddenKiosk.waitForURL(`${base}/`);
  await hiddenKiosk
    .getByRole("heading", { name: "Tổng quan cửa hàng" })
    .waitFor();

  assert.deepEqual(errors, [], `browser console errors:\n${errors.join("\n")}`);
  console.log(
    `PASS browser: login, management pages and hidden kiosk route (${base})`,
  );
} finally {
  await browser.close();
}
