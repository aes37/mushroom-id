import { useEffect } from 'react'

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="lightbox" role="dialog" aria-label="Enlarged photo" onClick={onClose}>
      <img src={src} alt={alt} />
      <button className="lightbox-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
    </div>
  )
}
