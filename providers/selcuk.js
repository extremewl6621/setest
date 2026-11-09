/* Selçukflix sağlayıcısı */
var BASE = "https://selcukflix.app";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function log(m) { host.log("[selcuk] " + m); }

function cleanSlug(raw) {
  var s = String(raw || "").trim().replace(/^\/+|\/+$/g, "");
  return s;
}

function urljoin(base, rel) {
  if (/^https?:\/\//i.test(rel)) return rel;
  if (rel.indexOf("//") === 0) return "https:" + rel;
  var m = /^(https?:\/\/[^\/]+)(\/.*)?$/.exec(base);
  if (!m) return rel;
  var origin = m[1], path = m[2] || "/";
  if (rel.charAt(0) === "/") return origin + rel;
  return origin + path.replace(/[^\/]*$/, "") + rel;
}

// ---------- Basit Şifre Çözme / Payload Ayıklama ----------
// Not: QuickJS ortamında AES/PBKDF2 çözümü için HTML'den doğrudan iframe veya m3u8 çekilebiliyorsa deneriz,
// aksi takdirde enc bloğunu işleriz.

function extractEncFromHtml(html) {
  var m = /"enc"\s*:\s*\{\s*"ciphertext"\s*:\s*"([^"]+)"\s*,\s*"iv"\s*:\s*"([^"]+)"\s*,\s*"salt"\s*:\s*"([^"]+)"/.exec(html);
  if (!m) return null;
  var enc = { ciphertext: m.group(1), iv: m.group(2), salt: m.group(3) };
  return enc;
}

function resolve(req) {
  var slug = cleanSlug(req.slug);
  if (!slug) throw new Error("Boş slug");
  var headers = { "User-Agent": UA, "Referer": BASE + "/", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };

  var candidates = [
    BASE + "/" + slug,
    BASE + "/film/" + slug,
    BASE + "/dizi/" + slug,
    BASE + "/" + slug + "/izle"
  ];

  var page = null, pageUrl = null;
  for (var i = 0; i < candidates.length; i++) {
    var cand = candidates[i];
    log("Deneniyor: " + cand);
    var r = host.fetch(cand, { headers: headers, timeout: 20 });
    if (r.status === 200) {
      page = r;
      pageUrl = cand;
      break;
    }
  }

  if (!page) throw new Error("Selçukflix sayfası bulunamadı: " + slug);

  var html = page.text;

  // Doğrudan m3u8 veya iframe arayalım
  var m3u = /["']([^"']+\.m3u8[^"']*)["']/.exec(html);
  var iframe = /iframe[^>]+src=["']([^"']+)["']/.exec(html);

  var targetUrl = null;
  if (m3u) {
    targetUrl = urljoin(pageUrl, m3u[1]);
  } else if (iframe) {
    targetUrl = urljoin(pageUrl, iframe[1]);
  } else {
    // Eğer enc payload varsa bilgi verelim
    throw new Error("Selçukflix sayfasından video bağlantısı çıkarılamadı (şifreli payload).");
  }

  log("Bulunan video/iframe URL: " + targetUrl);

  return {
    url: targetUrl,
    referer: pageUrl,
    subs: [],
    name: slug,
    ttl: 3600,
    subsMode: "single"
  };
}
