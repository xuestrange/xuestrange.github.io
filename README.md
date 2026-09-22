# xuestrange.github.io

Personal Website.

## Edit Content

Most homepage updates should happen in `index.md`. The Links page can be edited in `links.md`. Use Markdown headings and lists instead of writing HTML:

```md
## Teaching

- Course name, semester

## Publications

- Paper title, journal, year
```

Use two spaces at the end of a line when you want a line break inside the contact block.

Publication entries are stored in `_data/publications.yml` and rendered automatically on the homepage in reverse chronological order by `sort_key`.

Reviewer service entries are stored in `_data/service.yml` and rendered automatically on the homepage. Journal entries display paper counts without years. Conference entries are sorted in reverse chronological order by `sort_key`.

The left navigation is defined in `_layouts/default.html`. Add a new Markdown page first, then add its link to the navigation.

### Conference reminders

The Links page (`links.md`) embeds a compact conference table from `_data/conferences.yml` through `_includes/conferences.html`. Keep one entry per conference series: its next announced meeting, or its latest verified past edition when a future meeting has not been confirmed. There is no separate Conferences page.

Verify dates and locations on official conference, association, or host-university websites before editing. Update `checked_on` after reviewing the complete list. Quote ISO dates (`YYYY-MM-DD`) so they stay strings in YAML. The table has three columns: Conference, Date, and City & country. Each conference name appears as `ABBR — Full name` and links directly to its official website; dates include the year, and the City & country column combines `city` and `country`. Other data fields retain source context; use `note` and `additional_source` to explain date differences or event naming. Dates are meeting dates, not paper deadlines.

The compact timeline above the table shows past and upcoming meetings in date order, with clickable entries that jump to their table rows. Upcoming rows are bold and past rows are dimmed but remain legible. Meeting status is calculated by `_includes/conference-status.html` using the site build date, which appears as the timeline's as-of date; `checked_on` records the separate date when official sources were last verified. Meetings remain ongoing through their end date, inclusive. Use `null` for both dates when an edition has been announced without exact dates; editions missing either date are shown separately as pending, without inventing a position on the timeline. This is a manually maintained snapshot: statuses refresh when the site is rebuilt, and the website does not automatically fetch new announcements or send notifications.

## Local Preview

Start the local preview server:

```bash
cd /Users/xue/Documents/xuestrange.github.io
jekyll serve --host 127.0.0.1 --port 4000
```

Then open http://127.0.0.1:4000/. Jekyll writes the compiled site to `_site/`; do not edit or commit files in `_site/`.

If port 4000 is busy, use another port:

```bash
jekyll serve --host 127.0.0.1 --port 4001
```

If `jekyll` is not found in a new terminal, run `source ~/.zshrc` once and try again.

## Build

Compile the static site without starting a server:

```bash
cd /Users/xue/Documents/xuestrange.github.io
jekyll build
```

## Publish Changes

Check changed files:

```bash
git status
```

Stage and commit your edits:

```bash
git add -A
git commit -m "Update homepage"
```

Push to GitHub Pages:

```bash
git push
```
