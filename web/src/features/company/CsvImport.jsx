import React, { useState } from 'react';
import {
  csvFields,
  parseCsv,
  suggestMapping,
  prepareCsvImport,
  applyCsvImport,
  downloadCsvTemplate,
} from '../../lib/company-csv.js';
export default function CsvImport({ company, section, onApply, onCancel }) {
  const [text, setText] = useState(''),
    [fileName, setFileName] = useState(''),
    [delimiter, setDelimiter] = useState(','),
    [parsed, setParsed] = useState(null),
    [mapping, setMapping] = useState({}),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(''),
    [reading, setReading] = useState(false);
  function displayValue(record, field) {
    if (field.key === 'outstandingAmount')
      return record.outstandingAmountMinor === undefined
        ? 'Not set'
        : `${company.currency} ${(record.outstandingAmountMinor / 100).toLocaleString()}`;
    if (field.key === 'arr')
      return `${company.currency} ${(record.arrMinor / 100).toLocaleString()}`;
    const value = record[field.key];
    if (field.relation) {
      const ids = field.multiple ? value || [] : [value];
      return (
        ids.map((id) => company[field.relation].find((r) => r.id === id)?.name || id).join(', ') ||
        'None'
      );
    }
    return value === undefined || value === '' ? 'Not set' : String(value);
  }
  function parse(value, separator) {
    setParsed(null);
    setPreview(null);
    setError('');
    try {
      const result = parseCsv(value, separator);
      setParsed(result);
      setMapping(suggestMapping(section, result.headers));
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <section className="csv-import">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SPREADSHEET → COMPANY GRAPH</p>
          <h4>Import {section} from CSV</h4>
        </div>
        <button className="quiet-button" onClick={onCancel}>
          Close import
        </button>
      </div>
      <p className="muted">
        Upload → match columns → preview → add to draft. Nothing is saved until you review the
        company observation.
      </p>
      <div className="csv-file-controls">
        <label>
          CSV file
          <input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            disabled={reading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setReading(true);
              setParsed(null);
              setPreview(null);
              setText('');
              setError('');
              try {
                if (file.size > 900000) throw new Error('Use a file smaller than 900 KB.');
                const value = await file.text();
                setText(value);
                setFileName(file.name);
                const separator = file.name.toLowerCase().endsWith('.tsv') ? '\t' : delimiter;
                setDelimiter(separator);
                parse(value, separator);
              } catch (e) {
                setError(e.message);
              } finally {
                setReading(false);
              }
            }}
          />
        </label>
        <label>
          Separator
          <select
            value={delimiter}
            disabled={reading}
            onChange={(e) => {
              setDelimiter(e.target.value);
              if (text) parse(text, e.target.value);
            }}
          >
            <option value=",">Comma</option>
            <option value=";">Semicolon</option>
            <option value={'\t'}>Tab</option>
          </select>
        </label>
        <button className="quiet-button" onClick={() => downloadCsvTemplate(section)}>
          Download template
        </button>
      </div>
      {reading && <p role="status">Reading file…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {parsed && (
        <>
          <p className="muted">
            {fileName} · {parsed.rows.length} records · {parsed.headers.length} columns
          </p>
          <p>
            Use existing record IDs to update records. Without IDs, rows create new records.
            Relationships accept an existing ID or an exact, unique name; separate multiple names
            with <strong>|</strong>.
          </p>
          {section === 'customers' && (
            <p className="sample-notice">
              ARR is entered in {company.currency}, in ordinary currency amounts such as 12500.50.
              Use dates formatted YYYY-MM-DD.
            </p>
          )}
          <div className="csv-mapping">
            {csvFields(section).map((field) => (
              <label key={field.key}>
                {field.label}
                {field.required ? ' *' : ''}
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => {
                    setMapping({ ...mapping, [field.key]: e.target.value });
                    setPreview(null);
                  }}
                >
                  <option value="">
                    {field.key === 'id' ? 'Generate IDs for new records' : 'Not mapped'}
                  </option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="muted">
            Required fields must be supplied for new records. Unmapped fields keep their existing
            values on updates. Mapped empty optional fields clear the value. Features and owners
            must already exist in your draft.
          </p>
          <button onClick={() => setPreview(prepareCsvImport(company, section, parsed, mapping))}>
            Preview import →
          </button>
          {preview && (
            <div className="csv-preview">
              <h4>
                {preview.changes.filter((c) => c.operation === 'Add').length} additions ·{' '}
                {preview.changes.filter((c) => c.operation === 'Update').length} updates
              </h4>
              {preview.errors.length > 0 && (
                <div role="alert" className="csv-errors">
                  <strong>Resolve {preview.errors.length} issues before importing</strong>
                  <ul>
                    {preview.errors.slice(0, 30).map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                  {preview.errors.length > 30 && <p>Showing the first 30 issues.</p>}
                </div>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Change</th>
                      <th>Name</th>
                      <th>Record ID</th>
                      <th>Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.changes.slice(0, 50).map((c) => (
                      <tr key={c.record.id}>
                        <td>{c.row}</td>
                        <td>{c.operation}</td>
                        <td>{c.record.name}</td>
                        <td>{c.record.id}</td>
                        <td>
                          <details>
                            <summary>Review values</summary>
                            <dl>
                              {csvFields(section)
                                .filter((f) => f.key !== 'id')
                                .map((f) => (
                                  <React.Fragment key={f.key}>
                                    <dt>{f.label}</dt>
                                    <dd>{displayValue(c.record, f)}</dd>
                                  </React.Fragment>
                                ))}
                            </dl>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                Preview shows the first 50 valid records. All {preview.changes.length} valid records
                will be added to the draft together. No records are deleted.
              </p>
              <button
                disabled={!!preview.errors.length || !preview.changes.length}
                onClick={() => onApply(applyCsvImport(company, section, preview))}
              >
                Add {preview.changes.length} records to draft
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
