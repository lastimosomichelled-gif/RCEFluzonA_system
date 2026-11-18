'use client';
import { useState } from 'react';
import { REGIONS, MACHINERY_TYPES } from '@/lib/locations';

export default function MachineryLocationFields({ record }) {
  const [region, setRegion] = useState(record?.region ?? '');
  const [province, setProvince] = useState(record?.province ?? '');

  const regionNames = Object.keys(REGIONS);
  if (region && !regionNames.includes(region)) regionNames.push(region);
  const provinces = [...(REGIONS[region] ?? [])];
  if (province && region && !provinces.includes(province)) provinces.push(province);

  const types = [...MACHINERY_TYPES];
  const currentType = record?.machinery_type;
  if (currentType && !types.includes(currentType)) types.push(currentType);

  return (
    <>
      <div className="field">
        <label>Machinery type</label>
        <select name="machinery_type" defaultValue={currentType ?? ''} required>
          <option value="" disabled>Select machinery</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
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
    </>
  );
}
