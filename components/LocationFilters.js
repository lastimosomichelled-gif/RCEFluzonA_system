'use client';
import { useState } from 'react';
import { REGIONS, FUND_SOURCES } from '@/lib/locations';

export default function LocationFilters({ action, q, region: initialRegion, province: initialProvince, fundSource, placeholder }) {
  const [region, setRegion] = useState(initialRegion || '');
  const [province, setProvince] = useState(initialProvince || '');

  const provinces = region ? (REGIONS[region] ?? []) : Object.values(REGIONS).flat();
  const sources = [...FUND_SOURCES];
  if (fundSource && !sources.includes(fundSource)) sources.push(fundSource);

  return (
    <form className="filters" method="get" action={action}>
      <input name="q" defaultValue={q} placeholder={placeholder} aria-label="Search" />
      <select
        name="region"
        value={region}
        aria-label="Filter by region"
        onChange={(e) => { setRegion(e.target.value); setProvince(''); }}
      >
        <option value="">All regions</option>
        {Object.keys(REGIONS).map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select
        name="province"
        value={province}
        aria-label="Filter by province"
        onChange={(e) => setProvince(e.target.value)}
      >
        <option value="">All provinces</option>
        {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select name="fund_source" defaultValue={fundSource || ''} aria-label="Filter by fund source">
        <option value="">All fund sources</option>
        {sources.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button className="btn secondary">Search</button>
      <a className="btn secondary" href={action}>Clear</a>
    </form>
  );
}
