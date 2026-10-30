import { PAIRS } from '../data/pairs'
import { SPECIES } from '../data/species'

export function About() {
  return (
    <section className="about">
      <h2>About</h2>
      <p>
        Mushroom Lookalikes is identification practice, built around the confusions that actually send people to hospital: the Death Cap and
        the Paddy Straw Mushroom, the Funeral Bell and the Velvet Shank, the Jack-o'-Lantern and the Chanterelle, False Parasols and
        Parasols, and dozens more. It currently covers {SPECIES.length} species in {PAIRS.length} pairs, from Europe, North America and
        Australia.
      </p>
      <h3>Why "I don't know" is a button</h3>
      <p>
        Experienced foragers walk past far more mushrooms than they pick. Passing on a pair scores nothing, but it never earns the skull that
        a confident mistake on a deadly pair does. Train the instinct.
      </p>
      <h3>How the daily puzzle works</h3>
      <p>
        The day number seeds a small random generator, so everyone sees the same 20 pairs, the same photos and the same left/right layout.
        Which species you are asked for is random per pair, and each species has several photos, so the same pair can look quite different
        on different days. The puzzle rolls over at midnight in your local time zone.
      </p>
      <h3>Ranks</h3>
      <p>
        Spore, Lost in the Woods, Toadstool Tourist, Curious Beginner, Weekend Forager, Seasoned Forager, Master Forager and, for a perfect
        20, Mycologist.
      </p>
      <h3>Accuracy</h3>
      <p>
        Species notes and field tips were written from standard references (field guides, the Wikipedia species accounts and mycological
        society material). Photos are community-identified iNaturalist observations that reached research grade; a few may still be
        misidentified. If you spot one, note the observation link in the credits and raise it.
      </p>
      <p className="disclaimer">
        <strong>This is a game, not a field guide.</strong> Never eat a wild mushroom on the strength of this app, a photo, or a single
        feature. Identification for the table needs the whole mushroom, a spore print, and ideally someone who has done it before.
      </p>
    </section>
  )
}
