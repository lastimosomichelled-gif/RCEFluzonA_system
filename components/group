import { REGIONS } from '@/lib/locations';

export function groupByLocation(rows) {
  const regions = new Map();
  for (const row of rows) {
    const r = row.region || 'No region';
    const p = row.province || 'No province';
    if (!regions.has(r)) regions.set(r, new Map());
    const provinces = regions.get(r);
    if (!provinces.has(p)) provinces.set(p, []);
    provinces.get(p).push(row);
  }

  const rank = (list, value) => {
    const i = list.indexOf(value);
    return i < 0 ? 999 : i;
  };
  const regionOrder = Object.keys(REGIONS);

  return [...regions.keys()]
    .sort((a, b) => rank(regionOrder, a) - rank(regionOrder, b) || a.localeCompare(b))
    .map((region) => {
      const provinceOrder = REGIONS[region] ?? [];
      const provinces = [...regions.get(region).entries()]
        .sort(([a], [b]) => rank(provinceOrder, a) - rank(provinceOrder, b) || a.localeCompare(b))
        .map(([province, items]) => ({ province, rows: items }));
      return { region, count: provinces.reduce((n, p) => n + p.rows.length, 0), provinces };
    });
}
