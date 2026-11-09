"""
Fabrique public/sitemap.xml à partir des vrais produits et rayons du site (lecture publique de Firestore).

À relancer après avoir ajouté ou retiré des produits :
    python -X utf8 tools/sitemap.py
puis publier le site.
"""
import json
import sys
import urllib.request
from datetime import date
from pathlib import Path
from xml.dom import minidom
from xml.sax.saxutils import escape

SITE = 'https://boucherie-hallem.web.app'
API = 'https://firestore.googleapis.com/v1/projects/boucherie-bcf8f/databases/(default)/documents'
OUT = Path(__file__).resolve().parent.parent / 'public' / 'sitemap.xml'

# Pages publiques : celles du compte client (favoris, suivi, commande) restent hors du sitemap
PAGES = [
    ('/', 'daily', '1.0'),
    ('/boutique', 'daily', '0.9'),
    ('/mon-menu', 'weekly', '0.7'),
    ('/recettes', 'weekly', '0.7'),
    ('/notre-boucherie', 'monthly', '0.6'),
    ('/fidelite', 'monthly', '0.4'),
]


def get(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def value(v):
    """Valeur Firestore REST → valeur Python"""
    for k, x in v.items():
        if k == 'mapValue':
            return {kk: value(vv) for kk, vv in x.get('fields', {}).items()}
        if k == 'arrayValue':
            return [value(i) for i in x.get('values', [])]
        if k == 'integerValue':
            return int(x)
        return x


def products():
    fields = '&'.join(f'mask.fieldPaths={f}' for f in ('available', 'name_fr', 'image', 'category'))
    out, token = [], ''
    while True:
        page = get(f'{API}/products?pageSize=300&{fields}' + (f'&pageToken={token}' if token else ''))
        for doc in page.get('documents', []):
            item = {k: value(v) for k, v in doc.get('fields', {}).items()}
            item['id'] = doc['name'].rsplit('/', 1)[-1]
            out.append(item)
        token = page.get('nextPageToken')
        if not token:
            return out


def categories():
    doc = get(f'{API}/settings/categories')
    return value(doc['fields']['list']) if 'fields' in doc else []


def url(loc, freq, prio, today, image=None, title=None):
    lines = [
        '  <url>',
        f'    <loc>{escape(loc)}</loc>',
        f'    <lastmod>{today}</lastmod>',
        f'    <changefreq>{freq}</changefreq>',
        f'    <priority>{prio}</priority>',
    ]
    if image:
        lines += [
            '    <image:image>',
            f'      <image:loc>{escape(image)}</image:loc>',
            *( [f'      <image:title>{escape(title)}</image:title>'] if title else [] ),
            '    </image:image>',
        ]
    lines.append('  </url>')
    return '\n'.join(lines)


def main():
    today = date.today().isoformat()
    prods = [p for p in products() if p.get('available', True)]
    cats = sorted(categories(), key=lambda c: c.get('order', 0))
    used = {p.get('category') for p in prods}
    body = [url(SITE + path, f, pr, today) for path, f, pr in PAGES]
    body += [url(f"{SITE}/boutique?cat={c['id']}", 'weekly', '0.8', today) for c in cats if c['id'] in used]
    for p in sorted(prods, key=lambda p: p['id']):
        img = p.get('image') or ''
        body.append(url(f"{SITE}/produit/{p['id']}", 'weekly', '0.7', today,
                        img if img.startswith('http') else None, p.get('name_fr')))
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
           '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
           + '\n'.join(body) + '\n</urlset>\n')
    minidom.parseString(xml.encode('utf-8'))  # refuse d'écrire un XML invalide
    OUT.write_text(xml, encoding='utf-8', newline='\n')
    print(f'{len(body)} adresses : {len(PAGES)} pages, {sum(1 for c in cats if c["id"] in used)} rayons, {len(prods)} produits → {OUT}')


if __name__ == '__main__':
    sys.exit(main())
