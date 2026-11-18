import { Fragment } from 'react';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { deleteFcaDocument, saveFcaDocument } from '../../actions';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';
import LocationFilters from '@/components/LocationFilters';
import { groupByLocation } from '@/lib/group';
import FcaLocationFields from '@/components/FcaLocationFields';

export const metadata = { title: 'FCA Documents' };

const regionRowStyle = { background: '#e7eddc', fontWeight: 700, fontSize: '1.05em' };
const provinceRowStyle = { background: '#f3f6ef', fontWeight: 600, paddingLeft: 28 };

const DOCUMENTS = [
  ['eval', 'Evaluation'],
  ['val', 'Validation'],
  ['letter', 'Endorsement Letter'],
  ['board', 'Board Resolution'],
  ['certacc', 'Certificate of Accreditation'],
  ['members', 'List of Members'],
  ['mach', 'List of Machinery'],
  ['certreg', 'Certificate of Registration'],
];

function DocumentFields({ record }) {
  return (
    <>
      {record?.id ? <input type="hidden" name="id" value={record.id} /> : null}
      <div className="field">
        <label>FCA/LGU Name</label>
        <input name="fca_name" required maxLength={180} defaultValue={record?.fca_name ?? ''} />
      </div>
      <FcaLocationFields record={record} />
      <div className="field wide">
        <label>Remarks</label>
        <textarea name="remarks" rows="2" defaultValue={record?.remarks ?? ''} />
      </div>
      <div className="field wide">
        <label>Documents received</label>
        <div className="check-grid">
          {DOCUMENTS.map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" name={key} defaultChecked={Number(record?.[key] ?? 0) > 0} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

export default async function FcaDocumentsPage({ searchParams }) {
  const user = await requireUser();
  const term = String(searchParams?.q ?? '').trim().slice(0, 100);
  const region = String(searchParams?.region ?? '').trim().slice(0, 100);
  const province = String(searchParams?.province ?? '').trim().slice(0, 100);
  const fundSource = String(searchParams?.fund_source ?? '').trim().slice(0, 50);
  const rows = await sql`
    SELECT id, fca_name, region, province, fund_source,
      eval, val, letter, board, certacc, members, mach, certreg, remarks
    FROM fca_documents
    WHERE (${term} = '' OR fca_name ILIKE ${`%${term}%`} OR
      region ILIKE ${`%${term}%`} OR province ILIKE ${`%${term}%`})
      AND (${region} = '' OR region = ${region})
      AND (${province} = '' OR province = ${province})
      AND (${fundSource} = '' OR fund_source = ${fundSource})
    ORDER BY region, province, fca_name`;
  const groups = groupByLocation(rows);

  return (
    <>
      <PageHeader title="FCA Documents" />
      <section className="content">
        <Notice ok={searchParams?.ok} error={searchParams?.error} />
        <section className="panel">
          <details>
            <summary><strong>Add FCA document record</strong></summary>
            <form action={saveFcaDocument} className="wide-form">
              <div className="form-grid">
                <DocumentFields />
              </div>
              <div className="buttons"><button className="btn primary">Save record</button></div>
            </form>
          </details>
        </section>

        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>FCA document checklist</h3>
              <p>Check each document when transmitted.</p>
            </div>
          </div>
          <LocationFilters
            action="/fca_documents"
            q={term}
            region={region}
            province={province}
            fundSource={fundSource}
            placeholder="Search FCA name"
          />
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>FCA</th><th>Region</th><th>Province</th><th>Fund source</th><th>Documents complete</th><th>Remarks</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.region}>
                    <tr><td colSpan="7" style={regionRowStyle}>{group.region} ({group.count})</td></tr>
                    {group.provinces.map((prov) => (
                      <Fragment key={`${group.region}-${prov.province}`}>
                        <tr><td colSpan="7" style={provinceRowStyle}>{prov.province} ({prov.rows.length})</td></tr>
                        {prov.rows.map((record) => {
                        const complete = DOCUMENTS.filter(([key]) => Number(record[key]) > 0).length;
                            return (
                              <tr key={record.id}>
                                <td><strong>{record.fca_name}</strong></td>
                                <td>{record.region}</td>
                                <td>{record.province}</td>
                                <td>{record.fund_source || '—'}</td>
                                <td>{complete} / {DOCUMENTS.length}</td>
                                <td>{record.remarks || '-'}</td>
                                <td>
                                  <details>
                                    <summary>Edit</summary>
                                    <form action={saveFcaDocument} className="wide-form">
                                      <div className="form-grid"><DocumentFields record={record} /></div>
                                      <div className="buttons"><button className="btn secondary">Save changes</button></div>
                                    </form>
                                    {user.role === 'admin' ? (
                                      <form action={deleteFcaDocument} className="inline">
                                        <input type="hidden" name="id" value={record.id} />
                                        <button className="link-btn">Delete record</button>
                                      </form>
                                    ) : null}
                                  </details>
                                </td>
                              </tr>
                            );
                        })}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
                {!rows.length ? <tr><td className="empty" colSpan="7">No FCA document records found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
}
