/* FullHDFilmizlesene (rapidvid)  —  fullhdweb.py'nin JS karşılığı
 * Link: /fullhd/stream?film=ali-g-ben-kimim-ali-g-who-iz-i
 */
var BASE = L.base("https://www.fullhdfilmizlesene.now");
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
function log(m) { host.log("[fullhd] " + m); }

function cleanSlug(raw) {
  var s = String(raw || "").replace(/^\/+|\/+$/g, "");
  while (/^(film\/|ilm\/)/.test(s)) s = s.replace(/^(film\/|ilm\/)/, "").replace(/^\/+|\/+$/g, "");
  return s;
}
function decodeScx(v) { try { return L.b64decode(L.padB64(L.rot13(String(v)))); } catch (e) { return ""; } }

function p8Text(p8) {
  var rev = L.padB64(p8.split("").reverse().join(""));
  var dec = L.b64decode(rev), key = "K9L", adj = "";
  for (var i = 0; i < dec.length; i++) adj += String.fromCharCode(dec.charCodeAt(i) - ((key.charCodeAt(i % 3) % 5) + 1));
  return L.b64decode(L.padB64(adj)).replace(/\\\//g, "/");
}
function labelFix(s) { return L.unicodeLabel(s); }
function subsFromText(t) {
  var out = [], seen = {}, m, re = /"file"\s*:\s*"([^"]+\.vtt[^"]*)".{0,50}?"label"\s*:\s*"([^"]+)"/g;
  while ((m = re.exec(t))) { var u = m[1].replace(/\\\//g, "/"); if (!seen[u]) { seen[u] = 1; out.push({ label: labelFix(m[2]), url: u }); } }
  return out;
}
function p8Candidates(p8) {
  var final; try { final = p8Text(p8); } catch (e) { return []; }
  var urls = [], m, re = /https?:\/\/s\d+\.[a-zA-Z0-9.\-]+\/[^\s"'<>\\]+/g;
  while ((m = re.exec(final))) { if (/\.(vtt|jpg|jpeg|png|webp|gif)(\?|$)/i.test(m[0])) continue; if (urls.indexOf(m[0]) < 0) urls.push(m[0]); }
  return urls;
}
function pickBest(cands) {
  if (!cands.length) return null;
  if (cands.length === 1) return cands[0];
  var best = null, bestKey = null;
  for (var i = 0; i < cands.length && i < 4; i++) {
    try {
      var r = host.fetch(cands[i], { headers: { "User-Agent": UA, "Referer": "https://rapidvid.org/", "Origin": "https://rapidvid.org" }, timeout: 12 });
      if (r.status !== 200) continue;
      var lines = r.text.split(/\r?\n/), isMaster = 0, topPx = 0, topBw = 0;
      for (var j = 0; j < lines.length; j++) {
        if (lines[j].indexOf("#EXT-X-STREAM-INF") !== 0) continue; isMaster = 1;
        var res = /RESOLUTION=(\d+)x(\d+)/.exec(lines[j]), bw = /[:,]BANDWIDTH=(\d+)/.exec(lines[j]);
        var px = res ? res[1] * res[2] : 0, b = bw ? +bw[1] : 0;
        if (px > topPx || (px === topPx && b > topBw)) { topPx = px; topBw = b; }
      }
      var key = [isMaster, topPx, topBw];
      if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))) { bestKey = key; best = cands[i]; }
    } catch (e) {}
  }
  return best || cands[0];
}
function cdnFrom(t) { var m = /https?:\/\/s\d+\.[a-zA-Z0-9.\-]+\/[^\s"']+/.exec(t || ""); return m ? m[0] : null; }

function resolveRapid(url, referer) {
  var r = host.fetch(url, { headers: { "User-Agent": UA, "Referer": referer || BASE + "/", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate" }, timeout: 15 });
  if (r.status !== 200) return null;
  var html = r.text, subs = subsFromText(html);
  var p8 = /window\._p8\s*=\s*['"]([^'"]+)['"]/.exec(html);
  if (p8) {
    try {
      var fin = p8Text(p8[1]), psubs = subsFromText(fin);
      try {
        var js = JSON.parse(fin), tr = js.tracks || js.subs || [];
        for (var i = 0; i < tr.length; i++) { var u = tr[i].file || tr[i].src; if (u && /\.vtt$/.test(u) && !psubs.some(function (s) { return s.url === u; })) psubs.push({ label: labelFix(tr[i].label || tr[i].kind || "Türkçe"), url: u }); }
      } catch (e) {}
      var all = subs.concat(psubs.filter(function (s) { return !subs.some(function (x) { return x.url === s.url; }); }));
      var cdn = /https?:\/\/s\d+\.[a-zA-Z0-9.\-]+\/[^\s"'<>]+/.exec(fin) || /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/.exec(fin);
      if (cdn) { var best = pickBest(p8Candidates(p8[1])); return { url: best || cdn[0], subs: all }; }
    } catch (e) { log("_p8 hatası: " + e); }
  }
  var av = /av\(["']([^"']+)["']\)/.exec(html);
  if (av) {
    var rev = L.padB64(av[1].split("").reverse().join("")), t = L.b64decode(rev), res = "";
    for (var k = 0; k < t.length; k++) res += String.fromCharCode(t.charCodeAt(k) - ((("K9L").charCodeAt(k % 3) % 5) + 1));
    var cdn2 = cdnFrom(L.b64decode(L.padB64(res)));
    if (cdn2) return { url: cdn2, subs: subs };
  }
  var mm = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/.exec(html);
  return mm ? { url: mm[0], subs: subs } : null;
}

function resolve(req) {
  var slug = cleanSlug(req.slug), filmUrl = BASE + "/film/" + slug;
  var r = host.fetch(filmUrl, { headers: { "User-Agent": UA, "Referer": BASE + "/", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" }, timeout: 25 });
  if (r.status !== 200) throw new Error("Film sayfası alınamadı: " + r.status + (r.status === 403 || r.status === 503 ? " (Cloudflare)" : ""));
  var sm = /var\s+scx\s*=\s*(\{[\s\S]*?\});/.exec(r.text);
  if (!sm) throw new Error("scx bulunamadı");
  var scx = JSON.parse(sm[1]), groups = ["t", "p"];
  for (var key in scx) {
    var src = scx[key]; if (!src || typeof src !== "object") continue;
    var sx = src.sx; if (!sx || typeof sx !== "object") continue;
    for (var g = 0; g < groups.length; g++) {
      var vals = sx[groups[g]] || []; if (!Array.isArray(vals)) vals = Object.keys(vals).map(function (k) { return vals[k]; });
      for (var i = 0; i < vals.length; i++) {
        var dec = decodeScx(vals[i]); if (!dec) continue;
        var rv = /https?:\/\/rapidvid\.(?:org|net)\/[^\s"'<>]+/.exec(dec);
        var out = null;
        if (rv) out = resolveRapid(rv[0], filmUrl);
        if (!out) { var c = cdnFrom(dec); if (c) out = { url: c, subs: [] }; }
        if (!out && dec.indexOf("turbo.imgz.me") >= 0) {
          var target = dec.split("||").pop();
          var t = host.fetch(target, { headers: { "Referer": filmUrl, "User-Agent": UA }, timeout: 15 });
          if (t.status === 200) { var fm = /file:\s*"([^"]+)"/.exec(t.text); if (fm) out = { url: fm[1].replace(/\\\//g, "/"), subs: subsFromText(t.text) }; }
        }
        if (out && out.url) {
          var subs = out.subs.map(function (s) { var gl = L.guessLang(s.label, s.url); return { label: s.label, lang: gl.lang, forced: gl.forced, url: s.url }; });
          return { url: out.url, referer: "https://rapidvid.org/", subs: subs, name: slug, ttl: 8 * 3600, subsMode: "single", topOnly: true };
        }
      }
    }
  }
  throw new Error("Video linki bulunamadı");
}
