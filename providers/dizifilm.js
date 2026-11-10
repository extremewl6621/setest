/* Dizifilmizle (vidmixi / dosyaload)  —  test.py'nin JS karşılığı
 * Link: /dizifilm/stream?film=film/ali-g-ben-kimim  veya  dizi/<slug>/sezon-1/bolum-2
 */
var BASE = "https://dizifilmizle.to";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
function log(m) { host.log("[dizifilm] " + m); }

function embedUrlsFromHtml(html) {
  var n = html.replace(/\\"/g, '"').replace(/\\\//g, "/"), found = [], seen = {}, m, re;
  function add(u) { if (u && !seen[u]) { seen[u] = 1; found.push(u); } }
  re = /"embed_player_url_1"\s*:\s*"([^"]+)"/g; while ((m = re.exec(n))) add(m[1]);
  re = /"embed_player_url_2"\s*:\s*"([^"]+)"/g; while ((m = re.exec(n))) add(m[1]);
  re = /https?:\/\/(?:vidmixi|dosyaload)\.com\/embed\/[a-zA-Z0-9_\-]+/g; while ((m = re.exec(n))) add(m[0]);
  return found;
}

function tryDecrypt(token, payloadStr) {
  var payload;
  try { payload = JSON.parse(payloadStr.replace(/\\/g, "")); } catch (e) { return null; }
  var tokBytes = L.b64bytes(token);
  var variants = [L.utf8(tokBytes), token, L.latin1(tokBytes), token.replace(/=/g, "")];
  for (var i = 0; i < variants.length; i++) {
    if (!variants[i]) continue;
    try {
      var res = L.aesOpenSsl(L.utf8bytes(variants[i]), payload.s, payload.ct);
      if (res && res.length > 10) return res;
    } catch (e) { /* yanlış anahtar: sıradaki */ }
  }
  return null;
}

function fromDecrypted(dec) {
  var master = null, subs = [];
  try {
    var d = JSON.parse(dec);
    if (d.video_location) master = String(d.video_location).replace(/\\\//g, "/");
    var ss = d.strSubtitles || [];
    for (var i = 0; i < ss.length; i++) {
      var f = String(ss[i].file || "").replace(/\\\//g, "/");
      if (f) subs.push({ label: ss[i].label || "Altyazı", url: L.urljoin("https://vidmixi.com/", f) });
    }
    if (master) return { master: master, subs: subs };
  } catch (e) {}
  var m = /https?:\/\/[^\s"'\\]+(?:\/list\/|\.m3u8)[^\s"'\\]*/.exec(dec.replace(/\\\//g, "/"));
  return m ? { master: m[0], subs: subs } : { master: null, subs: subs };
}

function resolveEmbed(embedUrl, referer, depth) {
  if (depth > 3) return { err: "Çok fazla yönlendirme" };
  log("embed (d=" + depth + "): " + embedUrl.slice(0, 100));
  var r = host.fetch(embedUrl, { headers: { "User-Agent": UA, "Accept": "*/*", "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8", "Referer": referer }, timeout: 12 });
  if (r.status !== 200) return { err: "Embed " + r.status };
  var html = r.text, finalUrl = r.url || embedUrl;

  var subs = [], seen = {}, vm, vre = /https?:\/\/[^\s"'\\]+\.(?:vtt|srt)/g, norm = html.replace(/\\\//g, "/");
  while ((vm = vre.exec(norm))) if (!seen[vm[0]]) { seen[vm[0]] = 1; subs.push({ label: vm[0].toLowerCase().indexOf("tur") >= 0 ? "Türkçe Altyazı" : "Altyazı", url: vm[0] }); }

  var bp = /bePlayer\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"](\{[\s\S]+?\})['"]\s*\)/.exec(html);
  if (bp) {
    var dec = tryDecrypt(bp[1], bp[2]);
    if (dec) {
      var x = fromDecrypted(dec);
      if (x.master) { log("AES çözüldü: " + x.master.slice(0, 90)); return { master: x.master, subs: x.subs.length ? x.subs : subs, src: finalUrl }; }
    } else log("bePlayer çözülemedi");
  }
  var pats = [/https?:\/\/vidmixi\.com\/list\/[a-zA-Z0-9=+\/_\-]+/, /https?:\/\/vidmixi\.com\/m3u\/[a-zA-Z0-9=+\/_\-]+/,
    /https?:\/\/dosyaload\.com\/list\/[a-zA-Z0-9=+\/_\-]+/, /https?:\/\/[^\s"'\\]+\.m3u8[^\s"'\\]*/];
  for (var i = 0; i < pats.length; i++) { var m = pats[i].exec(norm); if (m) return { master: m[0], subs: subs, src: finalUrl }; }

  var ifr = /<iframe[^>]+src=["']([^"']+)["']/.exec(html);
  if (ifr) {
    var inner = L.urljoin(finalUrl, ifr[1]);
    if (inner !== finalUrl) return resolveEmbed(inner, finalUrl, depth + 1);
  }
  return { err: "Embed içinde stream bulunamadı", subs: subs };
}

function resolve(req) {
  var clean = String(req.slug).replace(/^\/+|\/+$/g, "");
  var isEp = /\/sezon-\d+\/bolum-\d+/.test(clean);
  if (isEp && !/^(dizi|film)\//.test(clean)) clean = "dizi/" + clean;

  var cands = [];
  if (/^(dizi|film)\//.test(clean)) {
    var alt = clean.replace(/^(dizi|film)\//, "");
    cands.push(BASE + "/" + clean, BASE + "/dizi/" + alt, BASE + "/film/" + alt);
  } else if (isEp) cands.push(BASE + "/dizi/" + clean, BASE + "/film/" + clean, BASE + "/" + clean);
  else cands.push(BASE + "/film/" + clean, BASE + "/dizi/" + clean);
  var uniq = {}; cands = cands.filter(function (c) { if (uniq[c]) return false; uniq[c] = 1; return true; });

  var html = null, pageUrl = null;
  for (var i = 0; i < cands.length && !html; i++) {
    var r = host.fetch(cands[i], { headers: { "User-Agent": UA, "Referer": BASE + "/" }, timeout: 12 });
    if (r.status === 200) { html = r.text; pageUrl = cands[i]; }
  }
  if (!html) throw new Error("Uygun sayfa bulunamadı");

  var embeds = embedUrlsFromHtml(html);
  if (isEp) {
    var s = /sezon-(\d+)/.exec(clean), e = /bolum-(\d+)/.exec(clean);
    if (s && e) {
      var n = html.replace(/\\"/g, '"').replace(/\\\//g, "/");
      var m = new RegExp('"thumbnail_url":"[^"]*?sezon-' + parseInt(s[1], 10) + '-bolum-' + parseInt(e[1], 10) + '\\.avif"\\s*,\\s*"embed_player_url_1"\\s*:\\s*"([^"]+)"', "i").exec(n);
      if (m) embeds = [m[1]].concat(embeds.filter(function (u) { return u !== m[1]; }));
    }
  }
  if (!embeds.length) throw new Error("Embed URL bulunamadı");

  var lastErr = "";
  for (var k = 0; k < embeds.length && k < 8; k++) {
    var x = resolveEmbed(embeds[k], pageUrl, 0);
    if (x.master) {
      var subs = (x.subs || []).map(function (sb) {
        var g = L.guessLang(sb.label, sb.url);
        var isTr = /tur|türk/i.test(sb.label + " " + sb.url);
        return { label: sb.label, lang: isTr ? "tr" : "en", forced: g.forced, url: sb.url };
      });
      return { url: x.master, referer: x.src || (L.origin(x.master) + "/"), subs: subs, name: "dizifilm", ttl: 6 * 3600, subsMode: "single" };
    }
    lastErr = x.err || lastErr;
  }
  throw new Error(lastErr || "Hiçbir embed'den stream alınamadı");
}
