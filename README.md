# Free DIY Repair Directory

A single-file, offline static directory of **official, genuinely free DIY-repair help**:
manufacturer manual archives, appliance part diagrams, auto-repair library options,
phone and laptop fix-it guides, sewing and mending basics, and clear boundaries for
**when repair gets scary** and a licensed pro should take over.

Every card states:

- **What it covers**
- **Official source** — a link straight to the organization's own website
- **Proof it is free** — the concrete reason to trust there is no hidden paywall
- **Beginner verdict** — Start here / Easy with a little care / Take it slow / Pro territory
- **Recheck schedule** — `source_checked_date` and `recheck_date` per card

There are **no affiliate links** anywhere in the project, and there never will be.
All links resolve to official or authoritative hosts (manufacturer sites, extension
universities, federal agencies, the official parts-resource sites themselves).

Built and maintained by [Asdale Dynamics, LLC](https://dylanasdale.github.io/).

## Run it

Open `index.html` in any browser. No server, no build step, no network needed —
the page is a **single offline HTML file** with the dataset embedded inside it.
(`python3 -m http.server` works too if you prefer serving it.)

## Rebuild (after editing data)

```sh
node build.js          # regenerate index.html from data + template
node build.js --check  # exit 1 if index.html is stale vs data
```

## Tests

```sh
node --test tests/
```

- **Schema tests** (`tests/schema.test.js`) validate `data/repair-directory.json`
  against `schema/repair-directory.schema.json` using a dependency-free validator,
  and enforce directory promises per card (https official links, stated proof of
  free, future recheck dates, no affiliate/tracking URL patterns).
- **Render tests** (`tests/render.test.js`) extract the embedded JSON from
  `index.html` (must match the data file exactly), run the page's render helpers
  in a sandbox (no `document`), and check filtering, card rendering, escaping,
  and allowed filter chips.

## Maintenance

1. Verify a resource is still free at its official URL (the card states what to look for).
2. Update the card, set `source_checked_date` to today and `recheck_date` within 1–12 months.
3. Bump `last_rechecked` at the top of the data file.
4. `node build.js && node --test tests/`
5. Commit with a plain message. Never push or publish from this folder without an explicit ask.

To add a card: copy an existing object in `data/repair-directory.json`, fill in all
required fields (`id`, `title`, `category`, `kind`, `covers`, `official_source`,
`free_proof`, `beginner_verdict`, `recheck_date`, `source_checked_date`; `extras`
is optional), then build and test. The schema test will catch missing or malformed fields.

Categories (filters on the page): `appliance`, `tech`, `auto`, `home`, `safety`.

## Design decisions

- **JSON-driven, offline single file**: `data/repair-directory.json` is the source of
  truth; `build.js` embeds it into `index.html` so the shipped page works via `file://`
  with no fetch and no CDN — everything available offline.
- **Distinct from `free-everyday-software-directory`**: that sibling project catalogs
  free *software*; this one catalogs free *repair knowledge* (manuals, diagrams,
  guides, recalls). Data files, schemas, and builds are entirely separate.
- **No dependencies**: build and tests use Node's standard library only.

## License

MIT — see `LICENSE`. Copyright (c) 2026 Asdale Dynamics, LLC.
