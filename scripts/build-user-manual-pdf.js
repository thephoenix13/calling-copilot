/**
 * scripts/build-user-manual-pdf.js
 *
 * Renders dist/Zeople-RecruiterOS-User-Manual.html to a single-page PDF.
 *
 * Run with:  node scripts/build-user-manual-pdf.js
 */

const puppeteer = require('puppeteer-core');
const fs        = require('fs');
const path      = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'dist', 'Zeople-RecruiterOS-User-Manual.html');
const OUT  = path.join(ROOT, 'dist', 'Zeople-RecruiterOS-User-Manual.pdf');

const CHROME_PATHS = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const CHROME = CHROME_PATHS.find(p => fs.existsSync(p));
if (!CHROME) {
  console.error('❌ Could not find Chrome or Edge.');
  process.exit(1);
}
if (!fs.existsSync(HTML)) {
  console.error(`❌ HTML not found at ${HTML}. Run scripts/build-user-manual-html.js first.`);
  process.exit(1);
}

const VIEWPORT_WIDTH = 1320;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: VIEWPORT_WIDTH, height: 1200, deviceScaleFactor: 1 },
  });
  try {
    const page = await browser.newPage();
    await page.goto('file:///' + HTML.replace(/\\/g, '/'), { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await page.addStyleTag({ content: `@page { size: auto; margin: 0; }` });

    const contentHeight = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      return Math.ceil(Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight,
      ));
    });

    console.log(`Rendered content height: ${contentHeight}px`);
    console.log(`PDF page size: ${VIEWPORT_WIDTH}px × ${contentHeight}px`);

    await page.pdf({
      path:              OUT,
      width:             `${VIEWPORT_WIDTH}px`,
      height:            `${contentHeight}px`,
      printBackground:   true,
      preferCSSPageSize: false,
      margin:            { top: 0, right: 0, bottom: 0, left: 0 },
    });

    console.log('✅ Wrote ' + OUT);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('❌ PDF build failed:', err);
  process.exit(1);
});
