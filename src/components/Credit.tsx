import { LICENSE_INFO, observationUrl, photoPageUrl, type Photo } from '../data/photos'

export function Credit({ photo }: { photo: Photo }) {
  const lic = LICENSE_INFO[photo.license]
  return (
    <div className="credit">
      Photo:{' '}
      <a href={photoPageUrl(photo)} target="_blank" rel="noopener noreferrer">
        {photo.license === 'cc0' ? '' : '© '}
        {photo.by}
      </a>{' '}
      ·{' '}
      <a href={lic.url} target="_blank" rel="noopener noreferrer">
        {lic.label}
      </a>{' '}
      ·{' '}
      <a href={observationUrl(photo)} target="_blank" rel="noopener noreferrer">
        iNaturalist observation
      </a>
    </div>
  )
}
