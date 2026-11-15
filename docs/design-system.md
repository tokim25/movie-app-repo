# Family Feature design system

Family Feature uses one light theme. The interface stays white even when the
device prefers dark mode, and primary text is always near-black. Inter is the
only product typeface; hierarchy comes from size, weight, spacing, and case.

## Color tokens

| Role | Token | Value |
| --- | --- | --- |
| Canvas and cards | `--bg`, `--surface` | `#FFFFFF` |
| Subtle sections | `--bg-sub` | `#F7F7F7` |
| Primary text | `--ink` | `#111111` |
| Secondary text | `--ink-soft` | `#5F5F5F` |
| Borders | `--line` | `#DDDDDD` |
| Brand and selected state | `--accent` | `#C9184A` |
| Accessible accent text | `--accent-text` | `#B30E3F` |
| Informational category icons | `--flag-*` | `#6554C0` |
| Success | `--success` | `#13795B` |
| Error | `--error` | `#B42318` |
| Warning | `--warning` | `#8A5A00` |

Use coral only for brand emphasis, links, favorites, and selected controls.
Use purple only for non-severity content-category icons. Reserve green, red,
and amber for semantic feedback. Do not add per-list theme colors or automatic
dark-mode overrides.

## Type and shape

- Use Inter at weights 400, 500, 600, 700, and 800.
- Keep body copy at 16px where space permits and never below 12px for metadata.
- Use weight and spacing before introducing another color.
- Prefer white cards, restrained gray borders, soft shadows, and rounded
  controls. Interactive targets remain at least 44px tall.
