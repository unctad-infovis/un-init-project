#!/usr/bin/env node
// Renders handbook.html to a PDF via headless Chromium (print CSS + page-break
// classes already in the HTML). Not reportlab/pdf-lib – the typography matters and
// the figures are SVGs, so this needs a real browser's print engine.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(here, 'handbook.html');
const outPath = path.join(here, 'UNCTAD-datawrapper-chart-guidelines.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: '<div style="font-size:7.5pt;color:#74787e;width:100%;text-align:center;">UNCTAD Datawrapper chart guidelines &middot; <span class="pageNumber"></span></div>',
  margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
});
await browser.close();
console.log(`Wrote ${outPath}`);
