import os
import json
import xml.etree.ElementTree as ET
from datetime import datetime

DOMAIN = 'https://aipetros.xyz'

def generate_sitemap():
    streams_path = 'data/streams.json'
    movies = []
    if os.path.exists(streams_path):
        try:
            with open(streams_path, 'r', encoding='utf-8') as f:
                d = json.load(f)
                movies = d.get('streams', [])
        except Exception as e:
            print(f"Error loading streams: {e}")
            
    now = datetime.now().strftime('%Y-%m-%d')
    
    urlset = ET.Element('urlset', xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    
    # 1. Main Landing Page
    url_root = ET.SubElement(urlset, 'url')
    ET.SubElement(url_root, 'loc').text = DOMAIN
    ET.SubElement(url_root, 'lastmod').text = now
    ET.SubElement(url_root, 'changefreq').text = 'daily'
    ET.SubElement(url_root, 'priority').text = '1.0'

    # 2. VIP Cinema App Hall
    url_app = ET.SubElement(urlset, 'url')
    ET.SubElement(url_app, 'loc').text = f"{DOMAIN}/app.html"
    ET.SubElement(url_app, 'lastmod').text = now
    ET.SubElement(url_app, 'changefreq').text = 'daily'
    ET.SubElement(url_app, 'priority').text = '0.95'

    # 3. All individual movie pages
    for m in movies:
        mid = m.get('id')
        if not mid:
            continue
        url_m = ET.SubElement(urlset, 'url')
        ET.SubElement(url_m, 'loc').text = f"{DOMAIN}/app.html#watch={mid}"
        ET.SubElement(url_m, 'lastmod').text = now
        ET.SubElement(url_m, 'changefreq').text = 'weekly'
        ET.SubElement(url_m, 'priority').text = '0.85'

    tree = ET.ElementTree(urlset)
    ET.indent(tree, space="  ", level=0)
    
    # Save to public and root
    tree.write('public/sitemap.xml', encoding='utf-8', xml_declaration=True)
    tree.write('sitemap.xml', encoding='utf-8', xml_declaration=True)
    print(f"✅ Sitemap generated with {len(movies) + 2} URLs targeting {DOMAIN}")

if __name__ == '__main__':
    generate_sitemap()
