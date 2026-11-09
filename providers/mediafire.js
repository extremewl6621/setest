/* MediaFire sağlayıcısı - mediafire_worker.py mantığına tam uyumlu JS sürümü */
var BASE = "https://www.mediafire.com";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function log(m) { host.log("[mediafire] " + m); }

function cleanDirectUrl(u) {
  if (!u) return null;
  u = String(u).replace(/&amp;/g, "&").trim();
  try { u = decodeURIComponent(u); } catch (e) {}
  u = u.replace(/\/\/www\.mediafire\.com\/\/www\.mediafire\.com/g, "//www.mediafire.com");
  u = u.replace(/^https:\/\/www\.mediafire\.com\/\//, "https://www.mediafire.com/");
  log("Temizlenmiş direct url: " + u.substring(0, 100) + "...");
  return u;
}

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
  } catch (e) {
    log("decodeScrambled hata: " + e);
    return null;
  }
}

function extractDirectUrl(html, allowFallback) {
  var tagRe = /<a\b[^>]*>/gi, m;
  while ((m = tagRe.exec(html))) {
    var tag = m[0];
    var isButton =
      /class=["'][^"']*\binput\b[^"']*\bpopsok\b/i.test(tag) ||
      /id=["']downloadButton["']/i.test(tag) ||
      /data-scrambled-url=/i.test(tag);
    if (!isButton) continue;

    var scr = /data-scrambled-url=["']([^"']+)["']/i.exec(tag);
    if (scr) {
      var dec = decodeScrambled(scr[1]);
      if (dec) {
        log("Scrambled URL çözüldü.");
        return dec;
      }
    }

    var href = /href=["']([^"']+)["']/i.exec(tag);
    if (href) {
      var h = href[1].trim();
      if (h && h !== "#" && !/^javascript/i.test(h)) {
        log("Buton href bulundu: " + h);
        return h;
      }
    }
  }

  if (allowFallback !== false) {
    var fb = /https?:\/\/download\d+\.mediafire\.com\/[^\s"'<>]+/i.exec(html);
    if (fb) {
      log("Fallback download URL bulundu: " + fb[0]);
      return fb[0];
    }
  }

  return null;
}

function fetchAndResolve(pageUrl) {
  var headers = {
    "User-Agent": UA,
    "Referer": BASE + "/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive"
  };
  log("Fetch isteği atılıyor: " + pageUrl);
  var res = host.fetch(pageUrl, { headers: headers, timeout: 20 });
  log("Fetch yanıt alındı, status: " + res.status);
  if (res.status !== 200) {
    log("Sayfa HTTP hata: " + res.status);
    return null;
  }

  var html = res.text || "";
  log("HTML alındı, karakter sayısı: " + html.length);
  if (!html) return null;

  var low = html.toLowerCase();
  if (low.indexOf("recaptcha") >= 0 || low.indexOf("verify you are human") >= 0) {
    throw new Error("MediaFire güvenlik doğrulaması (Captcha) istedi");
  }

  var direct = extractDirectUrl(html, true);
  if (direct) return cleanDirectUrl(direct);

  log("Uyarı: İndirme linki sayfada bulunamadı.");
  return null;
}

function resolve(req) {
  var raw = String(req.slug || "").trim();
  if (!raw) throw new Error("Boş slug");

  var pageUrl;
  if (/^https?:\/\//i.test(raw)) {
    pageUrl = raw;
  } else {
    var clean = raw.replace(/^\/+/, "");
    if (/^file\//.test(clean)) pageUrl = BASE + "/" + clean;
    else pageUrl = BASE + "/file/" + clean;
  }

  var amp = pageUrl.indexOf("&");
  if (amp > 0) pageUrl = pageUrl.slice(0, amp);

  log("MediaFire çözümleniyor, sayfa URL: " + pageUrl);

  var direct = null;
  for (var attempt = 1; attempt <= 2; attempt++) {
    try {
      direct = fetchAndResolve(pageUrl);
      if (direct) break;
    } catch (e) {
      log("Deneme " + attempt + " hata: " + e);
      if (String(e.message || "").indexOf("Captcha") >= 0) throw e;
    }
  }

  if (!direct) throw new Error("MediaFire indirme linki çözülemedi: " + pageUrl);

  log("Başarıyla çözüldü: " + direct.substring(0, 80) + "...");

  return {
    url: direct,
    referer: BASE + "/",
    subs: [],
    name: pageUrl,
    ttl: 240,
    subsMode: "single"
  };
}
