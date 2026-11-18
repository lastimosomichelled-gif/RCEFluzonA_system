'use client';
import { useState } from 'react';
import { REGIONS, FUND_SOURCES } from '@/lib/locations';

export default function FcaLocationFields({ record }) {
  const [region, setRegion] = useState(record?.region ?? '');
  const [province, setProvince] = useState(record?.province ?? '');

  const regionNames = Object.keys(REGIONS);
  if (region && !regionNames.includes(region)) regionNames.push(region);
  const provinces = [...(REGIONS[region] ?? [])];
  if (province && region && !provinces.includes(province)) provinces.push(province);

  const sources = [...FUND_SOURCES];
  const currentSource = record?.fund_source;
  if (currentSource && !sources.includes(currentSource)) sources.push(currentSource);

  return (
    <>
      <div className="field">
        <label>Region</label>
        <select
          name="region"
          value={region}
          required
          onChange={(e) => { setRegion(e.target.value); setProvince(''); }}
        >
          <option value="" disabled>Select region</option>
          {regionNames.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Province</label>
        <select
          name="province"
          value={province}
          required
          disabled={!region}
          onChange={(e) => setProvince(e.target.value)}
        >
          <option value="" disabled>{region ? 'Select province' : 'Select region first'}</option>
          {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Fund source</label>
        <select name="fund_source" defaultValue={currentSource ?? ''}>
          <option value="">Not specified</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </>
  );
}
