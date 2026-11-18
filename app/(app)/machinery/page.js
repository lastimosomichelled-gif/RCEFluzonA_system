import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { deleteMachinery, saveMachinery } from '../../actions';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';
import MachineryLocationFields from '@/components/MachineryFields';

export const metadata = { title: 'Machinery Status' };

const today = () => new Date().toISOString().slice(0, 10);
const dateValue = (value) => value ? String(value).slice(0, 10) : '';

function MachineryFields({ record, id }) {
  return (
    <>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <div className="field">
        <label>FCA/LGU Name</label>
        <input name="fca" defaultValue={record?.fca ?? ''} maxLength={180} />
      </div>
      <div className="field">
        <label>Fund year</label>
        <select name="fund_year" defaultValue={record?.fund_year ?? ''}>
          <option value="">Not specified</option>
          {Array.from({ length: 13 }, (_, index) => 2019 + index).map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>
      <MachineryLocationFields record={record} />
      <div className="field">
        <label>Quantity</label>
        <input type="number" name="quantity" min="1" step="1" required defaultValue={record?.quantity ?? 1} />
      </div>
      <div className="field">
        <label>Status</label>
        <select name="status" defaultValue={record?.status ?? 'Functional'} required>
          <option>Functional</option>
          <option>Operational</option>
          <option>Non-Operational</option>
        </select>
      </div>
      <div className="field">
        <label>Date of Monitoring</label>
        <input type="date" name="last_update" required defaultValue={dateValue(record?.last_update) || today()} />
      </div>
      <div className="field wide">
        <label>Remarks</label>
        <textarea name="remarks" rows="2" defaultValue={record?.remarks ?? ''} />
      </div>
    </>
  );
}

export default async function MachineryPage({ searchParams }) {
  const user = await requireUser();
  const term = String(searchParams?.q ?? '').trim().slice(0, 100);
  const status = ['Functional', 'Operational', 'Non-Operational'].includes(searchParams?.status)
    ? searchParams.status
    : '';
  const yearInput = String(searchParams?.fund_year ?? '');
  const year = /^\d{4}$/.test(yearInput) && Number(yearInput) >= 2019 && Number(yearInput) <= 2031
    ? Number(yearInput)
    : null;

  const rows = await sql`
    SELECT id, fca, machinery_type, fund_year, region, province,
    quantity, status, last_update, remarks
    FROM machinery
    WHERE (${term} = '' OR
      fca ILIKE ${`%${term}%`} OR machinery_type ILIKE ${`%${term}%`} OR
      region ILIKE ${`%${term}%`} OR province ILIKE ${`%${term}%`})
      AND (${status} = '' OR status = ${status})
      AND (${year}::smallint IS NULL OR fund_year = ${year})
    ORDER BY last_update DESC, id DESC`;

  return (
    <>
      <PageHeader title="Machinery records" />
      <section className="content">
        <Notice ok={searchParams?.ok} error={searchParams?.error} />
        <section className="panel">
          <div className="panel-title">
            <div>
              <h3>Add machinery</h3>
              <p>Record equipment distribution and its current status.</p>
            </div>
          </div>
          <form action={saveMachinery} className="wide-form">
            <div className="form-grid">
              <MachineryFields />
            </div>
            <div className="buttons"><button className="btn primary">Add record</button></div>
          </form>
        </section>

        <section className="panel">
          <h3>Machinery inventory</h3>
          <form className="filters" method="get">
            <input name="q" defaultValue={term} placeholder="Search FCA, type, or location" aria-label="Search machinery" />
            <select name="status" defaultValue={status} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option>Functional</option>
              <option>Operational</option>
              <option>Non-Operational</option>
            </select>
            <select name="fund_year" defaultValue={year ?? ''} aria-label="Filter by fund year">
              <option value="">All fund years</option>
              {Array.from({ length: 13 }, (_, index) => 2019 + index).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="btn secondary">Filter</button>
            <a className="btn secondary" href="/machinery">Clear</a>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>FCA / equipment</th><th>Location</th><th>Year</th>
                  <th>Qty</th><th>Status</th><th>Date of Monitoring</th><th>Remarks</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((record) => (
                  <tr key={record.id}>
                    <td>{record.fca || '—'}<small>{record.machinery_type}</small></td>
                    <td>{[record.province, record.region].filter(Boolean).join(', ')}</td>
                    <td>{record.fund_year ?? '—'}</td>
                    <td>{record.quantity}</td>
                    <td><span className="status">{record.status}</span></td>
                    <td>{dateValue(record.last_update)}</td>
                    <td>{record.remarks || '-'}</td>
                    <td>
                      <details>
                        <summary>Edit</summary>
                        <form action={saveMachinery} className="wide-form">
                          <div className="form-grid">
                            <MachineryFields record={record} id={record.id} />
                          </div>
                          <div className="buttons">
                            <button className="btn secondary">Save changes</button>
                          </div>
                        </form>
                        {user.role === 'admin' ? (
                          <form action={deleteMachinery} className="inline">
                            <input type="hidden" name="id" value={record.id} />
                            <button className="link-btn">Delete record</button>
                          </form>
                        ) : null}
                      </details>
                    </td>
                  </tr>
                ))}
                {!rows.length ? <tr><td className="empty" colSpan="8">No machinery records match these filters.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </>
  );
}
