import { EDIBILITY_LABEL, type Edibility } from '../data/species'

export function Badge({ edibility }: { edibility: Edibility }) {
  return <span className={`badge badge-${edibility}`}>{EDIBILITY_LABEL[edibility]}</span>
}
