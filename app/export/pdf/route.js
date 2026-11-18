import { sql } from '@/lib/db';
import { me } from '@/lib/auth';
import { buildReportPdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOC_KEYS = ['eval', 'val', 'letter', 'board', 'certacc', 'members', 'mach'];
const REQ_DEFS = [
  ['MOA', ['moa_target', 'moa_signed', 'moa_transmitted', 'moa_received', 'moa_distributed']],
  ['COD', ['cod_target', 'cod_signed', 'cod_transmitted', 'cod_received', 'cod_distributed']],
  ['DOD', ['dod_target', 'dod_signed', 'dod_transmitted', 'dod_received', 'dod_distributed']],
  ['Members', ['mem_target', 'mem_uploaded']],
];

export async function GET(request) {
  const user = await me();
  if (!user) return new Response('Please log in first.', { status: 401 });

  const raw = String(new URL(request.url).searchParams.get('fund_year') ?? '').trim();
  const yearNum = /^\d{4}$/.test(raw) && +raw >= 2019 && +raw <= 2031 ? +raw : null;
  const where = yearNum ? sql`WHERE fund_year = ${yearNum}` : sql``;
  const whereM = yearNum ? sql`WHERE m.fund_year = ${yearNum}` : sql``;

  const [s] = await sql`
    SELECT COUNT(*)::int AS records,
      COALESCE(SUM(quantity),0)::int AS units,
      COUNT(*) FILTER (WHERE status = 'Functional')::int AS functional,
      COUNT(*) FILTER (WHERE status = 'Operational')::int AS operational,
      COUNT(*) FILTER (WHERE status = 'Non-Operational')::int AS nonop,
      COUNT(DISTINCT NULLIF(province,''))::int AS provinces
    FROM machinery ${where}`;

  const regions = await sql`
    SELECT region, COUNT(*)::int AS records, COALESCE(SUM(quantity),0)::int AS units
    FROM machinery ${where} GROUP BY region ORDER BY region`;

  const deliveryData = await sql`
    SELECT m.fund_year, MAX(fs.fund_source) AS src, COALESCE(SUM(m.quantity),0)::int AS total_units
    FROM machinery m LEFT JOIN fund_sources fs ON fs.fund_year = m.fund_year
    ${whereM}
    GROUP BY m.fund_year ORDER BY m.fund_year ASC NULLS LAST`;
  const delivery = deliveryData.map((r) => ({
    label: r.fund_year === null ? 'Not specified' : `${r.src || 'Fund'} ${r.fund_year}`.trim(),
    value: r.total_units,
  }));

  const fcaRows = await sql`
    SELECT d.eval, d.val, d.letter, d.board, d.certacc, d.members, d.mach,
      COALESCE(c.moa_target,0) AS moa_target, COALESCE(c.moa_signed,0) AS moa_signed,
      COALESCE(c.moa_transmitted,0) AS moa_transmitted, COALESCE(c.moa_received,0) AS moa_received,
      COALESCE(c.moa_distributed,0) AS moa_distributed,
      COALESCE(c.cod_target,0) AS cod_target, COALESCE(c.cod_signed,0) AS cod_signed,
      COALESCE(c.cod_transmitted,0) AS cod_transmitted, COALESCE(c.cod_received,0) AS cod_received,
      COALESCE(c.cod_distributed,0) AS cod_distributed,
      COALESCE(c.dod_target,0) AS dod_target, COALESCE(c.dod_signed,0) AS dod_signed,
      COALESCE(c.dod_transmitted,0) AS dod_transmitted, COALESCE(c.dod_received,0) AS dod_received,
      COALESCE(c.dod_distributed,0) AS dod_distributed,
      COALESCE(c.mem_target,0) AS mem_target, COALESCE(c.mem_uploaded,0) AS mem_uploaded
    FROM fca_documents d LEFT JOIN fca_checklists c ON c.fca_id = d.id`;

  const docTotal = fcaRows.length;
  let docSteps = 0;
  let docFull = 0;
  for (const r of fcaRows) {
    const n = DOC_KEYS.reduce((a, k) => a + Number(r[k]), 0);
    docSteps += n;
    if (n === DOC_KEYS.length) docFull++;
  }
  const docs = {
    total: docTotal,
    full: docFull,
    pct: docTotal ? Math.round((100 * docSteps) / (docTotal * DOC_KEYS.length)) : 0,
    fullPct: docTotal ? Math.round((100 * docFull) / docTotal) : 0,
  };

  const reqs = REQ_DEFS.map(([label, keys]) => {
    let targets = 0;
    let full = 0;
    for (const r of fcaRows) {
      if (!Number(r[keys[0]])) continue;
      targets++;
      const done = keys.slice(1).reduce((a, k) => a + Number(r[k]), 0);
      if (done === keys.length - 1) full++;
    }
    return { label, targets, full, pct: targets ? Math.round((100 * full) / targets) : 0 };
  });

  // ----- full lists -----
  const machinery = await sql`
    SELECT fca, machinery_type, fund_year, region, province, quantity, status, last_update, remarks
    FROM machinery ${where}
    ORDER BY region, province, last_update DESC, id DESC`;

  const fcaDocs = await sql`
    SELECT id, fca_name, region, province, fund_source,
      eval, val, letter, board, certacc, members, mach, certreg, remarks
    FROM fca_documents
    ORDER BY region, province, fca_name`;

  const requirements = await sql`
    SELECT d.id, d.fca_name, d.region, d.province,
      COALESCE(c.moa_target,0) AS moa_target, COALESCE(c.moa_signed,0) AS moa_signed,
      COALESCE(c.moa_transmitted,0) AS moa_transmitted, COALESCE(c.moa_received,0) AS moa_received,
      COALESCE(c.moa_distributed,0) AS moa_distributed,
      COALESCE(c.cod_target,0) AS cod_target, COALESCE(c.cod_signed,0) AS cod_signed,
      COALESCE(c.cod_transmitted,0) AS cod_transmitted, COALESCE(c.cod_received,0) AS cod_received,
      COALESCE(c.cod_distributed,0) AS cod_distributed,
      COALESCE(c.dod_target,0) AS dod_target, COALESCE(c.dod_signed,0) AS dod_signed,
      COALESCE(c.dod_transmitted,0) AS dod_transmitted, COALESCE(c.dod_received,0) AS dod_received,
      COALESCE(c.dod_distributed,0) AS dod_distributed,
      COALESCE(c.mem_target,0) AS mem_target, COALESCE(c.mem_uploaded,0) AS mem_uploaded
    FROM fca_documents d
    LEFT JOIN fca_checklists c ON c.fca_id = d.id
    ORDER BY d.region, d.province, d.fca_name`;

  const today = new Date().toISOString().slice(0, 10);
  const bytes = await buildReportPdf({
    generatedAt: today,
    preparedBy: user.full_name,
    yearLabel: yearNum ? `Fund year ${yearNum}` : 'All years (2019-2031)',
    stats: [
      ['Machinery records', s.records],
      ['Total units', s.units],
      ['Functional', s.functional],
      ['Operational', s.operational],
      ['Non-Operational', s.nonop],
      ['Provinces covered', s.provinces],
    ],
    delivery,
    status: [
      { label: 'Functional', value: s.functional },
      { label: 'Operational', value: s.operational },
      { label: 'Non-Operational', value: s.nonop },
    ],
    regions,
    docs,
    reqs,
    machinery,
    fcaDocs,
    requirements,
  });

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="RCEF-report-${yearNum ?? 'all-years'}-${today}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
