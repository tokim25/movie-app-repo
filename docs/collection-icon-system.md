# Collection icon system

Collection icons are small navigation marks, not flags or cultural summaries. Large collection cards use a poster fan instead, while compact contexts keep icons only as utility cues.

## Poster fan

- Show the first two or three curated movies with available artwork, preserving list order so the fan remains traceable to editorial choices.
- Prefer three posters and place the second in front as the visual lead. When only two have artwork, show an honest centered pair rather than duplicating a poster or inventing a third card.
- Use the fan on passport cards and opened-list covers only. Never shrink it into calendar, teaser or Tonight icon slots.
- Treat the fan as decorative because the adjacent collection title is the accessible label. Poster images use empty alt text.
- Fall back to a quiet year card when artwork is unavailable; a broken poster must never collapse the layout.

## Construction

- Use a bold central silhouette plus one or two supporting details.
- Keep the 32×32 viewBox, 2 px primary stroke and rounded joins.
- Use `currentColor` for structure and `--icon-1`, `--icon-2` and `--icon-3` for accent planes.
- Draw for the 19 px return-calendar use first; added detail must remain optional.
- Build palettes from the shared rose, orange, gold, lime, sage, aqua, blue and violet accents. Reuse colors across audiences; a hue must never stand in for an identity.
- Prefer two or three colored planes per icon. Keep outlines dark so the mark still reads if color perception or display quality is limited.

## Cultural collections

- Build from several stories actually present in the list rather than assigning one ethnic or religious emblem to everyone.
- Show plurality when a label spans many communities. The Asian-family mark uses a four-story mosaic; the Latino-family mark combines a doorway, music and a butterfly drawn from lead films.
- Prefer lived culture, joy, craft, language, family and contemporary life over costume, skin, facial features or sacred objects.
- A religious symbol is appropriate for a religious season, such as the Ramadan lantern, but not as shorthand for every person in a broader identity list.
- Do not use sombreros, chopsticks, slanted eyes, headdresses, skin-tone coding, generic “tribal” patterns or a single national flag for a diaspora.

## Representation collections

- Black joy uses a record and radiating star: creative expression and joy, not struggle as the default story.
- More than one culture at home uses a patchwork house, without assigning either side to a race.
- Families with pride places a rainbow inside a home rather than treating Pride as decoration detached from family life.

## Sports collections

- Show an action, not a static inventory symbol: a swish, a kick, a skate cut, a board meeting a wave.
- Keep people ungendered. The collection name—not hair, clothing or body shape—identifies Girls in the game.

## Accessibility

Icons are decorative and always use `aria-hidden="true"`; the adjacent collection name is the accessible label. Meaning must never depend on accent color alone. Every mark must remain recognizable in grayscale.
