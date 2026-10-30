import { photoUrl, photosFor } from '../data/photos'
import { SPECIES_BY_ID } from '../data/species'
import type { Side } from '../game/generate'
import { Badge } from './Badge'
import { Credit } from './Credit'

export type CardState = 'idle' | 'correct' | 'wrong' | 'neutral'

interface Props {
  side: Side
  letter: 'A' | 'B'
  revealed: boolean
  state: CardState
  pickedByYou: boolean
  onPick: () => void
  onZoom: (src: string, alt: string) => void
}

export function PhotoCard({ side, letter, revealed, state, pickedByYou, onPick, onZoom }: Props) {
  const species = SPECIES_BY_ID[side.species]
  const photo = photosFor(side.species)[side.photo]
  const src = photoUrl(photo)
  const alt = revealed ? `${species.common} (${species.scientific})` : `Mushroom photo ${letter}`
  return (
    <div className={`card card-${state}${revealed ? ' revealed' : ''}`}>
      <button
        type="button"
        className="card-pick"
        onClick={onPick}
        disabled={revealed}
        aria-label={revealed ? alt : `Choose photo ${letter}`}
      >
        <img src={src} alt={alt} width={photo.w} height={photo.h} loading="eager" decoding="async" />
        <span className="card-letter">{letter}</span>
      </button>
      <button
        type="button"
        className="card-zoom"
        aria-label={`Enlarge photo ${letter}`}
        onClick={(e) => {
          e.stopPropagation()
          onZoom(src, alt)
        }}
      >
        ⤢
      </button>
      {revealed && (
        <div className="card-caption">
          <div className="card-names">
            <strong>{species.common}</strong> <em>{species.scientific}</em>
          </div>
          <div className="card-meta">
            <Badge edibility={species.edibility} />
            {state === 'correct' && <span className="pill pill-ok">{pickedByYou ? 'You chose this. Correct!' : 'This was the answer'}</span>}
            {state === 'wrong' && <span className="pill pill-bad">You chose this</span>}
          </div>
          <Credit photo={photo} />
        </div>
      )}
    </div>
  )
}
