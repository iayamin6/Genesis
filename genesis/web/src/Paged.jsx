import React, { useState } from 'react';
export default function Paged({ items, children, size = 3, resetKey = '', as: Container = 'div', className = 'paged-content' }) {
  const [selection, setSelection] = useState({ key: resetKey, page: 0 });
  const page = Math.min(selection.key === resetKey ? selection.page : 0, Math.max(0, Math.ceil(items.length / size) - 1));
  const move = next => setSelection({ key: resetKey, page: next });
  return <><Container className={className}>{items.slice(page * size, (page + 1) * size).map(children)}</Container>{items.length > size && <nav className="pagination" aria-label="Record pages"><span>{page * size + 1}–{Math.min((page + 1) * size, items.length)} of {items.length}</span><div><button className="quiet-button" disabled={page === 0} onClick={() => move(page - 1)}>← Previous</button><button className="quiet-button" disabled={(page + 1) * size >= items.length} onClick={() => move(page + 1)}>Next →</button></div></nav>}</>;
}
