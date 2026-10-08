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
| "Browse our lists" chips | `_data/lists.yml` |
| "Made in Ketchikan" cards | `_data/local_books.yml` |
| About text and new-owner welcome | `_data/about.yml` |
| Page layout | `index.html`, `_includes/` |
| Colors, fonts, map styles | `assets/css/main.css` |
| Hours logic, map animation | `assets/js/main.js` |
| Walking map drawing (SVG) | `_includes/walkmap-svg.html` |

The page picks summer or winter hours by date in Alaska time, highlights today, and shows an open or closed book. Empty values (`email`, `welcome`, book `blurb`) are hidden automatically.

## Preview locally

```
bundle install
bundle exec jekyll serve
```
Then open http://127.0.0.1:4000/ (only visible on your own computer).

## Launch checklist (around January 1, 2027)

1. Fill in `email` in `_data/site.yml`, the new-owner welcome in `_data/about.yml`, the book blurbs, and the holiday dates in `_data/hours.yml`.
2. Replace the placeholder photos in `assets/images/` with real ones.
3. Create the GitHub repo and push. Decide public or private (Pages works either way on a paid plan; free plans need a public repo).
4. In `_config.yml` set `launched: true`.
5. GitHub repo, Settings, Pages: deploy from branch `main`, folder `/ (root)`. Set the custom domain to `parnassusak.com`.
6. At the registrar (name.com) DNS:
   - Four `A` records for `@`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - Optional `AAAA` records for `@`: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
   - `CNAME` for `www` pointing to `<github-user>.github.io`
   - Add the TXT record GitHub shows when you verify the domain (prevents takeover of the domain).
7. When DNS has propagated, tick **Enforce HTTPS** in Pages settings.
8. Update the website link on the Google Business Profile, Bookshop.org profile, Facebook, Instagram, Alaska.org and PNBA listings.

## Credits

Map data © OpenStreetMap contributors (the credit link on the map must stay).
Fonts: Nunito Sans and Young Serif (SIL Open Font License), self-hosted.
