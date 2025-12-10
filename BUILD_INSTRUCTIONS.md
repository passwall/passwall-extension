# Passwall Extension - Build Talimatları

## 🎉 Manifest V3 Upgrade Tamamlandı!

Extension **Manifest V3** ile güncellenmiştir ve modern Chrome sürümleri ile tam uyumludur.

## Gereksinimler

- Node.js 14+ (Test edildi: v22.19.0)
- Yarn 1.x (Test edildi: v1.22.22)
- Chrome 88+ veya Firefox 109+ (Manifest V3 desteği için)

## Kurulum ve Build

### 1. Bağımlılıkları Yükle

```bash
yarn install --ignore-engines --ignore-scripts
```

**Not:** 
- `--ignore-engines`: Node.js sürüm uyarılarını atlar
- `--ignore-scripts`: Puppeteer kurulum hatalarını önler (sadece test için gerekli)

### 2. Production Build

```bash
yarn build
```

Bu komut otomatik olarak Node.js OpenSSL uyumluluk sorununu çözer.

### 3. Development Build

```bash
yarn build:dev
```

Development modda build almak için.

## Chrome'a Yükleme

1. Chrome'u açın
2. `chrome://extensions` adresine gidin
3. Sağ üstten "Developer mode" (Geliştirici modu) aktif edin
4. "Load unpacked" (Paketlenmemiş uzantı yükle) butonuna tıklayın
5. Proje içindeki `dist/` klasörünü seçin
6. Extension yüklendi! 🎉

## Firefox'a Yükleme

1. Firefox'u açın
2. `about:debugging` adresine gidin
3. "This Firefox" (Bu Firefox) sekmesini seçin
4. "Load Temporary Add-on" (Geçici eklenti yükle) butonuna tıklayın
5. `dist/manifest.json` dosyasını seçin
6. Extension yüklendi! 🎉

**Not:** Firefox'ta geçici eklentiler tarayıcı kapatıldığında kaldırılır.

## Bilinen Sorunlar ve Çözümler

### ✅ [ÇÖZÜLDÜ] Manifest V3 CSP Hatası

**Hata:** `Invalid value for 'content_security_policy'`

**Çözüm:** Build sonrası otomatik olarak CSP kaldırılıyor (`scripts/fix-manifest-mv3.js`). Manifest V3 varsayılan CSP'si kullanılıyor ve Chrome tarafından kabul ediliyor.

### Node.js 17+ OpenSSL Hatası

**Hata:** `error:0308010C:digital envelope routines::unsupported`

**Çözüm:** Package.json'daki `build` scriptine `NODE_OPTIONS=--openssl-legacy-provider` eklendi. `yarn build` komutu artık bu hatayı vermemeli.

### Puppeteer ARM64 Hatası

**Hata:** `The chromium binary is not available for arm64`

**Çözüm:** `--ignore-scripts` parametresi ile install yapılmalı. Puppeteer sadece test için kullanılıyor, production build için gerekli değil.

### Engine Uyumsuzluğu

**Hata:** `The engine "node" is incompatible with this module`

**Çözüm:** `--ignore-engines` parametresi ile install yapılmalı.

## Build Çıktısı

Build başarılı olduğunda `dist/` klasöründe şunlar oluşur:

```
dist/
├── manifest.json          # Extension manifest
├── popup.html             # Ana popup arayüzü
├── options.html           # Ayarlar sayfası
├── js/
│   ├── popup.js          # Popup JavaScript
│   ├── background.js     # Arka plan scripti
│   ├── content-script.js # Sayfa enjeksiyon scripti
│   └── ...
├── css/                   # Stiller
├── icons/                 # Extension ikonları
└── fonts/                 # Font dosyaları
```

## Geliştirme

### Watch Mode

Değişiklikleri otomatik derlemek için:

```bash
yarn serve
```

**Not:** Bu komut development modda build alır ve dosya değişikliklerini izler.

### Linting

Kod kalitesi kontrolü:

```bash
yarn lint
```

### Test

```bash
yarn test
```

**Not:** Testler şu anda puppeteer hatası nedeniyle çalışmayabilir.

## Sıkça Sorulan Sorular

### Build neden başarısız oluyor?

1. `node_modules` klasörünü silin: `rm -rf node_modules`
2. Yarn cache temizleyin: `yarn cache clean`
3. Tekrar install yapın: `yarn install --ignore-engines --ignore-scripts`
4. Build alın: `yarn build`

### Extension Chrome'da neden çalışmıyor?

1. Developer mode'un açık olduğundan emin olun
2. `dist/` klasörünü seçtiğinizden emin olun (proje kök klasörünü değil)
3. Manifest hatası varsa console'u kontrol edin
4. Extension'ı kaldırıp tekrar yükleyin

### Build uyarıları sorun mu?

Hayır. Build sırasında şu uyarılar normal ve güvenle görmezden gelinebilir:

- ⚠️ Browserslist outdated
- ⚠️ fs.Stats constructor deprecated
- ⚠️ console statement warnings (no-console)
- ⚠️ Asset size limit warnings
- ⚠️ Peer dependency warnings

Bunlar build başarısını etkilemez.

## Katkıda Bulunma

Projeye katkıda bulunmak için `CONTRIBUTING.md` dosyasına bakın.

## Destek

- Website: https://passwall.io
- Email: hello@passwall.io
- GitHub Issues: https://github.com/passwall/passwall-extension/issues

---

**Son Güncelleme:** 10 Aralık 2025

