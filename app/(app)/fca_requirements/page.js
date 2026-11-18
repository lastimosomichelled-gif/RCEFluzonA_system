import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { saveFcaRequirements } from '../../actions';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';

export const metadata = { title: 'FCA Requirements' };

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
  const rows = await sql`
    SELECT d.id, d.fca_name, d.region, d.province,
      c.moa_target, c.moa_signed, c.moa_transmitted, c.moa_received, c.moa_distributed,
      c.cod_target, c.cod_signed, c.cod_transmitted, c.cod_received, c.cod_distributed,
      c.dod_target, c.dod_signed, c.dod_transmitted, c.dod_received, c.dod_distributed,
      c.mem_target, c.mem_uploaded
    FROM fca_documents d
    LEFT JOIN fca_checklists c ON c.fca_id = d.id
    WHERE (${term} = '' OR d.fca_name ILIKE ${`%${term}%`} OR
      d.region ILIKE ${`%${term}%`} OR d.province ILIKE ${`%${term}%`})
    ORDER BY d.region, d.province, d.fca_name`;

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
          <form className="filters" method="get">
            <input name="q" defaultValue={term} placeholder="Search FCA, region, or province" aria-label="Search requirements" />
            <button className="btn secondary">Search</button>
            <a className="btn secondary" href="/fca_requirements">Clear</a>
          </form>
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
                {rows.map((record) => {
                  const formId = `requirements-${record.id}`;
                  return (
                    <tr key={record.id}>
                      <td className="sticky-col">
                        <form id={formId} action={saveFcaRequirements} className="inline">
                          <input type="hidden" name="fca_id" value={record.id} />
                        </form>
                        <strong>{record.fca_name}</strong>
                        <small>{[record.region, record.province].filter(Boolean).join(' · ')}</small>
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
