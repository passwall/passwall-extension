# Apple ID (idmsa.apple.com) – Passwall Extension Debug Handoff

Bu dosya, `idmsa.apple.com` Apple ID login akışında (özellikle “password step”) Passwall icon injection + autofill’in neden çalışmadığını debug ederken kaldığımız yeri özetler. Amaç: daha sonra aynı noktadan hızlıca devam edebilmek.

## Problem Özeti

- Apple ID sayfası: `https://idmsa.apple.com/IDMSWebAuth/signin.html?...`
- Davranış:
  - Username/Apple ID alanında icon artık inject olabiliyor ve seçince username doldurulabiliyor.
  - “Continue/Sign In” sonrası password alanı görünüyor fakat password alanına icon **inject olmuyor** (veya step geçişlerinde icon kayboluyor).
  - Apple password input çoğu durumda `tabIndex = -1` olarak kalıyor; Apple UI muhtemelen kendi focus yönetimini yapıyor.

## Runtime Kanıt (debug.log)

Log dosyası:

- `/.cursor/debug.log` (NDJSON)

Önemli log noktaları:

- `content-script.js:setupMutationObserver` (`hypothesisId: L`): top + iframe root’larının observe edildiğini doğrular.
- `content-script.js:findLoginForms:bg` (`hypothesisId: D`): password input sayıları, iframe sayıları.
- `content-script.js:checkForMultiStepLogin:visibleSample` (`hypothesisId: I`): görünen inputlar; özellikle `password_text_field` için `tabIndex:-1` gözlemi.
- `content-script.js:injectLogo` (`hypothesisId: H`): hangi input’a inject etmeye çalıştığını (id/type/tabIndex) gösterir.
- `content-script.js:fillInputWithEvents` (`hypothesisId: F`): fill çağrıldı mı, `sameWindow`, `tabIndex`, `hiddenByAria` gibi sinyaller.

## Yapılan Değişiklikler (şu an repoda)

### 1) Same-origin iframe taraması

`src/content-scripts/content-script.js`

- `findAllInputs()` ve `findAllActionElements()` artık same-origin iframe’leri de recursive tarıyor.
- `setupMutationObserver()`:
  - `attributeFilter` içine `tabindex` eklendi
  - top document + same-origin iframe document root’larına observe eklendi
  - observe edildiğini doğrulayan log: `hypothesisId: L`

### 2) CSP/CORS log sorunu için “background relay”

Apple sayfası content-script içinden localhost ingest fetch’ini engelleyebiliyor.

- `src/background-scripts/background-script.js`: `AGENT_LOG` message type eklendi.
  - Content script → `browser.runtime.sendMessage({type:'AGENT_LOG', payload})`
  - Background → ingest endpoint’e `fetch(...)`

### 3) Username step “autocomplete token” fix

Apple ID input: `autocomplete="username webauthn"` (whitespace-separated token).

- `identifyFieldType()` ve multi-step “likely” heuristics token bazlı hale getirildi:
  - `autocomplete.split(/\s+/)` ile `username` / `email` token’larını algılıyor.
  - Bu sayede username step’te logo inject olmaya başladı.

### 4) Iframe-aware autofill events

`fillInputWithEvents()` (content script) ve `LoginAsPopup.fillInputWithEvents()`:

- `input.ownerDocument.defaultView` üzerinden:
  - `HTMLInputElement.prototype.value` setter
  - `InputEvent`, `FocusEvent`, `MouseEvent`, `Event`
  - `setTimeout`
  - Böylece iframe içindeki input’lara değer set etmeye yaklaşım düzeltildi.

### 5) Logo positioning iyileştirmesi

`src/content-scripts/PasswallLogo.js`

- `position: fixed` + `getBoundingClientRect()` ile konumlama (iframe/SPA için daha stabil).
- scroll/resize (capture=true) ile RAF üzerinden `updatePosition()` tekrar çağrılıyor.

## Mevcut Hipotez / Kök Neden

1) Password step’te input gerçek DOM’da var ama `tabIndex=-1` kalıyor (loglarda sık görülüyor).
2) “Interactable” filtresi (tabIndex/aria-hidden) password’u dışlıyor → `findLoginForms()` password “usable” bulamıyor → multi-step’e düşüyor → sadece username icon’u kalıyor.
3) Apple password step aktive olurken `tabindex` değişikliği beklediğimiz şekilde olmuyor; dolayısıyla “step aktif” tespitiyle tabIndex override denemeleri başarısız kalabiliyor.

## Son Denenen (başarısız kalan) yaklaşım

- `isAutofillInteractableInput()` içinde `idmsa.apple.com` için password step’te `tabIndex=-1` override denendi (`.password-on/.password-second-step/.show-password` sınıfları üzerinden).
- `injectLogo()` içinde password step’te `loginField.password`’ı önceliklendirme denendi.
- Buna rağmen kullanıcı raporuna göre password icon’u hala inject olmuyor.

## Devam İçin Önerilen Net Sonraki Adımlar

### A) Step tespiti “DOM class” yerine “focusability / computed style / pointer events” ile yapılmalı

Apple password input:
- `tabIndex=-1` kalıyorsa bile:
  - computed style `display/visibility/opacity`
  - `getBoundingClientRect()` ölçüleri
  - `disabled` değil mi
  - parent’larda `aria-hidden` var mı (Apple bazen yanlış kullanıyor)

Öneri: `isAutofillInteractableInput()` için Apple domain’inde password’ta `tabIndex` kuralını gevşet ama **sadece**:
- input rect>0
- computed style visible
- parent `.password` container visible
- input “gerçekten” kullanıcı etkileşimine açık (örn. click ile focus olabiliyorsa)

Bunu runtime log ile doğrula:
- password step’te `document.activeElement` ve `getDeepActiveElement()` sonucu
- password input’a click sonrası activeElement değişiyor mu?

### B) Password step’e geçişte “rescan” tetikleyicisi

Şu an observer var ama password step’te UI değişimi belki:
- iframe içi navigation / DOM replace
- input node değişiyor (yeni input instance)

Öneri: password step’te `injectLogo` için:
- DOM’da `#password_text_field` var mı ve **node reference değişiyor mu**?
- `MutationObserver` callback’inde `mutation.target.ownerDocument` da loglanabilir (iframe mi?).

### C) Bitwarden referansı (lokal)

Repo: `/Users/erhanyakut/Projects/bitwarden/clients`

İlgili alanlar:
- `clients/apps/browser/src/autofill/*`
- `clients/apps/browser/src/autofill/overlay/inline-menu/*`

Bitwarden’da Apple ID özel-case bulunamadı; fakat iframe overlay mimarisi ve input value setter yaklaşımı incelenebilir.

## Repro (manuel)

1. Extension reload
2. Apple ID sayfası aç
3. Username alanı yanında icon görünüyor mu? → tıkla → kaydı seç → username doluyor mu?
4. Continue/Sign In → password step
5. Password alanında icon görünüyor mu? → tıkla → kaydı seç → password doluyor mu?
6. `/.cursor/debug.log` içinden `hypothesisId: D/H/I/F/L` loglarını kontrol et.

## Not: Enstrümantasyon Durumu

- `AGENT_LOG` background relay ve çeşitli `// #region agent log` blokları halen kodda.
- Bu çalışma tekrar başlatılana kadar kaldırılmadı.
