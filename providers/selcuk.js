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

function resolveEmbedPlayer(iframeHtml, iframeUrl) {
  var subs = [];
  var seen = {};
  var masterUrl = null;

  var m3uMatch = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(iframeHtml) || /(https?:\/\/[^"'<>\s]+\.m3u8[^"'<>\s]*)/.exec(iframeHtml);
  if (m3uMatch) {
    masterUrl = m3uMatch[1].replace(/\\\/g, "/");
  }

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
    candidates.push(BASE + "/" + baseSlug + "/izle");
    candidates.push(BASE + "/film/" + baseSlug);
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

  var m3u = /["']([^"']+\.m3u8[^"']*)["']/.exec(html);
  var iframe = /iframe[^>]+src=["']([^"']+)["']/.exec(html);

  var targetUrl = null;
  var subs = [];

  if (m3u) {
    targetUrl = urljoin(pageUrl, m3u[1]);
  } else if (iframe) {
    var iframeUrl = urljoin(pageUrl, iframe[1]);
    log("İframe bulundu: " + iframeUrl);
    var iframeHeaders = {
      "User-Agent": UA,
      "Referer": pageUrl,
      "Sec-Fetch-Dest": "iframe",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site"
    };
    var iframeRes = host.fetch(iframeUrl, { headers: iframeHeaders, timeout: 20 });
    log("İframe yanıt durumu: " + iframeRes.status);
    if (iframeRes.status === 200) {
      var embed = resolveEmbedPlayer(iframeRes.text, iframeUrl);
      targetUrl = embed.masterUrl;
      subs = embed.subs;
    }
  }

  if (!targetUrl) {
    throw new Error("Selçukflix master.m3u8 bağlantısı çözülemedi.");
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
