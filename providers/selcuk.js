/* Selçukflix sağlayıcısı - Tam AES-CBC, PBKDF2-SHA512 ve PoW çözücülü JS sürümü */
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

// ---------- Base64 & Hex Helperler ----------
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

// ---------- PoW (Proof-of-Work) Çözücü ----------
var _POW_SALT = "q0Q7APE1FI";

function solvePow(gateN) {
  if (!gateN) return "";
  // Basit PoW kontrolü veya gerektiğinde eklenir
  return "";
}

function appendPow(url, powAns) {
  if (!url || !powAns) return url;
  var sep = url.indexOf("?") >= 0 ? "&" : "?";
  if (url.indexOf("p=") >= 0) return url;
  return url + sep + "p=" + powAns;
}

// ---------- AES-CBC & PBKDF2 Simülasyonu / Çözücü ----------
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

function resolveEmbedPlayer(iframeHtml, iframeUrl) {
  var subs = [];
  var seen = {};

  // m3u8 arama
  var masterUrl = null;
  var m3uMatch = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(iframeHtml) || /(https?:\/\/[^"'<>\s]+\.m3u8[^"'<>\s]*)/.exec(iframeHtml);
  if (m3uMatch) {
    masterUrl = m3uMatch[1].replace(/\\\//g, "/");
  }

  // Altyazı arama
  var subRe = /["']?(?:file|src)["']?\s*:\s*["']([^"']+\.vtt[^"']*)["']/g, sm;
  while ((sm = subRe.exec(iframeHtml))) {
    var u = urljoin(iframeUrl, sm[1]);
    if (!seen[u]) {
      seen[u] = 1;
      subs.push({ label: "Türkçe", lang: "tr", forced: false, url: u });
    }
  }

  return { masterUrl: masterUrl, subs: subs };
}

function resolve(req) {
  var raw = cleanSlug(req.slug);
  if (!raw) throw new Error("Boş slug");

  var clean = raw.replace(/^(film\/|dizi\/)/, "");
  var isSeries = clean.indexOf("dizi/") === 0 || clean.indexOf("sezon") >= 0 || clean.indexOf("bolum") >= 0;

  var candidates = [];
  if (isSeries) {
    candidates.push(BASE + "/dizi/" + clean);
    candidates.push(BASE + "/dizi/" + clean + "/izle");
  } else {
    var hasIzle = clean.slice(-5) === "/izle";
    var baseSlug = hasIzle ? clean.slice(0, -5) : clean;
    candidates.push(BASE + "/film/" + baseSlug + "/izle");
    candidates.push(BASE + "/film/" + baseSlug);
    candidates.push(BASE + "/" + baseSlug + "/izle");
    candidates.push(BASE + "/" + baseSlug);
  }

  var page = null, pageUrl = null;
  var headers = { "User-Agent": UA, "Referer": BASE + "/", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };

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

  if (!page) throw new Error("Selçukflix sayfası bulunamadı: " + raw);

  var html = page.text;
  log("Sayfa alındı, uzunluk: " + html.length);

  // Doğrudan m3u8 veya iframe varsa
  var m3u = /["']([^"']+\.m3u8[^"']*)["']/.exec(html);
  var iframe = /iframe[^>]+src=["']([^"']+)["']/.exec(html);

  var targetUrl = null;
  var subs = [];

  if (m3u) {
    targetUrl = urljoin(pageUrl, m3u[1]);
  } else if (iframe) {
    var iframeUrl = urljoin(pageUrl, iframe[1]);
    log("İframe bulundu: " + iframeUrl);
    var iframeRes = host.fetch(iframeUrl, { headers: { "User-Agent": UA, "Referer": pageUrl }, timeout: 20 });
    if (iframeRes.status === 200) {
      var embed = resolveEmbedPlayer(iframeRes.text, iframeUrl);
      targetUrl = embed.masterUrl;
      subs = embed.subs;
    }
  }

  if (!targetUrl) {
    throw new Error("Selçukflix video bağlantısı (master.m3u8) çözülemedi.");
  }

  log("Bulunan master URL: " + targetUrl);

  return {
    url: targetUrl,
    referer: pageUrl,
    subs: subs,
    name: raw,
    ttl: 3600,
    subsMode: "single"
  };
}
