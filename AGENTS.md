# Agent Guidance

## Militia Rules Corpus

The Ironfang militia rules are stored in:

- `docs/ai/ironfang-militia/militia-rules.md`
- `docs/ai/ironfang-militia/militia-tables.md`
- `docs/ai/ironfang-militia/militia-verbatim.md`
- `docs/ai/ironfang-militia/search-tags.md`
- `docs/ai/ironfang-militia/README.md`

## How To Search

Use `rg` first, then open only matching files/sections.

- Find exact action logic:
  - `rg -n "^## Action:|Drill Militia|Reduce Danger|Restore Character" docs/ai/ironfang-militia`
- Find weekly procedure order:
  - `rg -n "Upkeep Phase|Activity Phase|Event Phase|Step 1|Step 2|Step 3|Step 4|Step 5" docs/ai/ironfang-militia`
- Find event behavior and mitigation:
  - `rg -n "^## Event:|Mitigate|persistent|Twice:" docs/ai/ironfang-militia`
- Find numeric thresholds quickly:
  - `rg -n "Table 6-1|Table 6-2|Table 6-3|DC|Minimum Training|Max Actions|Max Teams" docs/ai/ironfang-militia/militia-tables.md`
- Find team trees/upgrades:
  - `rg -n "Team Trees|Upgrades To|Upgrades From|tier" docs/ai/ironfang-militia/militia-rules.md`
- Find exact quoted source wording:
  - `rg -n "exact phrase here" docs/ai/ironfang-militia/militia-verbatim.md`

## Retrieval Preference

1. Use `militia-tables.md` for hard numbers and thresholds.
2. Use `militia-rules.md` for process/order, action semantics, and edge cases.
3. Use `militia-verbatim.md` when exact wording is required.
4. Use `search-tags.md` when query terms are vague or abbreviated.
