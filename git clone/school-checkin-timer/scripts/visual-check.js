const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const outDir = path.join(__dirname, '..', 'artifacts', 'visual');
fs.mkdirSync(outDir, { recursive: true });

const cases = [
  { name: 'low-1366x768', url: '/?demo=1', width: 1366, height: 768 },
  { name: 'low-1024x768', url: '/?demo=1', width: 1024, height: 768 },
  { name: 'low-768x1024', url: '/?demo=1', width: 768, height: 1024 },
  { name: 'low-375x812', url: '/?demo=1', width: 375, height: 812 },
  { name: 'high-1366x768', url: '/?demo=1&mode=high', width: 1366, height: 768 },
  { name: 'high-1024x768', url: '/?demo=1&mode=high', width: 1024, height: 768 },
  { name: 'teacher-1366x900', url: '/teacher.html', width: 1366, height: 900 },
  { name: 'dashboard-1366x900', url: '/dashboard.html', width: 1366, height: 900 }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.width, height: c.height } });
    await page.goto(`${base}${c.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);

    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      textOverflow: [...document.querySelectorAll('.task-label,.weather b,.timer-copy strong,.statusbar,.mini-message,.preview-item b')]
        .filter(el => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).whiteSpace === 'nowrap')
        .map(el => ({ text: el.textContent.trim(), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
    }));

    if (metrics.scrollWidth > metrics.innerWidth + 2 || metrics.bodyScrollWidth > metrics.innerWidth + 2) {
      failures.push(`${c.name}: horizontal overflow ${Math.max(metrics.scrollWidth, metrics.bodyScrollWidth)} > ${metrics.innerWidth}`);
    }
    if (metrics.textOverflow.length) failures.push(`${c.name}: nowrap text overflow ${JSON.stringify(metrics.textOverflow)}`);

    await page.screenshot({ path: path.join(outDir, `${c.name}.png`), fullPage: true });
    await page.close();
  }

  await browser.close();
  if (failures.length) {
    console.error('Visual viewport check failed:\n' + failures.join('\n'));
    process.exit(1);
  }
  console.log(`Visual viewport check passed (${cases.length} screenshots)`);
})().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
