/* FilmEkseni (vidmoly / jwplayer)  —  app.py'nin JS karşılığı
 * Link: /eksen/stream?film=ali-g-ben-kimim   (diziler: dizi/<slug>/sezon-1/bolum-2)
 * Ayar (isteğe bağlı): cookie=filmekseni_session=...; XSRF-TOKEN=...
 */
var BASE = "https://filmekseni.vip";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var FALLBACK_HOST = "https://fmdzihoilrvjfvcvvhlbwlkypjsmemvyfxvppedcdqszdxotre.firgunedavay.shop";
var LANG_ORDER = ["dual", "tr", "eng", "en", "yerli"];
var M3U8_RE = [
  /sources\s*:\s*\[\s*\{\s*file\s*:\s*['"]([^'"]+)['"]/i,
  /file\s*:\s*['"](https?:\/\/[^'"]+urlset\/master[^'"]*)['"]/i,
  /file\s*:\s*['"]([^"']+master\.m3u8[^'"]*)['"]/i,
  /["']file["']\s*:\s*['"]([^"']+\.m3u8[^'"]*)['"]/i,
  /file\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i
];
function log(m) { host.log("[eksen] " + m); }
function cookieHdr(h) { var c = host.setting("cookie"); if (c) h["Cookie"] = c; return h; }

function absUrl(base, raw) { raw = String(raw).trim(); return raw.charAt(0) === "/" && raw.indexOf("//") !== 0 ? FALLBACK_HOST + raw : L.urljoin(base, raw); }

function vidmoly(embedUrl, referer) {
  try {
    var clean = embedUrl.split("#")[0].replace(/https?:\/\/vidmoly\.[a-z0-9]+/, "https://vidmoly.me");
    var r = host.fetch(clean, { headers: { "User-Agent": UA, "Referer": referer || clean }, timeout: 10 });
    if (r.status < 200 || r.status >= 300) return null;
    var scripts = r.text.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (var i = 0; i < scripts.length; i++) {
      var sc = scripts[i].replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
      if (sc.indexOf("sources:") >= 0 || sc.indexOf("eval(function") >= 0 || sc.indexOf("file:") >= 0) {
        var link = L.decodeJs(sc, BASE); if (link) return link;
      }
    }
    var norm = L.unescapeJs(r.text);
    for (var k = 0; k < M3U8_RE.length; k++) { var m = M3U8_RE[k].exec(norm); if (m) return m[1]; }
  } catch (e) { log("vidmoly hatası: " + e); }
  return null;
}

function fetchEmbed(embedUrl, referer) {
  var clean = embedUrl.split("#")[0];
  if (clean.toLowerCase().indexOf("vidmoly") >= 0) { var v = vidmoly(clean, referer); if (v) return { master: v, subs: [] }; }
  var r = host.fetch(clean, { headers: cookieHdr({ "User-Agent": UA, "Referer": referer, "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7" }), timeout: 15 });
  if (r.status < 200 || r.status >= 300) return { master: null, subs: [] };
  var html = r.text, master = null, subs = [], seen = {}, m;
  function addSub(u, label) { if (!seen[u]) { seen[u] = 1; subs.push({ label: label, url: u }); } }

  var jre = /JSON\.parse\(\s*'((?:\\'|[^'])+)'\s*\)/g;
  while ((m = jre.exec(html))) {
    try {
      var data = JSON.parse(L.jsSingleQuoteUnescape(m[1]));
      if (data && typeof data === "object") {
        if (data.file && !master) master = absUrl(clean, data.file);
        var tr = data.tracks || [];
        for (var i = 0; i < tr.length; i++) {
          var t = tr[i]; if (!t || !t.file) continue;
          if (t.file.indexOf(".vtt") >= 0 || t.file.indexOf(".srt") >= 0 || t.kind === "captions" || t.kind === "subtitles") addSub(absUrl(clean, t.file), t.label || "Türkçe");
        }
      }
    } catch (e) {}
  }
  if (!master) {
    var scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    for (var s = 0; s < scripts.length && !master; s++) {
      var sc = scripts[s].replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
      if (sc.indexOf("sources:") >= 0 || sc.indexOf("dc_") >= 0 || sc.indexOf("eval(function") >= 0 || sc.indexOf("file:") >= 0) {
        var link = L.decodeJs(sc, BASE); if (link && link.indexOf("http") === 0) master = link;
      }
    }
  }
  var norm = L.unescapeJs(html);
  if (!master) for (var k = 0; k < M3U8_RE.length; k++) { var mm = M3U8_RE[k].exec(norm); if (mm) { master = absUrl(clean, mm[1].trim()); break; } }
  var re1 = /\{[^}]*"file"\s*:\s*"([^"]+\.vtt)"[^}]*"label"\s*:\s*"([^"]+)"/g, re2 = /\{[^}]*"label"\s*:\s*"([^"]+)"[^}]*"file"\s*:\s*"([^"]+\.vtt)"/g;
  while ((m = re1.exec(norm))) addSub(absUrl(clean, m[1]), m[2]);
  while ((m = re2.exec(norm))) addSub(absUrl(clean, m[2]), m[1]);
  return { master: master, subs: subs };
}

function videoEntries(html) {
  var m = /x-data="videoPlayerData\(JSON\.parse\('([^']+)'\)/.exec(html);
  if (!m) return [];
  var data;
  try { data = JSON.parse(L.unescapeJs(m[1]).replace(/\\n/g, "")); } catch (e) { return []; }
  var out = [], done = {};
  function push(group) {
    var arr = data[group]; if (!arr || !arr.length) return; done[group] = 1;
    for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].link && arr[i].template) { var e = {}; for (var k in arr[i]) e[k] = arr[i][k]; e.group = group; out.push(e); }
  }
  for (var i = 0; i < LANG_ORDER.length; i++) push(LANG_ORDER[i]);
  for (var g in data) if (!done[g] && data[g] && data[g].length !== undefined && typeof data[g] === "object") push(g);
  return out;
}

function embedUrlOf(entry) {
  var dec; try { dec = L.b64decode(entry.template); } catch (e) { return null; }
  var m = /data-src=["']([^"']+)["']/.exec(dec) || /src=["']([^"']+)["']/.exec(dec);
  if (!m) return null;
  var u = m[1].replace("{url}", entry.link || "").replace("{slug}", entry.slug || "");
  if (u.indexOf("//") === 0) return "https:" + u;
  return u.indexOf("http") === 0 ? u : "https://" + u;
}

function resolve(req) {
  var slug = String(req.slug).replace(/^\/+|\/+$/g, "");
  var cands = [BASE + "/" + slug + "/"];
  if (slug.indexOf("dizi/") === 0) cands.push(BASE + "/" + slug.slice(5) + "/");
  else if (slug.indexOf("sezon-") >= 0 || slug.indexOf("bolum-") >= 0) cands.push(BASE + "/dizi/" + slug + "/");
  var html = null, pageUrl = null;
  for (var i = 0; i < cands.length && !html; i++) {
    var r = host.fetch(cands[i], { headers: cookieHdr({ "User-Agent": UA }), timeout: 15 });
    if (r.status >= 200 && r.status < 300) { html = r.text; pageUrl = cands[i]; }
  }
  if (!html) throw new Error("Film bulunamadı");

  var entries = videoEntries(html), best = null;
  for (var e = 0; e < entries.length; e++) {
    var eu = embedUrlOf(entries[e]); if (!eu) continue;
    var x = fetchEmbed(eu, pageUrl); if (!x.master) continue;
    var cand = { master: x.master, subs: x.subs, ref: L.origin(eu) + "/" };
    log("embed ok: " + eu.slice(0, 80) + " (" + x.subs.length + " altyazı)");
    if (x.subs.length) { best = cand; break; }
    if (!best) best = cand;
  }
  if (!best) {
    var ifr = /<iframe[^>]+src=["']([^"']+)["']/i.exec(html);
    if (ifr) {
      var src = L.urljoin(BASE, ifr[1]);
      var y = fetchEmbed(src, pageUrl);
      if (y.master) best = { master: y.master, subs: y.subs, ref: L.origin(src) + "/" };
    }
  }
  if (!best) throw new Error("Kaynak bulunamadı");

  var subs = best.subs.map(function (s) {
    var g = L.guessLang(s.label, s.url);
    return { label: s.label, lang: g.lang, forced: g.forced, url: s.url };
  });
  var headers = {}; var ck = host.setting("cookie"); if (ck) headers["Cookie"] = ck;
  return { url: best.master, referer: best.ref, headers: headers, subs: subs, name: "eksen", ttl: 12 * 3600, subsMode: "segmented", subShift: 0.1 };
}
