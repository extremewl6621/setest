/* MediaFire sağlayıcısı  (mediafire_worker.py'nin JS karşılığı)
 *
 * Python'daki worker iki iş yapıyordu:
 *   1) MediaFire sayfa URL -> direct download link   (BU DOSYA)
 *   2) Direct link -> istemciye proxy/redirect       (HOST tarafı yapar)
 *
 * Bu yüzden burada sadece resolve() var: MediaFire sayfasını çek, indirme linkini çıkar, dön.
 * Proxy/redirect/range/resume kararı host'a aittir (LocalServer.handleStream / relay zaten yapıyor).
 *
 * Not: MediaFire doğrudan indirme linki verir; .m3u8 değil, .mkv/.mp4/.avi dosyasıdır.
 * subs: [] (MediaFire altyazı sunmaz).
 */
var BASE = "https://www.mediafire.com";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function log(m) { host.log("[mediafire] " + m); }

// ---------- URL temizleme ----------

function cleanDirectUrl(u) {
  if (!u) return null;
  u = String(u).replace(/&amp;/g, "&").trim();
  // URL decode
  try { u = decodeURIComponent(u); } catch (e) { /* geçersiz escape, olduğu gibi bırak */ }
  // Bilinen bozuk kalıplar
  u = u.replace(/\/\/www\.mediafire\.com\/\/www\.mediafire\.com/g, "//www.mediafire.com");
  u = u.replace(/^https:\/\/www\.mediafire\.com\/\//, "https://www.mediafire.com/");
  return u;
}

// ---------- Scrambled URL (base64) ----------

function decodeScrambled(value) {
  try {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var s = String(value).replace(/[^A-Za-z0-9+/]/g, "");
    while (s.length % 4) s += "=";
    var out = "", buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === "=") break;
      var v = chars.indexOf(c);
      if (v < 0) continue;
      buf = (buf << 6) | v;
      bits += 6;
      if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 0xFF); }
    }
    out = out.trim();
    return /^https?:/.test(out) ? out : null;
  } catch (e) { return null; }
}

// ---------- HTML'den indirme linki çıkarma ----------

function extractDirectUrl(html, allowFallback) {
  // <a> etiketlerini tara
  var tagRe = /<a\b[^>]*>/gi, m;
  while ((m = tagRe.exec(html))) {
    var tag = m[0];

    // İndirme düğmesi mi?
    var isButton =
      /class=["'][^"']*\binput\b[^"']*\bpopsok\b/i.test(tag) ||
      /id=["']downloadButton["']/i.test(tag) ||
      /data-scrambled-url=/i.test(tag);
    if (!isButton) continue;

    // 1) data-scrambled-url
    var scr = /data-scrambled-url=["']([^"']+)["']/i.exec(tag);
    if (scr) {
      var dec = decodeScrambled(scr[1]);
      if (dec) return dec;
    }

    // 2) href
    var href = /href=["']([^"']+)["']/i.exec(tag);
    if (href) {
      var h = href[1].trim();
      if (h && h !== "#" && !/^javascript/i.test(h)) return h;
    }
  }

  // 3) Fallback: doğrudan download*.mediafire.com
  if (allowFallback !== false) {
    var fb = /https?:\/\/download\d+\.mediafire\.com\/[^\s"'<>]+/i.exec(html);
    if (fb) return fb[0];
  }

  return null;
}

// ---------- Sayfayı çek + linki çıkar ----------

function pageHeaders() {
  return {
    "User-Agent": UA,
    "Referer": BASE + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive"
  };
}

function fetchAndResolve(pageUrl) {
  var headers = pageHeaders();
  var res = host.fetch(pageUrl, { headers: headers, timeout: 20 });
  if (res.status !== 200) {
    log("sayfa hatası: HTTP " + res.status + " (" + pageUrl + ")");
    return null;
  }

  var html = res.text || "";
  if (!html) return null;

  // CAPTCHA kontrolü
  var low = html.toLowerCase();
  if (low.indexOf("recaptcha") >= 0 || low.indexOf("verify you are human") >= 0) {
    throw new Error("MediaFire güvenlik doğrulaması (Captcha) istedi");
  }

  var direct = extractDirectUrl(html, true);
  if (direct) return cleanDirectUrl(direct);

  log("indirme linki sayfada bulunamadı (" + html.length + " karakter)");
  return null;
}

// ---------- Ana resolve ----------

function resolve(req) {
  // Slug ya tam URL ("https://www.mediafire.com/file/...") ya da sadece dosya yolu olabilir.
  // req.slug genelde "https://www.mediafire.com/file/abc/def.mkv/file" formatındadır (M3U'dan gelir).
  var raw = String(req.slug || "").trim();
  if (!raw) throw new Error("Boş slug");

  // Eğer tam URL değilse MediaFire'ın standart yoluna yerleştir
  var pageUrl;
  if (/^https?:\/\//i.test(raw)) {
    pageUrl = raw;
  } else {
    // Örn: "abc12345/def.mkv/file" -> "https://www.mediafire.com/file/abc12345/def.mkv/file"
    var clean = raw.replace(/^\/+/, "");
    if (/^file\//.test(clean)) pageUrl = BASE + "/" + clean;
    else pageUrl = BASE + "/file/" + clean;
  }

  // Bazı M3U'larda &parametre=... eklenmiş olabilir; MediaFire için sadece yol kısmı önemli
  // (Python da '&' ile kesiyordu)
  var amp = pageUrl.indexOf("&");
  if (amp > 0) pageUrl = pageUrl.slice(0, amp);

  log("deneniyor: " + pageUrl);

  // 2 deneme (Python'da taze oturumla retry vardı)
  var direct = null;
  for (var attempt = 1; attempt <= 2; attempt++) {
    try {
      direct = fetchAndResolve(pageUrl);
      if (direct) break;
    } catch (e) {
      // Captcha → direkt yukarı fırlat (retry anlamsız)
      if (String(e.message || "").indexOf("Captcha") >= 0) throw e;
      log("deneme " + attempt + " hata: " + e);
    }
    if (attempt === 1) {
      // küçük bekleme (host'ta uyku yok, tekrar dene yeter)
    }
  }

  if (!direct) throw new Error("MediaFire indirme linki çözülemedi: " + pageUrl);

  // TTL: MediaFire direct link'leri genellikle kısa ömürlü (~5 dk). 4 dakika güvenli.
  var ttl = 4 * 60;

  log("çözüldü: " + direct.substring(0, 100) + "...");

  return {
    url: direct,
    referer: BASE + "/",
    subs: [],
    name: pageUrl,
    ttl: ttl,
    subsMode: "single"
  };
}