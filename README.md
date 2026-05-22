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

Reviewer service entries are stored in `_data/service.yml` and rendered automatically on the homepage. Journal entries display paper counts without years. Conference entries are sorted in reverse chronological order by `sort_key`.

The left navigation is defined in `_layouts/default.html`. Add a new Markdown page first, then add its link to the navigation.

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
