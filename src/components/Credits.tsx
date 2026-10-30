import { LICENSE_INFO, PHOTOS, observationUrl, photoPageUrl, photoUrl } from '../data/photos'
import { SPECIES } from '../data/species'

export function Credits() {
  const count = Object.values(PHOTOS).reduce((n, list) => n + list.length, 0)
  return (
    <section className="credits">
      <h2>Photo credits</h2>
      <p>
        All {count} photographs come from research-grade observations on{' '}
        <a href="https://www.inaturalist.org" target="_blank" rel="noopener noreferrer">
          iNaturalist
        </a>
        , where their photographers released them under Creative Commons licences (CC0, CC BY or CC BY-SA). They have been resized for this
        game. Each photo links to its observation page, where you can see the identification history and the licence as recorded by
        iNaturalist. Thank you to every photographer.
      </p>
      {SPECIES.map((s) => {
        const list = PHOTOS[s.id] ?? []
        if (list.length === 0) return null
        return (
          <div key={s.id} className="credit-species">
            <h3>
              {s.common} <em>{s.scientific}</em>
            </h3>
            <ul className="credit-list">
              {list.map((p) => (
                <li key={p.photoId}>
                  <a href={observationUrl(p)} target="_blank" rel="noopener noreferrer">
                    <img src={photoUrl(p)} alt={`${s.common} by ${p.by}`} loading="lazy" />
                  </a>
                  <div>
                    <a href={photoPageUrl(p)} target="_blank" rel="noopener noreferrer">
                      {p.license === 'cc0' ? '' : '© '}
                      {p.by}
                    </a>
                    <br />
                    <a href={LICENSE_INFO[p.license].url} target="_blank" rel="noopener noreferrer">
                      {LICENSE_INFO[p.license].label}
                    </a>
                    {p.observedOn && <span className="muted"> · {p.observedOn}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
