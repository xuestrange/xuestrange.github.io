# Repository Guidelines

## Project Overview

This is a small Jekyll site for a personal academic homepage. GitHub Pages builds Markdown pages into static HTML using `_config.yml`, `_layouts/default.html`, and `style.css`.

## Repository Structure

- `index.md` is the homepage content.
- `links.md` is the links page content.
- `_data/service.yml` stores service entries rendered on the homepage.
- `_includes/service.html` renders the homepage Service section from the data file.
- `_layouts/default.html` defines the shared page shell, navigation, and footer.
- `style.css` contains all site styling.
- `_config.yml` contains the Jekyll site metadata.
- `_site/` is generated build output. Do not edit or commit files from `_site/`.

## Content Editing

- Prefer editing Markdown pages for content changes.
- Use Markdown headings, paragraphs, and lists instead of inline HTML unless the layout cannot be expressed cleanly in Markdown.
- Preserve YAML front matter at the top of Markdown pages.
- Use two trailing spaces when a hard line break is needed inside the contact block.
- Edit `_data/service.yml` for reviewer service updates. Journal entries display counts without years; conference entries use `sort_key` for reverse chronological ordering.
- When adding a new page, create the Markdown file first, then add the navigation link in `_layouts/default.html`.

## Style Guidelines

- Keep the site minimal, fast, and static.
- Do not add client-side JavaScript unless explicitly requested.
- Keep CSS changes scoped and consistent with the existing academic homepage style.
- Maintain responsive behavior for both desktop and narrow mobile screens.
- Prefer readable semantic HTML in layouts.

## Local Development

Run the local preview server from the repository root:

```bash
jekyll serve --host 127.0.0.1 --port 4000
```

Then open `http://127.0.0.1:4000/`.

If port 4000 is busy, use another port such as 4001:

```bash
jekyll serve --host 127.0.0.1 --port 4001
```

If `jekyll` is not found in a new terminal, run:

```bash
source ~/.zshrc
```

Then retry the Jekyll command.

## Build Check

Before finishing changes that affect site output, run:

```bash
jekyll build
```

The build writes compiled files to `_site/`. Treat `_site/` as generated output.

## Git Hygiene

- Check `git status` before and after edits.
- Do not remove or revert user changes unless explicitly asked.
- Ignore incidental local files such as `.DS_Store`.
- Keep commits focused on the requested change.
