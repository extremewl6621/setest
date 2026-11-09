# Yerel IPTV (Android TV + telefon)

Uygulama cihazda yerel bir HTTP sunucusu açar; sağlayıcı scriptleri (JS) GitHub'daki `manifest.json` ile gelir.
Yayın her kullanıcının **kendi IP'sinden** açılır, senin sunucun hiç devreye girmez.

## Link yapısı (siteler karışmaz)
`http://127.0.0.1:8080/<saglayici-id>/stream?film=<slug>`

- `http://127.0.0.1:8080/cehennem/stream?film=bridget-joness-diary`
- `http://127.0.0.1:8080/hdfbest/stream?film=batman`

`<saglayici-id>` manifest'teki `id` alanıdır; her site kendi id'sinde çalışır.
Hazır M3U: `http://127.0.0.1:8080/cehennem/playlist.m3u?slugs=slug1,slug2`

## APK üretme (bilgisayarda Android Studio gerekmez)
1. Bu klasörü bir GitHub reposuna yükle (`main` dalı).
2. Actions sekmesi → `build-apk` → bitince **Artifacts → YerelIPTV-debug-apk** indir.
3. APK'yı TV'ye/telefona yükle (USB/Send Files to TV).

## Sağlayıcı reposu (Nuvio gibi)
`providers-repo/` içindekini ayrı bir repoya koy (manifest.json + providers/*.js).
Uygulamada **Manifest URL**: `https://raw.githubusercontent.com/KULLANICI/REPO/main/manifest.json` → *Sağlayıcıları Güncelle*.
APK yeni sağlayıcı için yeniden derlenmez; yeni JS + manifest satırı yeterli.

## Sağlayıcı sözleşmesi
```js
function resolve(req) {            // req = {slug, params:{prefer}}
  var r = host.fetch(url, {method, headers, body, timeout}); // senkron -> {status, headers, text, url}
  host.log("...");
  return { url, referer, subs:[{label,lang,forced,url}], name, ttl /*sn*/, subsMode:"single"|"segmented" };
}
```
Cookie oturumu her `resolve` çağrısına özeldir. HLS yeniden yazma, referer'lı relay, altyazı enjeksiyonu uygulama tarafında ortaktır.

## Test
`node tools/test_providers.js` (sahte host ile sağlayıcı mantığını sınar).
