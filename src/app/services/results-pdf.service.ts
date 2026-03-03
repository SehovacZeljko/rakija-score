import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfExportInput {
  eventName: string;
  eventYear: number;
  totalSubmitted: number;
  totalExpected: number;
  categoryResults: PdfCategoryResult[];
}

export interface PdfCategoryResult {
  categoryName: string;
  samples: PdfSampleRow[];
}

export interface PdfJudgeScore {
  judgeName: string;
  scored: boolean;
  color: number;
  clarity: number;
  typicality: number;
  aroma: number;
  taste: number;
  total: number;
}

export interface PdfSampleRow {
  rank: number;
  sampleCode: string;
  producerName: string;
  judgesScored: number;
  totalJudges: number;
  avgTotal: number;
  judgeScores: PdfJudgeScore[];
}

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number };
  }
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;
const MARGIN_TOP = 16;
const MARGIN_BOTTOM = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 182 mm
const FOOTER_HEIGHT = 10; // space reserved at the bottom of every page
const MIN_SPACE_FOR_CATEGORY = 40; // minimum space needed to start a new category section

// ── Design-token RGB colours ─────────────────────────────────────────────────
const COLOR_PRIMARY: [number, number, number] = [61, 26, 36]; // #3D1A24
const COLOR_BG_SURFACE: [number, number, number] = [240, 235, 229]; // #F0EBE5
const COLOR_BG_APP: [number, number, number] = [245, 240, 235]; // #F5F0EB
const COLOR_TEXT_PRIMARY: [number, number, number] = [26, 26, 26]; // #1A1A1A
const COLOR_TEXT_SECONDARY: [number, number, number] = [107, 107, 107]; // #6B6B6B
const COLOR_TEXT_MUTED: [number, number, number] = [156, 163, 175]; // #9CA3AF
const COLOR_WHITE: [number, number, number] = [255, 255, 255];
const COLOR_BORDER: [number, number, number] = [229, 221, 213]; // #E5DDD5

@Injectable({ providedIn: 'root' })
export class ResultsPdfService {
  private sanitizeText(text: string): string {
    return text
      .replace(/Đ/g, 'Dj')
      .replace(/đ/g, 'dj')
      .replace(/Č/g, 'C')
      .replace(/č/g, 'c')
      .replace(/Ć/g, 'C')
      .replace(/ć/g, 'c');
  }

  generateResultsPdf(input: PdfExportInput): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const totalPagesPlaceholder = '{total_pages_count_string}';

    const generatedDate = new Date().toLocaleDateString('sr-Latn-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // ── First-page header block ───────────────────────────────────────────────
    let currentY = MARGIN_TOP;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLOR_TEXT_PRIMARY);
    doc.text('Rezultati ocjenjivanja', MARGIN_LEFT, currentY);
    currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT_SECONDARY);
    doc.text(
      `${this.sanitizeText(input.eventName)} \u00b7 ${input.eventYear}`,
      MARGIN_LEFT,
      currentY,
    );
    currentY += 5;

    doc.setFontSize(9);
    if (input.totalExpected > 0) {
      doc.text(`${input.totalSubmitted}/${input.totalExpected} ocijenjeno`, MARGIN_LEFT, currentY);
    }
    doc.text(`Generisano: ${generatedDate}`, PAGE_WIDTH - MARGIN_RIGHT, currentY, {
      align: 'right',
    });
    currentY += 6;

    // Separator line
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, currentY, PAGE_WIDTH - MARGIN_RIGHT, currentY);
    currentY += 7;

    // ── Category sections ─────────────────────────────────────────────────────
    for (const categoryResult of input.categoryResults) {
      const remainingSpace = PAGE_HEIGHT - currentY - MARGIN_BOTTOM - FOOTER_HEIGHT;
      if (remainingSpace < MIN_SPACE_FOR_CATEGORY) {
        doc.addPage();
        currentY = MARGIN_TOP;
      }

      // Category heading bar
      doc.setFillColor(...COLOR_BG_SURFACE);
      doc.rect(MARGIN_LEFT, currentY, CONTENT_WIDTH, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(
        this.sanitizeText(categoryResult.categoryName).toUpperCase(),
        MARGIN_LEFT + 3,
        currentY + 5.5,
      );
      currentY += 10;

      const tableBody: object[][] = [];

      for (let sampleIndex = 0; sampleIndex < categoryResult.samples.length; sampleIndex++) {
        const sample = categoryResult.samples[sampleIndex];
        const sampleBg: [number, number, number] =
          sampleIndex % 2 === 0 ? COLOR_WHITE : COLOR_BG_APP;

        // Summary row
        tableBody.push([
          {
            content: String(sample.rank),
            styles: { fontStyle: 'bold', halign: 'center', fillColor: sampleBg },
          },
          {
            content: sample.sampleCode,
            styles: { fontStyle: 'bold', halign: 'center', fillColor: sampleBg },
          },
          {
            content: this.sanitizeText(sample.producerName),
            styles: { fillColor: sampleBg, overflow: 'ellipsize' },
          },
          {
            content: `${sample.judgesScored}/${sample.totalJudges}`,
            styles: { halign: 'center', fillColor: sampleBg },
          },
          {
            content: sample.avgTotal.toFixed(2),
            styles: { fontStyle: 'bold', halign: 'right', fillColor: sampleBg },
          },
        ]);

        // Per-judge detail rows — scored judges first, then unscored
        for (const judgeScore of sample.judgeScores) {
          if (judgeScore.scored) {
            const criteriaText =
              `Bo: ${judgeScore.color.toFixed(2)}   ` +
              `Bi: ${judgeScore.clarity.toFixed(2)}   ` +
              `Ti: ${judgeScore.typicality.toFixed(2)}   ` +
              `Mi: ${judgeScore.aroma.toFixed(2)}   ` +
              `Uk: ${judgeScore.taste.toFixed(2)}`;
            tableBody.push([
              { content: '', styles: { fillColor: COLOR_WHITE } },
              {
                content: `  ${this.sanitizeText(judgeScore.judgeName)}   ${criteriaText}`,
                colSpan: 3,
                styles: {
                  fontSize: 7.5,
                  halign: 'left',
                  textColor: COLOR_TEXT_SECONDARY,
                  fillColor: COLOR_WHITE,
                  cellPadding: { top: 1, right: 2, bottom: 1, left: 4 },
                  overflow: 'ellipsize',
                },
              },
              {
                content: judgeScore.total.toFixed(2),
                styles: {
                  fontSize: 7.5,
                  fontStyle: 'bold',
                  textColor: COLOR_TEXT_SECONDARY,
                  halign: 'right',
                  fillColor: COLOR_WHITE,
                  cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
                },
              },
            ]);
          } else {
            tableBody.push([
              { content: '', styles: { fillColor: COLOR_WHITE } },
              {
                content: `  ${this.sanitizeText(judgeScore.judgeName)}`,
                colSpan: 3,
                styles: {
                  fontSize: 7.5,
                  fontStyle: 'italic',
                  halign: 'left',
                  textColor: COLOR_TEXT_SECONDARY,
                  fillColor: COLOR_WHITE,
                  cellPadding: { top: 1, right: 2, bottom: 1, left: 4 },
                  overflow: 'ellipsize',
                },
              },
              {
                content: 'nije ocjenio',
                styles: {
                  fontSize: 7.5,
                  fontStyle: 'italic',
                  textColor: COLOR_TEXT_MUTED,
                  halign: 'right',
                  fillColor: COLOR_WHITE,
                  cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
                },
              },
            ]);
          }
        }
      }

      autoTable(doc, {
        startY: currentY,
        head: [['Rang', 'Šifra', 'Proizvodjac', 'Sudije', 'Prosjek']],
        body: tableBody,
        theme: 'plain',
        styles: {
          fontSize: 9,
          cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
          textColor: COLOR_TEXT_PRIMARY,
          overflow: 'ellipsize',
        },
        headStyles: {
          fillColor: COLOR_PRIMARY,
          textColor: COLOR_WHITE,
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 14, halign: 'center' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 94, halign: 'left' },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 28, halign: 'right' },
        },
        margin: {
          left: MARGIN_LEFT,
          right: MARGIN_RIGHT,
          bottom: MARGIN_BOTTOM + FOOTER_HEIGHT,
        },
      });

      currentY = doc.lastAutoTable.finalY + 8;
    }

    // ── Page footers (drawn after all content so total page count is known) ───
    const totalPages = doc.getNumberOfPages();
    for (let pageIndex = 1; pageIndex <= totalPages; pageIndex++) {
      doc.setPage(pageIndex);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_TEXT_SECONDARY);
      doc.text(
        `Stranica ${pageIndex} od ${totalPagesPlaceholder}`,
        PAGE_WIDTH / 2,
        PAGE_HEIGHT - MARGIN_BOTTOM + 4,
        { align: 'center' },
      );
    }

    doc.putTotalPages(totalPagesPlaceholder);
    doc.save(`rezultati-${input.eventYear}.pdf`);
  }
}
