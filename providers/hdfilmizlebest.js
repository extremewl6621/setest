/* HDFilmizle.best sağlayıcısı  (hdfilmizlebest.py'nin JS karşılığı)
 * Akış: film sayfası -> nonce + post_id -> /ajax/videosrc/ -> m3u8 + altyazılar
 */
var BASE = L.base("https://www.hdfilmizle.best");
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var PAGE_PREFIXES = ["film", "bolum"];

var LANG_KEYWORDS = {
  tr: ["türkçe", "turkish", "tur"], en: ["ingilizce", "i̇ngilizce", "english", "eng"],
  de: ["almanca", "german", "ger"], fr: ["fransızca", "french", "fre"], es: ["ispanyolca", "i̇spanyolca", "spanish", "spa"],
  ar: ["arapça", "arabic", "ara"], ru: ["rusça", "russian", "rus"], it: ["italyanca", "i̇talyanca", "italian", "ita"],
  pt: ["portekizce", "portuguese", "por"], zh: ["çince", "chinese", "chi"], ja: ["japonca", "japanese", "jpn"], ko: ["korece", "korean", "kor"]
};
var STEM_CODES = { tur: "tr", eng: "en", ger: "de", deu: "de", fre: "fr", fra: "fr", spa: "es", ara: "ar", rus: "ru", ita: "it", por: "pt", chi: "zh", zho: "zh", jpn: "ja", kor: "ko" };

function log(m) { host.log("[hdfbest] " + m); }

function cleanSlug(raw) {
  var s = String(raw || "").replace(/^\/+|\/+$/g, "");
  var again = true;
  while (again) {
    again = false;
    for (var i = 0; i < PAGE_PREFIXES.length; i++) {
      if (s.indexOf(PAGE_PREFIXES[i] + "/") === 0) { s = s.slice(PAGE_PREFIXES[i].length + 1).replace(/^\/+|\/+$/g, ""); again = true; }
    }
  }
  return s;
}

function unescapeU(s) { return s.replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); }).trim(); }

function guessLang(label, vttUrl) {
  var path = vttUrl.split("?")[0];
  var stem = path.split("/").pop().replace(/\.[^.]*$/, "").toLowerCase();
  var hay = (label + " " + stem).toLowerCase();
  var forced = hay.indexOf("forced") >= 0 || hay.indexOf("zorunlu") >= 0;
  var prefix = stem.split("-")[0];
  if (STEM_CODES[prefix]) return { lang: STEM_CODES[prefix], forced: forced };
  var ll = label.toLowerCase();
  for (var code in LANG_KEYWORDS) {
    var kws = LANG_KEYWORDS[code];
    for (var i = 0; i < kws.length; i++) if (ll.indexOf(kws[i]) >= 0) return { lang: code, forced: forced };
  }
  return { lang: "und", forced: forced };
}

function extractSubs(body) {
  var subs = [], seen = {}, m;
  var re = /"src"\s*:\s*"([^"]+\.vtt[^"]*)"[\s\S]{0,80}?"label"\s*:\s*"([^"]+)"/g;
  while ((m = re.exec(body))) {
    if (seen[m[1]]) continue;
    seen[m[1]] = 1;
    var label = unescapeU(m[2]), g = guessLang(label, m[1]);
    subs.push({ label: label, lang: g.lang, forced: g.forced, url: m[1] });
  }
  return subs;
}

function extractPostId(html) {
  var m = /data-post=["']([^"']+)["']/.exec(html);
  if (m) return m[1];
  m = /<input[^>]*name=["']post_id["'][^>]*value=["']([^"']+)["']/.exec(html);
  if (m) return m[1];
  m = /<input[^>]*value=["']([^"']+)["'][^>]*name=["']post_id["']/.exec(html);
  return m ? m[1] : null;
}

function resolve(req) {
  var slug = cleanSlug(req.slug);
  if (!slug) throw new Error("Boş slug");
  var headers = { "User-Agent": UA, "Referer": BASE + "/", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };

  var page = null, filmUrl = null, statuses = [];
  for (var i = 0; i < PAGE_PREFIXES.length; i++) {
    var cand = BASE + "/" + PAGE_PREFIXES[i] + "/" + slug + "/";
    var r = host.fetch(cand, { headers: headers, timeout: 25 });
    statuses.push(r.status);
    log("deneniyor " + cand + " -> " + r.status);
    if (r.status === 200) { page = r; filmUrl = cand; break; }
  }
  if (!page) {
    var all404 = statuses.every(function (s) { return s === 404; });
    throw new Error(all404 ? "Film bulunamadı: " + slug : "Sayfa alınamadı (" + statuses.join(",") + ") - Cloudflare olabilir");
  }

  var html = page.text;
  var nm = /var\s+_hdfNonce_\s*=\s*['"]([^'"]+)/.exec(html);
  if (!nm) throw new Error("Nonce bulunamadı");
  var postId = extractPostId(html);
  if (!postId) throw new Error("post_id bulunamadı");

  var ajaxHeaders = {}; for (var k in headers) ajaxHeaders[k] = headers[k];
  ajaxHeaders["X-HDF-Nonce"] = nm[1];
  ajaxHeaders["Referer"] = filmUrl;
  var ax = host.fetch(BASE + "/ajax/videosrc/?id=" + postId + "&lang=tr&mr=0", { method: "POST", headers: ajaxHeaders, body: "", timeout: 20 });
  if (ax.status !== 200) throw new Error("AJAX başarısız: " + ax.status);

  var body = ax.text.replace(/\\\//g, "/");
  var subs = extractSubs(body);
  var srcs = body.match(/"src"\s*:\s*"[^"]+"/g) || [], cdn = null;
  for (var j = srcs.length - 1; j >= 0; j--) {
    var u = /"src"\s*:\s*"([^"]+)"/.exec(srcs[j])[1];
    if (u.toLowerCase().indexOf(".m3u8") >= 0 || u.toLowerCase().indexOf(".mp4") >= 0) { cdn = u; break; }
  }
  if (!cdn) throw new Error("AJAX yanıtında video linki yok");

  return { url: cdn, referer: BASE + "/", subs: subs, name: slug, ttl: 6 * 3600, subsMode: "single" };
}
