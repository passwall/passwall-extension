const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'dist', 'manifest.json');

fs.readFile(manifestPath, 'utf8', (err, data) => {
  if (err) {
    console.error('manifest.json dosyası okunamadı:', err);
    return;
  }

  const manifest = JSON.parse(data);

  // content_security_policy alanını nesneye dönüştür
  manifest.content_security_policy = {
    extension_pages: "script-src 'self'; object-src 'self';"
  };

  fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('manifest.json dosyası yazılamadı:', err);
    } else {
      console.log('manifest.json dosyası güncellendi.');
    }
  });
});
