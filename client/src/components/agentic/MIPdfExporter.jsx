/**
 * MIPdfExporter — branded A4 PDF export for an MI report.
 *
 * Reproduces the miv2-aa0ae301 pattern: snapshot the #mi-report-content
 * element with html2canvas, slice into A4 page-height chunks, render each
 * with a branded header band ("ZEO" navy + "PLE" orange) and a footer
 * with "Page X of Y · Generated on {date}".
 *
 * Tags `data-print-hide` on any control inside the report area are hidden
 * during the snapshot, then restored.
 */

'use strict';

import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A4_WIDTH_MM  = 210;
const A4_HEIGHT_MM = 297;
const HEADER_MM    = 18;   // branded header band
const FOOTER_MM    = 12;   // page number / date
const SIDE_MARGIN  = 10;
const CONTENT_W    = A4_WIDTH_MM - 2 * SIDE_MARGIN;
const CONTENT_H    = A4_HEIGHT_MM - HEADER_MM - FOOTER_MM;

const ORANGE = '#F97316';
const NAVY   = '#1A2B4A';

async function snapshot(el, scale = 2) {
  // Hide elements marked data-print-hide before snapshotting.
  const hidden = el.querySelectorAll('[data-print-hide], button.ag-btn, .mi-progress');
  const prevDisplay = [];
  hidden.forEach((n, i) => { prevDisplay[i] = n.style.display; n.style.display = 'none'; });
  try {
    return await html2canvas(el, {
      scale,
      backgroundColor: '#FFFFFF',
      useCORS: true,
      logging: false,
      windowWidth: el.scrollWidth,
    });
  } finally {
    hidden.forEach((n, i) => { n.style.display = prevDisplay[i] || ''; });
  }
}

function drawHeader(pdf, jobTitle, dateStr) {
  // Navy band at top.
  pdf.setFillColor(NAVY);
  pdf.rect(0, 0, A4_WIDTH_MM, HEADER_MM, 'F');
  // Brand "ZEO" + "PLE" — split-color logotype.
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor('#FFFFFF');
  pdf.text('ZEO', 10, HEADER_MM - 6);
  pdf.setTextColor(ORANGE);
  pdf.text('PLE', 19.5, HEADER_MM - 6);
  // Subtitle.
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#CBD5E1');
  pdf.text('RecruiterOS · Market Intelligence Report', 32, HEADER_MM - 6);
  // Date right-aligned.
  pdf.setFontSize(8);
  pdf.setTextColor('#FFFFFF');
  pdf.text(dateStr, A4_WIDTH_MM - 10, HEADER_MM - 6, { align: 'right' });
  // Job title on second line.
  if (jobTitle) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor('#FFFFFF');
    pdf.text(jobTitle.slice(0, 80), 10, HEADER_MM - 1);
  }
}

function drawFooter(pdf, pageNum, pageCount, generatedOn) {
  const y = A4_HEIGHT_MM - 4;
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.2);
  pdf.line(SIDE_MARGIN, A4_HEIGHT_MM - FOOTER_MM + 2, A4_WIDTH_MM - SIDE_MARGIN, A4_HEIGHT_MM - FOOTER_MM + 2);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor('#94A3B8');
  pdf.text(`Generated on ${generatedOn}`, SIDE_MARGIN, y);
  pdf.text(`Page ${pageNum} of ${pageCount}`, A4_WIDTH_MM - SIDE_MARGIN, y, { align: 'right' });
}

export async function exportReportToPdf({ elementId, jobTitle, generatedAt, fileName }) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Element #${elementId} not found.`);

  const dateStr = new Date(generatedAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const canvas = await snapshot(el);
  const pdf = new jsPDF('p', 'mm', 'a4');

  // Convert canvas height to mm at our content width.
  const pxPerMm   = canvas.width / CONTENT_W;
  const pageHeightPx = CONTENT_H * pxPerMm;
  const pageCount    = Math.ceil(canvas.height / pageHeightPx);

  for (let p = 0; p < pageCount; p++) {
    if (p > 0) pdf.addPage();

    // Slice this page's portion off the original canvas.
    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width  = canvas.width;
    sliceCanvas.height = Math.min(pageHeightPx, canvas.height - p * pageHeightPx);
    const ctx = sliceCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, -p * pageHeightPx);

    drawHeader(pdf, jobTitle, dateStr);
    pdf.addImage(
      sliceCanvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      SIDE_MARGIN,
      HEADER_MM + 2,
      CONTENT_W,
      sliceCanvas.height / pxPerMm,
    );
    drawFooter(pdf, p + 1, pageCount, dateStr);
  }

  pdf.save(fileName || `Market-Intelligence-${(jobTitle || 'Report').replace(/[^a-z0-9]+/gi, '-')}.pdf`);
}

// React hook + button helper.
export function ExportPdfButton({ elementId, jobTitle, generatedAt }) {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await exportReportToPdf({ elementId, jobTitle, generatedAt });
    } catch (err) {
      console.error('[mi-pdf] Export failed:', err);
      alert(err.message || 'PDF export failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      className="ag-btn ag-btn--ghost ag-btn--sm"
      onClick={onClick}
      disabled={busy}
      data-print-hide
    >
      {busy ? 'Exporting…' : '⬇ Export PDF'}
    </button>
  );
}
