// Teste temporário (GitHub Actions): o app real num Chromium, com o modelo de recorte de verdade.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const mem = () => {
  try { return Math.round(Number(execSync("ps -C chrome,chromium,headless_shell,chrome-headless-shell -o rss= | awk '{s+=$1} END {print s}'").toString()) / 1024); } catch { return -1; }
};
(async () => {
  fs.mkdirSync("seg-out", { recursive: true });
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  await page.goto("http://localhost:4173/");
  let peak = 0; const iv = setInterval(() => { peak = Math.max(peak, mem()); }, 300);
  for (const f of ["verde", "short"]) {
    await page.locator(".tabbar").getByText("Adicionar").click();
    await page.locator("input[type=file]").setInputFiles(`tests/seg/${f}.jpg`);
    await page.getByRole("button", { name: "Continuar" }).click();
    const t0 = Date.now();
    await page.waitForFunction(() => document.querySelector(".cutout-view canvas")?.style.display === "block" && !document.querySelector(".cutout-busy"), null, { timeout: 180000 });
    console.log(`RESULT ${f}: pronto em ${Date.now() - t0}ms`);
    await page.screenshot({ path: `seg-out/${f}-1toque.png` });
    if (f === "short") { // tira a mão: modo Tirar + toque
      await page.getByRole("button", { name: "－ Tirar" }).click();
      const cv = page.locator(".cutout-view canvas"); const bb = await cv.boundingBox();
      await cv.click({ position: { x: bb.width * 0.3, y: bb.height * 0.2 } });
      await page.waitForFunction(() => !document.querySelector(".cutout-busy"));
      await page.screenshot({ path: `seg-out/${f}-2toques.png` });
    }
    await page.getByRole("button", { name: "Pronto, é essa a peça" }).click();
    await page.getByText("3. Confira os detalhes").waitFor();
    await page.screenshot({ path: `seg-out/${f}-final.png` });
    await page.getByRole("button", { name: "Salvar peça" }).click();
  }
  clearInterval(iv);
  console.log("RESULT pico de memória do navegador (MB):", peak);
  console.log("RESULT erros:", JSON.stringify(errors));
  await b.close();
})().catch((e) => { console.error("RESULT FALHOU", e); process.exit(1); });
