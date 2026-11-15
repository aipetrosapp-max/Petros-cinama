with open('download_landing.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()[:576]
content = ''.join(lines)

# Point Launch Cinema & Bottom Navigation links to ./app.html
content = content.replace('href="https://aipetrosapp-max.github.io/Petros-cinama/"', 'href="./app.html"')
content = content.replace('href="#universe"', 'href="./app.html#universe"')
content = content.replace('href="#discover"', 'href="./app.html#discover"')
content = content.replace('href="#search"', 'href="./app.html#search"')
content = content.replace('href="#library"', 'href="./app.html#library"')
content = content.replace('href="#settings"', 'href="./app.html#settings"')

# Add direct download handler
dl_script = """
    function triggerClientDownload() {
      const dlBtn = document.getElementById('download-btn');
      const original = dlBtn.textContent;
      dlBtn.textContent = 'DOWNLOADING...';

      if (selectedPlatform.includes('Android Mobile') || selectedPlatform.includes('Native 4K APK')) {
        window.open('https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/petros-cinema.apk', '_blank');
      } else if (selectedPlatform.includes('Windows')) {
        window.open('https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/PetrosCinema-Setup.exe', '_blank');
      } else if (selectedPlatform.includes('TV')) {
        window.open('https://github.com/aipetrosapp-max/Petros-cinama/releases/latest/download/petros-tv-release.apk', '_blank');
      } else {
        window.location.href = './app.html';
      }

      setTimeout(() => { dlBtn.textContent = original; }, 2200);
    }
"""

content = content.replace('function triggerClientDownload() {', 'function _unused_old_dl() {')
content = content.replace('// Device Selection Interaction', dl_script + '\n    // Device Selection Interaction')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Successfully generated index.html from download_landing.html')
