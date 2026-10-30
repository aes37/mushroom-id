import manifest from './photos.json'

export type License = 'cc0' | 'cc-by' | 'cc-by-sa'

export interface Photo {
  /** Path relative to the photos folder, e.g. "amanita-phalloides/123456.jpg". */
  file: string
  w: number
  h: number
  /** iNaturalist photo id. */
  photoId: number
  /** iNaturalist observation uuid. */
  obs: string
  /** Name to credit (observer's display name, or login). */
  by: string
  login: string
  license: License
  observedOn?: string
}

export type PhotoManifest = Record<string, Photo[]>

export const PHOTOS: PhotoManifest = manifest as PhotoManifest

export const LICENSE_INFO: Record<License, { label: string; url: string }> = {
  cc0: { label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  'cc-by': { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-sa': { label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
}

/** Where photos are served from. Override with VITE_PHOTO_BASE to host them elsewhere (a bucket or CDN). */
const PHOTO_BASE: string = (import.meta.env.VITE_PHOTO_BASE as string | undefined) ?? `${import.meta.env.BASE_URL}photos/`

export function photosFor(speciesId: string): Photo[] {
  return PHOTOS[speciesId] ?? []
}

export function photoUrl(p: Photo): string {
  return PHOTO_BASE + p.file
}

export function observationUrl(p: Photo): string {
  return `https://www.inaturalist.org/observations/${p.obs}`
}

export function photoPageUrl(p: Photo): string {
  return `https://www.inaturalist.org/photos/${p.photoId}`
}
