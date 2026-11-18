import { Fragment } from 'react';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { saveFcaRequirements } from '../../actions';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';
import LocationFilters from '@/components/LocationFilters';
import { groupByLocation } from '@/lib/group';

export const metadata = { title: 'FCA Requirements' };

const regionRowStyle = { background: '#e7eddc', fontWeight: 700, fontSize: '1.05em' };
const provinceRowStyle = { background: '#f3f6ef', fontWeight: 600, paddingLeft: 28 };

const GROUPS = [
  ['MOA', ['moa_target', 'moa_signed', 'moa_transmitted', 'moa_received', 'moa_distributed']],
  ['COD', ['cod_target', 'cod_signed', 'cod_transmitted', 'cod_received', 'cod_distributed']],
  ['DOD', ['dod_target', 'dod_signed', 'dod_transmitted', 'dod_received', 'dod_distributed']],
  ['Members', ['mem_target', 'mem_uploaded']],
];
const LABELS = {
  target: 'Target',
  signed: 'Signed',
  transmitted: 'Transmitted',
  received: 'Received',
  distributed: 'Distributed',
  uploaded: 'Uploaded',
};

function RequirementInput({ name, value, form }) {
  const suffix = name.replace(/^(moa|cod|dod|mem)_/, '');
  return (
    <input
      aria-label={name.replace('_', ' ')}
      type="number"
      name={name}
      form={form}
      min="0"
      max="32767"
      step="1"
      required
      defaultValue={value ?? 0}
      title={LABELS[suffix]}
    />
  );
}

export default async function FcaRequirementsPage({ searchParams }) {
  await requireUser();
  const term = String(searchParams?.q ?? '').trim().slice(0, 100);
  const region = String(searchParams?.region ?? '').trim().slice(0, 100);
  const province = String(searchParams?.province ?? '').trim().slice(0, 100);
  const fundSource = String(searchParams?.fund_source ?? '').trim().slice(0, 50);
  const rows = await sql`
    SELECT d.id, d.fca_name, d.region, d.province, d.fund_source,
      c.moa_target, c.moa_signed, c.moa_transmitted, c.moa_received, c.moa_distributed,
      c.cod_target, c.cod_signed, c.cod_transmitted, c.cod_received, c.cod_distributed,
      c.dod_target, c.dod_signed, c.dod_transmitted, c.dod_received, c.dod_distributed,
      c.mem_target, c.mem_uploaded
    FROM fca_documents d
    LEFT JOIN fca_checklists c ON c.fca_id = d.id
    WHERE (${term} = '' OR d.fca_name ILIKE ${`%${term}%`} OR
      d.region ILIKE ${`%${term}%`} OR d.province ILIKE ${`%${term}%`})
      AND (${region} = '' OR d.region = ${region})
      AND (${province} = '' OR d.province = ${province})
      AND (${fundSource} = '' OR d.fund_source = ${fundSource})
    ORDER BY d.region, d.province, d.fca_name`;
  const groups = groupByLocation(rows);

  return (
    <>
      <PageHeader title="FCA Requirements" />
      <section className="content">
        <Notice ok={searchParams?.ok} error={searchParams?.error} />
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>FCA agreement and membership progress</h3>
              <p>Enter whole-number targets and completed steps for each FCA. Save one row at a time.</p>
            </div>
          </div>
          <LocationFilters
            action="/fca_requirements"
            q={term}
            region={region}
            province={province}
            fundSource={fundSource}
            placeholder="Search FCA name"
          />
          <div className="table-wrap">
            <table className="fca-table">
              <thead>
                <tr>
                  <th rowSpan="2" className="sticky-col">FCA / location</th>
                  {GROUPS.map(([label, fields]) => <th key={label} colSpan={fields.length}>{label}</th>)}
                  <th rowSpan="2">Save</th>
                </tr>
                <tr>
                  {GROUPS.flatMap(([label, fields]) => fields.map((field) => (
                    <th key={`${label}-${field}`}>{LABELS[field.replace(/^(moa|cod|dod|mem)_/, '')]}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.region}>
                    <tr><td colSpan="19" style={regionRowStyle}>{group.region} ({group.count})</td></tr>
                    {group.provinces.map((prov) => (
                      <Fragment key={`${group.region}-${prov.province}`}>
                        <tr><td colSpan="19" style={provinceRowStyle}>{prov.province} ({prov.rows.length})</td></tr>
                        {prov.rows.map((record) => {
                        const formId = `requirements-${record.id}`;
                        return (
                          <tr key={record.id}>
                            <td className="sticky-col">
                              <form id={formId} action={saveFcaRequirements} className="inline">
                                <input type="hidden" name="fca_id" value={record.id} />
                              </form>
                              <strong>{record.fca_name}</strong>
                              <small>{record.fund_source || ''}</small>
                            </td>
                            {GROUPS.flatMap(([, fields]) => fields.map((field) => (
                              <td className="num" key={`${record.id}-${field}`}>
                                <RequirementInput name={field} form={formId} value={record[field]} />
                              </td>
                            )))}
                            <td><button className="btn secondary" type="submit" form={formId}>Save</button></td>
                          </tr>
                        );

                        })}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
                {!rows.length ? (
                  <tr><td className="empty" colSpan="19">No FCA records found. Add an FCA in FCA Documents first.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
}
