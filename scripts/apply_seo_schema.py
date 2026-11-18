import os
import re

INDEX_PATH = 'index.html'
APP_PATH = 'app.html'

def update_html_seo(path):
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace old domain with new aipetros.xyz
    content = content.replace('https://aipetrosapp-max.github.io/Petros-cinama/', 'https://aipetros.xyz/')
    content = content.replace('aipetrosapp-max.github.io', 'aipetros.xyz')

    # Ensure rich schema markup
    schema_markup = '''
    <!-- Google Search Engine Dominance Schema.org -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "AI Petros Cinema",
      "url": "https://aipetros.xyz",
      "description": "تماشای آنلاین و رایگان برترین فیلم‌های سینمایی جهان با کیفیت 4K HDR، بدون سانسور و با صدای باینورال در AI Petros Cinema.",
      "applicationCategory": "EntertainmentApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }
    </script>
    '''
    if 'Google Search Engine Dominance Schema.org' not in content:
        content = content.replace('</head>', f'{schema_markup}\n  </head>')

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Updated SEO & Schema in {path}")

if __name__ == '__main__':
    update_html_seo(INDEX_PATH)
    update_html_seo(APP_PATH)
