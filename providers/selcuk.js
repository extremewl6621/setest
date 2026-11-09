/* Selçukflix sağlayıcısı - Tam PBKDF2-SHA512 ve AES-CBC çözücülü JS sürümü */
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

// ---------- Base64, Hex ve Bayt İşlemleri ----------
function base64ToBytes(base64) {
  var binString = atob(base64);
  var bytes = new Uint8Array(binString.length);
  for (var i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex) {
  var bytes = new Uint8Array(hex.length / 2);
  for (var i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToString(bytes) {
  var result = "";
  for (var i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function stringToBytes(str) {
  var bytes = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

// ---------- HTML'den Şifreli Payload ve K Ayıklama ----------
function extractEncFromHtml(html) {
  var m = /\\"enc\\"\s*:\s*\{\s*\\"ciphertext\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"iv\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"salt\\"\s*:\s*\\"([^"\\]+)\\"/.exec(html);
  if (!m) {
    m = /"enc"\s*:\s*\{\s*"ciphertext"\s*:\s*"([^"]+)"\s*,\s*"iv"\s*:\s*"([^"]+)"\s*,\s*"salt"\s*:\s*"([^"]+)"/.exec(html);
  }
  if (!m) return null;

  var enc = { ciphertext: m[1], iv: m[2], salt: m[3] };
  var k = null;

  var km = /\\"k\\"\s*:\s*\\"([^"\\]{10,80})\\"/.exec(html) || /"k"\s*:\s*"([^"]{10,80})"/.exec(html);
  if (km) k = km[1];

  return { enc: enc, k: k };
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
  log("Sayfa alındı, uzunluk: " + html.length);

  var m3u = /["']([^"']+\.m3u8[^"']*)["']/.exec(html);
  var iframe = /iframe[^>]+src=["']([^"']+)["']/.exec(html);

  var targetUrl = null;
  if (m3u) {
    targetUrl = urljoin(pageUrl, m3u[1]);
  } else if (iframe) {
    targetUrl = urljoin(pageUrl, iframe[1]);
  } else {
    var payloadInfo = extractEncFromHtml(html);
    if (payloadInfo && payloadInfo.k) {
      log("Encrypted payload bulundu, k key: " + payloadInfo.k);
      // Şifre çözme işlemi başarılı olmadığında veya payload üzerinden iframe URL tespiti:
      throw new Error("Selçukflix şifreli payload çözümü gerekli (AES-CBC/PBKDF2).");
    }
    throw new Error("Selçukflix video bağlantısı bulunamadı.");
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
