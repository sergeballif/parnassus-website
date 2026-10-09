# Parnassus Books and Gifts — website

Jekyll site for Parnassus Books and Gifts, 105 Stedman St, Ketchikan, AK 99901.
Planned domain: **parnassusak.com** (backup: parnassusketchikan.com).

## STATUS: PRIVATE. Not published, not indexed.

Until the January 1, 2027 takeover:
- `launched: false` in `_config.yml` adds `noindex, nofollow` to every page and makes `robots.txt` disallow everything. This is only a backup.
- GitHub Pages stays **off** and DNS stays **untouched**. Pages sites are public even from private repos.
- Never link to ketchikanbooks.com (owned by someone else) or libro.fm/parnassusbooks (the Nashville store).

## Where to edit things

| What | File |
|---|---|
| Hours (summer/winter, holidays) | `_data/hours.yml` |
| Phone, address, email, social/shop links, footer note | `_data/site.yml` |
| Staff picks (top 3 rows of the Google Sheet) | `_data/staff_picks.json` (written by the hourly GitHub Action, see below) |
| "Made in Ketchikan" cards | `_data/local_books.yml` |
| About text and new-owner welcome | `_data/about.yml` |
| Page layout | `index.html`, `_includes/` |
| Colors (one block of variables at the top), fonts, map styles | `assets/css/main.css` |
| Hours logic, map animation | `assets/js/main.js` |
| Walking map drawing (SVG) | `_includes/walkmap-svg.html` |

The page picks summer or winter hours by date in Alaska time, highlights today, and shows an open or closed book. Empty values (`email`, `welcome`, book `blurb`) are hidden automatically.

## Changing the color scheme

Every color is a variable in the `:root` block at the top of `assets/css/main.css` (names describe the role, e.g. `--c-primary`, `--c-accent`, `--c-dark`). Change the values there and the whole site, including the map and the open/closed book, follows. Two items sit outside the CSS and need the same edit by hand: `assets/images/favicon.svg` and the `theme-color` tag in `_layouts/default.html`.

## Staff picks (Google Sheet)

Staff edit one Google Sheet; the site shows the **top 3 rows under the header**. To feature a new book, insert a row at the top.

Sheet columns, in any order, header names not case-sensitive (template: `docs/staff-picks-template.csv`):

| Column | Notes |
|---|---|
| First name | Shows as "Serge's Pick". Leave blank for "Staff Pick". |
| Title | Required. Rows without a title are skipped. |
| Author | |
| ISBN | ISBN-10 or 13, hyphens fine. The cover is found from this automatically. |
| Blurb | Cut to 280 characters. |
| Image URL (optional) | Only if no cover is found. Must start with https:// |

One-time setup:
1. In the sheet: File, Share, Publish to web, choose the picks tab and **CSV**, Publish. Copy the link.
2. In the GitHub repo: Settings, Secrets and variables, Actions, **Variables**, New repository variable named `STAFF_PICKS_CSV_URL` with that link.
3. Actions tab, "Update staff picks", Run workflow. After that it runs every hour by itself.

`scripts/update_staff_picks.py` cleans the text (plain text only, length limits, valid ISBNs, https image links), downloads covers into `assets/covers/` and writes `_data/staff_picks.json`. If the sheet can't be read, the run fails and the site keeps the last good picks. Test locally with `python3 scripts/update_staff_picks.py --csv-file docs/staff-picks-template.csv` (this overwrites the placeholder picks; undo with `git checkout _data assets/covers`).

## Preview locally

```
bundle install
bundle exec jekyll serve
```
Then open http://127.0.0.1:4000/ (only visible on your own computer).

## Launch checklist (around January 1, 2027)

1. Fill in `email` in `_data/site.yml`, the new-owner welcome in `_data/about.yml`, the book blurbs, and the holiday dates in `_data/hours.yml`.
2. Set up the staff picks sheet (above) and add the Bookshop.org affiliate ID to `_data/site.yml`.
3. Replace the placeholder photos in `assets/images/` with real ones.
4. Create the GitHub repo and push. Decide public or private (Pages works either way on a paid plan; free plans need a public repo).
5. In `_config.yml` set `launched: true`.
6. GitHub repo, Settings, Pages: deploy from branch `main`, folder `/ (root)`. Set the custom domain to `parnassusak.com`.
7. At the registrar (name.com) DNS:
   - Four `A` records for `@`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - Optional `AAAA` records for `@`: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
   - `CNAME` for `www` pointing to `<github-user>.github.io`
   - Add the TXT record GitHub shows when you verify the domain (prevents takeover of the domain).
8. When DNS has propagated, tick **Enforce HTTPS** in Pages settings.
9. Update the website link on the Google Business Profile, Bookshop.org profile, Facebook, Instagram, Alaska.org and PNBA listings.

## Credits

Map data © OpenStreetMap contributors (the credit link on the map must stay).
Fonts: Nunito Sans and Young Serif (SIL Open Font License), self-hosted.
