
export default function PageManager({
  pages = [],
  selectedId,
  onSelect,
  onDelete,
  onReorder,
}) {
  function movePage(index, direction) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= pages.length) return;

    const next = [...pages];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onReorder(next);
  }

  return (
    <section className="page-manager">
      <h2>Sayfalar ({pages.length})</h2>

      {pages.length === 0 ? (
        <p>Henüz belge eklenmedi.</p>
      ) : (
        <div className="page-list">
          {pages.map((page, index) => (
            <div
              key={page.id}
              className={`page-item ${
                selectedId === page.id ? "selected" : ""
              }`}
            >
              <button
                type="button"
                className="page-select"
                onClick={() => onSelect(page.id)}
              >
                <img
                  className="page-thumbnail"
                  src={page.canvas.toDataURL("image/jpeg", 0.7)}
                  alt=""
                />
                <span className="page-name">
                  {index + 1}. {page.name || "Belge"}
                </span>
              </button>

              <div className="page-actions">
                <button
                  type="button"
                  title="Yukarı taşı"
                  aria-label="Yukarı taşı"
                  disabled={index === 0}
                  onClick={() => movePage(index, -1)}
                >
                  ↑
                </button>

                <button
                  type="button"
                  title="Aşağı taşı"
                  aria-label="Aşağı taşı"
                  disabled={index === pages.length - 1}
                  onClick={() => movePage(index, 1)}
                >
                  ↓
                </button>

                <button
                  type="button"
                  className="delete-button"
                  title="Sayfayı sil"
                  aria-label="Sayfayı sil"
                  onClick={() => onDelete(page.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
