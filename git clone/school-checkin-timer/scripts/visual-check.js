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
  { name: 'high-768x1024', url: '/?demo=1&mode=high', width: 768, height: 1024 },
  { name: 'high-375x812', url: '/?demo=1&mode=high', width: 375, height: 812 },
  { name: 'teacher-1366x900', url: '/teacher.html', width: 1366, height: 900 },
  { name: 'teacher-1024x768', url: '/teacher.html', width: 1024, height: 768 },
  { name: 'teacher-768x1024', url: '/teacher.html', width: 768, height: 1024 },
  { name: 'teacher-375x812', url: '/teacher.html', width: 375, height: 812 },
  { name: 'attendance-1024x768', url: '/attendance.html', width: 1024, height: 768 },
  { name: 'attendance-768x1024', url: '/attendance.html', width: 768, height: 1024 },
  { name: 'attendance-375x812', url: '/attendance.html', width: 375, height: 812 },
  { name: 'dashboard-1366x900', url: '/dashboard.html', width: 1366, height: 900 },
  { name: 'dashboard-768x1024', url: '/dashboard.html', width: 768, height: 1024 },
  { name: 'dashboard-375x812', url: '/dashboard.html', width: 375, height: 812 },
  { name: 'monthly-1024x768', url: '/monthly-attendance.html', width: 1024, height: 768 },
  { name: 'monthly-768x1024', url: '/monthly-attendance.html', width: 768, height: 1024 },
  { name: 'monthly-375x812', url: '/monthly-attendance.html', width: 375, height: 812 },
  { name: 'term-1024x768', url: '/term-attendance.html', width: 1024, height: 768 },
  { name: 'term-768x1024', url: '/term-attendance.html', width: 768, height: 1024 },
  { name: 'term-375x812', url: '/term-attendance.html', width: 375, height: 812 },
  { name: 'calendar-1024x768', url: '/school-calendar.html', width: 1024, height: 768 },
  { name: 'calendar-768x1024', url: '/school-calendar.html', width: 768, height: 1024 },
  { name: 'calendar-375x812', url: '/school-calendar.html', width: 375, height: 812 },
  { name: 'term-settings-1024x768', url: '/term-settings.html', width: 1024, height: 768 },
  { name: 'term-settings-768x1024', url: '/term-settings.html', width: 768, height: 1024 },
  { name: 'term-settings-375x812', url: '/term-settings.html', width: 375, height: 812 },
  { name: 'setup-768x1024', url: '/setup.html', width: 768, height: 1024 },
  { name: 'setup-375x812', url: '/setup.html', width: 375, height: 812 },
  { name: 'preview-1024x768', url: '/preview.html', width: 1024, height: 768 },
  { name: 'preview-768x1024', url: '/preview.html', width: 768, height: 1024 },
  { name: 'preview-375x812', url: '/preview.html', width: 375, height: 812 }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.width, height: c.height } });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.goto(`${base}${c.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);

    const metrics = await page.evaluate(() => {
      const intersects = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
      const taskIssues = [];
      document.querySelectorAll('.task-card').forEach(card => {
        const image = card.querySelector('.task-art img');
        const label = card.querySelector('.task-label');
        const check = card.querySelector('.task-check');
        if (image && (!image.complete || image.naturalWidth <= 0)) taskIssues.push({ type: 'image-load', task: label?.textContent?.trim() || '' });
        const parts = [image, label, check].filter(Boolean).map(el => ({ el, rect: el.getBoundingClientRect() })).filter(x => x.rect.width > 0 && x.rect.height > 0);
        for (let i = 0; i < parts.length; i++) {
          for (let j = i + 1; j < parts.length; j++) {
            if (intersects(parts[i].rect, parts[j].rect)) taskIssues.push({ type: 'overlap', task: label?.textContent?.trim() || '', a: parts[i].el.className, b: parts[j].el.className });
          }
        }
      });
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        textOverflow: [...document.querySelectorAll('.task-label,.weather b,.timer-copy strong,.statusbar,.mini-message,.preview-item b,.home-link strong,.home-link small,nav a')]
          .filter(el => el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).whiteSpace === 'nowrap')
          .map(el => ({ text: el.textContent.trim(), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })),
        taskIssues
      };
    });

    if (metrics.scrollWidth > metrics.innerWidth + 2 || metrics.bodyScrollWidth > metrics.innerWidth + 2) {
      failures.push(`${c.name}: horizontal overflow ${Math.max(metrics.scrollWidth, metrics.bodyScrollWidth)} > ${metrics.innerWidth}`);
    }
    if (metrics.textOverflow.length) failures.push(`${c.name}: nowrap text overflow ${JSON.stringify(metrics.textOverflow)}`);
    if (metrics.taskIssues.length) failures.push(`${c.name}: task artwork/layout issues ${JSON.stringify(metrics.taskIssues)}`);
    if (pageErrors.length) failures.push(`${c.name}: page errors ${pageErrors.join(' | ')}`);

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
