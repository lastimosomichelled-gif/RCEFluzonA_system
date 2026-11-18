import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { groupByLocation } from './group.js';

const PAGE = [841.89, 595.28]; 
const M = 36; 
const BOTTOM = 46; 
const GREEN = rgb(0.09, 0.35, 0.19);
const MID = rgb(0.36, 0.6, 0.4);
const LIGHT = rgb(0.9, 0.93, 0.86);
const PALE = rgb(0.95, 0.965, 0.94);
const INK = rgb(0.1, 0.12, 0.1);
const MUTED = rgb(0.4, 0.43, 0.4);
const LINE = rgb(0.84, 0.86, 0.83);
const WHITE = rgb(1, 1, 1);
const STATUS_COLORS = {
  Functional: rgb(0.18, 0.55, 0.28),
  Operational: rgb(0.85, 0.62, 0.1),
  'Non-Operational': rgb(0.75, 0.25, 0.22),
};

const nf = (n) => Number(n || 0).toLocaleString('en-US');
const dateText = (v) => {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

class Report {
  constructor(pdf, font, bold) {
    this.pdf = pdf;
    this.font = font;
    this.bold = bold;
    this.charset = new Set(font.getCharacterSet());
    this.page = null;
    this.y = 0;
    this.pages = [];
  }

  get width() {
    return PAGE[0] - 2 * M;
  }

  addPage() {
    this.page = this.pdf.addPage(PAGE);
    this.pages.push(this.page);
    this.y = PAGE[1] - M;
  }

  ensure(h) {
    if (!this.page || this.y - h < BOTTOM) {
      this.addPage();
      return true;
    }
    return false;
  }

  safe(text) {
    let out = '';
    for (const ch of String(text ?? '').replace(/[\r\n\t]+/g, ' ')) {
      const cp = ch.codePointAt(0);
      if (this.charset.has(cp)) out += ch;
      else if (cp === 0x2192) out += '->';
      else out += '?';
    }
    return out;
  }

  w(text, size, font = this.font) {
    return font.widthOfTextAtSize(this.safe(text), size);
  }

  text(str, x, y, { size = 9, font = this.font, color = INK } = {}) {
    this.page.drawText(this.safe(str), { x, y, size, font, color });
  }

  textRight(str, xRight, y, opts = {}) {
    const size = opts.size ?? 9;
    const font = opts.font ?? this.font;
    this.text(str, xRight - this.w(str, size, font), y, opts);
  }

  textCenter(str, xCenter, y, opts = {}) {
    const size = opts.size ?? 9;
    const font = opts.font ?? this.font;
    this.text(str, xCenter - this.w(str, size, font) / 2, y, opts);
  }

  rect(x, y, w, h, color) {
    this.page.drawRectangle({ x, y, width: w, height: h, color });
  }

  hline(x1, x2, y, color = LINE) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color });
  }

  wrap(text, maxW, size, font = this.font, maxLines = 4) {
    const t = this.safe(text).trim();
    if (!t) return [''];
    const fw = (s) => font.widthOfTextAtSize(s, size);
    const lines = [];
    let cur = '';
    for (let word of t.split(/\s+/)) {
      while (fw(word) > maxW) {
        let i = word.length;
        while (i > 1 && fw(word.slice(0, i)) > maxW) i--;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(word.slice(0, i));
        word = word.slice(i);
      }
      const trial = cur ? `${cur} ${word}` : word;
      if (fw(trial) <= maxW) cur = trial;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (last.length && fw(`${last}...`) > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}...`;
    }
    return lines;
  }


  heading(title, note) {
    this.ensure(44);
    this.y -= 6;
    this.text(title, M, this.y - 10, { size: 12, font: this.bold, color: GREEN });
    if (note) this.text(note, M + this.w(title, 12, this.bold) + 10, this.y - 10, { size: 8, color: MUTED });
    this.y -= 18;
    this.hline(M, M + this.width, this.y);
    this.y -= 8;
  }

  statCards(items) {
    const gap = 8;
    const cw = (this.width - gap * (items.length - 1)) / items.length;
    const h = 50;
    this.ensure(h + 6);
    items.forEach(([label, value], i) => {
      const x = M + i * (cw + gap);
      this.rect(x, this.y - h, cw, h, PALE);
      this.rect(x, this.y - h, 3, h, GREEN);
      this.text(label, x + 10, this.y - 15, { size: 8, color: MUTED });
      this.text(nf(value), x + 10, this.y - 38, { size: 18, font: this.bold, color: INK });
    });
    this.y -= h + 6;
  }

  barList(items, { labelW = 190, barW = 380, color } = {}) {
    const max = Math.max(1, ...items.map((i) => i.value));
    for (const item of items) {
      this.ensure(18);
      const label = this.wrap(item.label, labelW - 8, 8.5, this.font, 1)[0];
      this.text(label, M, this.y - 11, { size: 8.5 });
      this.rect(M + labelW, this.y - 12, barW, 10, PALE);
      const bw = Math.max(item.value > 0 ? 2 : 0, (item.value / max) * barW);
      this.rect(M + labelW, this.y - 12, bw, 10, item.color ?? color ?? MID);
      this.text(item.display ?? nf(item.value), M + labelW + barW + 8, this.y - 11, { size: 8.5, font: this.bold });
      this.y -= 17;
    }
    this.y -= 4;
  }

  progressRow(label, pct, note) {
    this.ensure(22);
    this.text(label, M, this.y - 11, { size: 9, font: this.bold });
    const x = M + 190;
    const bw = 380;
    this.rect(x, this.y - 12, bw, 10, PALE);
    this.rect(x, this.y - 12, Math.max(pct > 0 ? 2 : 0, (Math.min(pct, 100) / 100) * bw), 10, GREEN);
    this.text(`${pct}%`, x + bw + 8, this.y - 11, { size: 9, font: this.bold });
    if (note) this.text(note, x + bw + 44, this.y - 11, { size: 8, color: MUTED });
    this.y -= 20;
  }

  table({ columns, headerGroups, items, size = 8, empty = 'No records.' }) {
    const total = columns.reduce((a, c) => a + c.width, 0);
    const scale = this.width / total;
    const cols = columns.map((c) => ({ ...c, width: c.width * scale }));
    const pad = 3;
    const lh = size + 2;

    const drawHeader = () => {
      const rowH = 14;
      const hh = headerGroups ? rowH * 2 : rowH + 2;
      this.rect(M, this.y - hh, this.width, hh, GREEN);
      let top = this.y;
      if (headerGroups) {
        let x = M;
        let ci = 0;
        for (const g of headerGroups) {
          const gw = cols.slice(ci, ci + g.span).reduce((a, c) => a + c.width, 0);
          if (g.label) {
            this.textCenter(g.label, x + gw / 2, top - 10, { size: 8, font: this.bold, color: WHITE });
            if (ci > 0) this.page.drawLine({ start: { x, y: top }, end: { x, y: top - hh }, thickness: 0.5, color: MID });
          }
          x += gw;
          ci += g.span;
        }
        top -= rowH;
      }
      let x = M;
      for (const c of cols) {
        const opts = { size: 7.5, font: this.bold, color: WHITE };
        const ty = top - (headerGroups ? 10 : 11);
        if (c.align === 'center') this.textCenter(c.label, x + c.width / 2, ty, opts);
        else if (c.align === 'right') this.textRight(c.label, x + c.width - pad, ty, opts);
        else this.text(c.label, x + pad, ty, opts);
        x += c.width;
      }
      this.y -= hh;
    };

    this.ensure(60);
    drawHeader();

    if (!items.some((i) => i.kind === 'row')) {
      this.y -= 14;
      this.text(empty, M + 4, this.y, { size: 9, color: MUTED });
      this.y -= 10;
      return;
    }

    for (const item of items) {
      if (item.kind === 'group') {
        const h = item.level === 1 ? 17 : 15;
        if (this.ensure(h + 22)) drawHeader();
        this.rect(M, this.y - h, this.width, h, item.level === 1 ? LIGHT : PALE);
        this.text(item.text, M + (item.level === 1 ? 4 : 14), this.y - h + 5, {
          size: item.level === 1 ? 9.5 : 8.5,
          font: this.bold,
          color: item.level === 1 ? GREEN : INK,
        });
        this.y -= h;
        continue;
      }

      const cells = cols.map((c) => this.wrap(c.get(item.data), c.width - pad * 2, size, this.font, 4));
      const rowH = Math.max(...cells.map((l) => l.length)) * lh + 5;
      if (this.ensure(rowH)) drawHeader();
      let x = M;
      cols.forEach((c, i) => {
        cells[i].forEach((line, li) => {
          const ty = this.y - 3 - size - li * lh + 1;
          const opts = { size, color: c.color ? c.color(item.data) : INK };
          if (c.align === 'center') this.textCenter(line, x + c.width / 2, ty, opts);
          else if (c.align === 'right') this.textRight(line, x + c.width - pad, ty, opts);
          else this.text(line, x + pad, ty, opts);
        });
        x += c.width;
      });
      this.y -= rowH;
      this.hline(M, M + this.width, this.y);
    }
    this.y -= 6;
  }
}

function toItems(rows) {
  const items = [];
  for (const g of groupByLocation(rows)) {
    items.push({ kind: 'group', level: 1, text: `${g.region}  (${g.count})` });
    for (const p of g.provinces) {
      items.push({ kind: 'group', level: 2, text: `${p.province}  (${p.rows.length})` });
      for (const data of p.rows) items.push({ kind: 'row', data });
    }
  }
  return items;
}

const DOC_COLUMNS = [
  ['eval', 'Eval'], ['val', 'Val'], ['letter', 'Letter'], ['board', 'Board'],
  ['certacc', 'CertAcc'], ['members', 'Members'], ['mach', 'Mach'], ['certreg', 'CertReg'],
];
const REQ_GROUPS = [
  ['MOA', 'moa', ['target', 'signed', 'transmitted', 'received', 'distributed']],
  ['COD', 'cod', ['target', 'signed', 'transmitted', 'received', 'distributed']],
  ['DOD', 'dod', ['target', 'signed', 'transmitted', 'received', 'distributed']],
  ['Members', 'mem', ['target', 'uploaded']],
];
const REQ_LABEL = {
  target: 'Target', signed: 'Signed', transmitted: 'Trans.', received: 'Recv.',
  distributed: 'Dist.', uploaded: 'Upl.',
};

export async function buildReportPdf(data) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle('RCEF Monitoring - Summary and Lists');
  pdf.setAuthor('RCEF Monitoring');
  const r = new Report(pdf, font, bold);
  r.addPage();

  r.text('RCEF MONITORING', M, r.y - 10, { size: 8, font: bold, color: MUTED });
  r.text('Summary Report', M, r.y - 34, { size: 24, font: bold, color: GREEN });
  r.textRight(`Generated ${data.generatedAt}`, M + r.width, r.y - 12, { size: 8.5, color: MUTED });
  r.textRight(`Prepared by ${data.preparedBy}`, M + r.width, r.y - 24, { size: 8.5, color: MUTED });
  r.textRight(`Luzon A  |  ${data.yearLabel}`, M + r.width, r.y - 36, { size: 8.5, font: bold, color: INK });
  r.y -= 48;

  r.statCards(data.stats);

  r.heading('Units delivered per fund source', 'Total units per fund source');
  if (data.delivery.length) r.barList(data.delivery.map((d) => ({ label: d.label, value: d.value })));
  else {
    r.text('No machinery records yet.', M, r.y - 10, { size: 9, color: MUTED });
    r.y -= 18;
  }

  r.heading('Machinery status', 'Number of records per status');
  const statusTotal = data.status.reduce((a, s) => a + s.value, 0);
  if (statusTotal) {
    r.barList(data.status.map((s) => ({
      label: s.label,
      value: s.value,
      color: STATUS_COLORS[s.label],
      display: `${nf(s.value)}  (${Math.round((100 * s.value) / statusTotal)}%)`,
    })));
  } else {
    r.text('No records yet.', M, r.y - 10, { size: 9, color: MUTED });
    r.y -= 18;
  }

  r.heading('Machinery by region', 'Record count and total quantity');
  r.table({
    columns: [
      { label: 'Region', width: 400, get: (x) => x.region },
      { label: 'Records', width: 100, align: 'right', get: (x) => nf(x.records) },
      { label: 'Total units', width: 100, align: 'right', get: (x) => nf(x.units) },
    ],
    items: data.regions.map((x) => ({ kind: 'row', data: x })),
    size: 8.5,
    empty: 'No records yet.',
  });

  r.heading('FCA document monitoring', 'Complete = Eval, Val, Letter, Board, CertAcc, Members and Mach all ticked');
  r.progressRow('Documents complete', data.docs.pct, 'Ticked steps across all FCAs');
  r.progressRow('Fully complete FCAs', data.docs.fullPct, `${nf(data.docs.full)} / ${nf(data.docs.total)} FCAs`);

  r.heading('FCA Requirements checklist', '% complete = target FCAs with all steps ticked / all target FCAs');
  for (const s of data.reqs) r.progressRow(s.label, s.pct, `${nf(s.full)} / ${nf(s.targets)} target FCAs fully complete`);

  r.addPage();
  r.heading('Machinery records', `${nf(data.machinery.length)} record(s), grouped by region and province`);
  r.table({
    columns: [
      { label: 'FCA', width: 150, get: (x) => x.fca || '-' },
      { label: 'Machinery type', width: 150, get: (x) => x.machinery_type },
      { label: 'Fund year', width: 50, align: 'center', get: (x) => (x.fund_year ?? '-') },
      { label: 'Qty', width: 40, align: 'right', get: (x) => nf(x.quantity) },
      { label: 'Status', width: 85, get: (x) => x.status, color: (x) => STATUS_COLORS[x.status] ?? INK },
      { label: 'Last update', width: 70, align: 'center', get: (x) => dateText(x.last_update) },
      { label: 'Remarks', width: 225, get: (x) => x.remarks || '' },
    ],
    items: toItems(data.machinery),
  });

  r.addPage();
  r.heading('FCA documents', `${nf(data.fcaDocs.length)} FCA(s), grouped by region and province`);
  r.table({
    columns: [
      { label: 'FCA', width: 170, get: (x) => x.fca_name },
      { label: 'Fund source', width: 90, get: (x) => x.fund_source || '-' },
      ...DOC_COLUMNS.map(([key, label]) => ({
        label, width: 34, align: 'center', get: (x) => (Number(x[key]) > 0 ? 'Yes' : '-'),
      })),
      {
        label: 'Done', width: 40, align: 'center',
        get: (x) => `${DOC_COLUMNS.filter(([k]) => Number(x[k]) > 0).length}/${DOC_COLUMNS.length}`,
      },
      { label: 'Remarks', width: 178, get: (x) => x.remarks || '' },
    ],
    items: toItems(data.fcaDocs),
  });

  r.addPage();
  r.heading('FCA requirements', `${nf(data.requirements.length)} FCA(s), grouped by region and province`);
  r.table({
    columns: [
      { label: 'FCA', width: 170, get: (x) => x.fca_name },
      ...REQ_GROUPS.flatMap(([, prefix, fields]) => fields.map((f) => ({
        label: REQ_LABEL[f], width: 35, align: 'center', get: (x) => nf(x[`${prefix}_${f}`]),
      }))),
    ],
    headerGroups: [
      { label: '', span: 1 },
      ...REQ_GROUPS.map(([label, , fields]) => ({ label, span: fields.length })),
    ],
    items: toItems(data.requirements),
    size: 7.5,
  });

  r.pages.forEach((page, i) => {
    page.drawText(`RCEF Monitoring  -  Luzon A`, { x: M, y: 24, size: 7.5, font, color: MUTED });
    const label = `Page ${i + 1} of ${r.pages.length}`;
    page.drawText(label, {
      x: PAGE[0] - M - font.widthOfTextAtSize(label, 7.5), y: 24, size: 7.5, font, color: MUTED,
    });
  });

  return pdf.save();
}
