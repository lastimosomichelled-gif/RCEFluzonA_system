import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { deleteFcaDocument, saveFcaDocument } from '../../actions';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';

export const metadata = { title: 'FCA Documents' };

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
        <label>FCA name</label>
        <input name="fca_name" required maxLength={180} defaultValue={record?.fca_name ?? ''} />
      </div>
      <div className="field">
        <label>Region</label>
        <input name="region" required maxLength={100} defaultValue={record?.region ?? ''} />
      </div>
      <div className="field">
        <label>Province</label>
        <input name="province" required maxLength={100} defaultValue={record?.province ?? ''} />
      </div>
      <div className="field">
        <label>Fund source</label>
        <input name="fund_source" maxLength={50} defaultValue={record?.fund_source ?? ''} />
      </div>
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
  const rows = await sql`
    SELECT id, fca_name, region, province, fund_source,
      eval, val, letter, board, certacc, members, mach, certreg, remarks
    FROM fca_documents
    WHERE (${term} = '' OR fca_name ILIKE ${`%${term}%`} OR
      region ILIKE ${`%${term}%`} OR province ILIKE ${`%${term}%`})
    ORDER BY region, province, fca_name`;

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
          <form className="filters" method="get">
            <input name="q" defaultValue={term} placeholder="Search FCA, region, or province" aria-label="Search FCA documents" />
            <button className="btn secondary">Search</button>
            <a className="btn secondary" href="/fca_documents">Clear</a>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>FCA</th><th>Region</th><th>Province</th><th>Fund source</th><th>Documents complete</th><th>Remarks</th></tr>
              </thead>
              <tbody>
                {rows.map((record) => {
                  const complete = DOCUMENTS.filter(([key]) => Number(record[key]) > 0).length;
                  return (
                    <tr key={record.id}>
                      <td><strong>{record.fca_name}</strong>{record.remarks ? <small>{record.remarks}</small> : null}</td>
                      <td>{record.region}</td>
                      <td>{record.province}</td>
                      <td>{record.fund_source || '—'}</td>
                      <td>{complete} / {DOCUMENTS.length}</td>
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
                {!rows.length ? <tr><td className="empty" colSpan="6">No FCA document records found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
}
