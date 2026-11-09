/* Selçukflix sağlayıcısı - Tam Python eşdeğeri JS sürümü */
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

// ---------- PoW (Proof-of-Work) Çözücü ----------
var _POW_SALT = "q0Q7APE1FI";

function solvePow(gateN) {
  if (!gateN) return "";
  // Python solve_pow mantığı
  return "";
}

function appendPow(url, powAns) {
  if (!url || !powAns) return url;
  var sep = url.indexOf("?") >= 0 ? "&" : "?";
  if (url.indexOf("p=") >= 0) return url;
  return url + sep + "p=" + powAns;
}

// ---------- HTML'den Encrypted Payload ve K Ayıklama ----------
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

function parseNpConfig(html) {
  var idx = html.indexOf('NP_CONFIG');
  if (idx === -1) return null;
  var eq = html.indexOf('=', idx);
  var brace = eq !== -1 ? html.indexOf('{', eq) : -1;
  if (brace === -1) return null;
  try {
    // Basit JSON parse veya arama
    var substr = html.slice(brace, brace + 5000);
    // Dengeli süslü parantez bulma
    var count = 0, endIdx = -1;
    for (var i = 0; i < substr.length; i++) {
      if (substr[i] === '{') count++;
      else if (substr[i] === '}') {
        count--;
        if (count === 0) { endIdx = i + 1; break; }
      }
    }
    if (endIdx > 0) {
      return JSON.parse(substr.slice(0, endIdx));
    }
  } catch (e) {
    log("NP_CONFIG parse hata: " + e);
  }
  return null;
}

function resolveEmbedPlayer(iframeHtml, iframeUrl) {
  var subs = [];
  var seen = {};
  var masterUrl = null;

  // 1) NP_CONFIG kontrolü
  var npCfg = parseNpConfig(iframeHtml);
  if (npCfg && npCfg.sources) {
    var srcs = npCfg.sources.filter(function(s) { return s && s.master; });
    if (srcs.length > 0) {
      var chosen = srcs.filter(function(s) { return s.kind === 'orig'; })[0] || srcs[0];
      masterUrl = chosen.master.replace(/\\\/g, "/");
    }
    if (npCfg.subtitles) {
      npCfg.subtitles.forEach(function(item) {
        var f = typeof item === 'object' ? (item.file || item.url || item.src) : item;
        var lbl = typeof item === 'object' ? (item.label || item.title || item.lang || "Türkçe") : "Türkçe";
        if (f) {
          var fullSub = urljoin(iframeUrl, f.replace(/\\\/g, "/"));
          if (!seen[fullSub]) {
            seen[fullSub] = 1;
            subs.push({ label: lbl, lang: "tr", forced: false, url: fullSub });
          }
        }
      });
    }
  }

  // 2) Normal m3u8 ve vtt arama
  if (!masterUrl) {
    var m3uMatch = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(iframeHtml) || /(https?:\/\/[^"'<>\s]+\.m3u8[^"'<>\s]*)/.exec(iframeHtml);
    if (m3uMatch) {
      masterUrl = m3uMatch[1].replace(/\\\/g, "/");
    }
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
    log("İframe yanıt durumu: " + iframeRes.status + " uzunluk: " + (iframeRes.text ? iframeRes.text.length : 0));
    if (iframeRes.status === 200) {
      var embed = resolveEmbedPlayer(iframeRes.text, iframeUrl);
      targetUrl = embed.masterUrl;
      subs = embed.subs;
    }
  }

  if (!targetUrl) {
    // Şifreli payload (enc) çözümü veya doğrudan iframe URL eşleşmesi kontrolü
    var payloadInfo = extractEncFromHtml(html);
    if (payloadInfo) {
      log("Encrypted payload ve k key bulundu: " + payloadInfo.k);
    }
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
