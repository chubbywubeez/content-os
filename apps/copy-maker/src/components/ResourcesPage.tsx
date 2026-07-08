import { useEffect, useMemo, useState } from 'react'
import { RESOURCES_CATALOG, type ResourceEntry } from '../data/resourcesCatalog'
import { fetchLeadMagnetResourceEntries } from '../services/leadMagnetPipelineClient'

/**
 * Resources screen for viewing canonical HTML references
 * and downloading parallel markdown/json versions.
 */
export function ResourcesPage() {
  const [generated, setGenerated] = useState<ResourceEntry[]>([])
  const [activeId, setActiveId] = useState(RESOURCES_CATALOG[0]?.id ?? '')
  const catalog = useMemo(() => [...RESOURCES_CATALOG, ...generated], [generated])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchLeadMagnetResourceEntries()
      if (cancelled) return
      setGenerated(rows)
      if (!activeId && rows[0]?.id) setActiveId(rows[0].id)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeResource = useMemo(
    () => catalog.find((item) => item.id === activeId) ?? catalog[0],
    [catalog, activeId],
  )

  if (!activeResource) {
    return (
      <section className="cm-resources-page">
        <p className="cm-muted">No resources configured yet.</p>
      </section>
    )
  }

  return (
    <section className="cm-resources-page">
      <header className="cm-interviews-page__head">
        <div>
          <p className="cm-interviews-page__eyebrow">Reference Library</p>
          <h1 className="cm-interviews-page__title">Resources</h1>
          <p className="cm-interviews-page__sub">
            HTML source docs with downloadable markdown and JSON versions.
          </p>
        </div>
      </header>

      <div className="cm-resources-layout">
        <aside className="cm-resources-list" aria-label="Resource list">
          {catalog.map((resource) => {
            const isActive = resource.id === activeResource.id
            return (
              <button
                key={resource.id}
                type="button"
                className={`cm-resources-list__item ${isActive ? 'cm-resources-list__item--active' : ''}`}
                onClick={() => setActiveId(resource.id)}
              >
                <span className="cm-resources-list__title">{resource.title}</span>
                <span className="cm-resources-list__desc">{resource.description}</span>
              </button>
            )
          })}
        </aside>

        <article className="cm-resources-panel">
          <div className="cm-resources-panel__head">
            <div>
              <h2 className="cm-resources-panel__title">{activeResource.title}</h2>
              <p className="cm-resources-panel__desc">{activeResource.description}</p>
            </div>
            <div className="cm-inline-actions">
              <a className="cm-btn" href={activeResource.htmlPath} target="_blank" rel="noreferrer">
                Open HTML
              </a>
              {activeResource.pdfPath ? (
                <a className="cm-btn" href={activeResource.pdfPath} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              ) : null}
              <a className="cm-btn" href={activeResource.mdPath} download>
                Download .md
              </a>
              <a className="cm-btn" href={activeResource.jsonPath} download>
                Download .json
              </a>
            </div>
          </div>

          <iframe
            key={activeResource.id}
            title={activeResource.title}
            src={activeResource.htmlPath}
            className="cm-resources-panel__frame"
          />
        </article>
      </div>
    </section>
  )
}
