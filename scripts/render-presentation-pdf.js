// Render the Zeople presentation HTML to PDF via system Chrome.
// Usage: node scripts/render-presentation-pdf.js

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findBrowser() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chrome/Edge installation found in standard locations.');
}

async function main() {
  const htmlPath = path.resolve(__dirname, '..', 'docs', 'product', 'ZEOPLE_OVERVIEW_PRESENTATION.html');
  const pdfPath = path.resolve(__dirname, '..', 'docs', 'product', 'Zeople-Overview-Presentation.pdf');

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML not found: ${htmlPath}`);
  }

  const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');
  const executablePath = findBrowser();

  console.log(`[render-pdf] Using browser: ${executablePath}`);
  console.log(`[render-pdf] Loading: ${fileUrl}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // Match slide canvas dimensions for crisp rendering.
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });

    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for fonts to load.
    await page.evaluateHandle('document.fonts.ready');

    // Extra settle time for any layout shifts.
    await new Promise(r => setTimeout(r, 1500));

    await page.pdf({
      path: pdfPath,
      width: '1600px',
      height: '900px',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const size = fs.statSync(pdfPath).size;
    console.log(`[render-pdf] Wrote ${pdfPath} (${(size / 1024).toFixed(1)} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[render-pdf] FAILED:', err);
  process.exit(1);
});
