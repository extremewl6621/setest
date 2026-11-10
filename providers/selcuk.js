/* SelcukFlix  —  selcukflix.py'nin JS karşılığı
 * Link: /selcuk/stream?film=ali-g-who-iz-i/izle   (diziler: dizi/<slug>/...)
 * Ayar: cf_clearance=<tarayıcıdan alınan çerez>   (pichive/hotlinger Cloudflare korumasında şart olabilir)
 */
var DOMAIN = "https://selcukflix.app";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
var CF_HOSTS = ["pichive", "hotlinger", "dplayer", "cfd", "selcukflix"];
function log(m) { host.log("[selcuk] " + m); }

function hdrs(target, referer, isIframe) {
  var refHost = (/^https?:\/\/([^\/]+)/.exec(referer || "") || [])[1] || "";
  var origin = refHost ? L.origin(referer) : "https://four.pichive.online";
  var actualRef = (/\.cfd/.test(target) || /\.(jpg|ts|vtt)$/.test(target)) ? (refHost ? origin + "/" : "https://four.pichive.online/") : (referer || "https://four.pichive.online/");
  var h = isIframe
    ? { "User-Agent": UA, "Referer": actualRef, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7", "Upgrade-Insecure-Requests": "1", "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "cross-site" }
    : { "User-Agent": UA, "Referer": actualRef, "Origin": origin, "Accept": "*/*", "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7", "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "cross-site" };
  var tHost = (/^https?:\/\/([^\/]+)/.exec(target) || [])[1] || "", chk = tHost + " " + refHost, cf = host.setting("cf_clearance");
  if (cf && CF_HOSTS.some(function (k) { return chk.indexOf(k) >= 0; })) h["Cookie"] = "cf_clearance=" + cf;
  return h;
}

function decryptEnc(enc, k) {
  var salt = enc.salt, iv = enc.iv;
  var key = host.crypto({ op: "pbkdf2", pass: k, saltHex: salt, iter: 999, len: 32, hash: "SHA512" });
  var out = host.crypto({ op: "aesCbcDecrypt", keyHex: key, ivHex: iv, dataHex: L.hex(L.b64bytes(enc.ciphertext)), unpad: true });
  return L.utf8(L.unhex(out)).trim();
}

function extractEnc(html) {
  var m = /\\"enc\\"\s*:\s*\{\s*\\"ciphertext\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"iv\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"salt\\"\s*:\s*\\"([^"\\]+)\\"/.exec(html)
    || /"enc"\s*:\s*\{\s*"ciphertext"\s*:\s*"([^"]+)"\s*,\s*"iv"\s*:\s*"([^"]+)"\s*,\s*"salt"\s*:\s*"([^"]+)"/.exec(html);
  if (!m) return null;
  var after = html.slice(m.index + m[0].length, m.index + m[0].length + 500), before = html.slice(Math.max(0, m.index - 500), m.index), k = null, km;
  var pats = [/\\"k\\"\s*:\s*\\"([^"\\]{10,80})\\"/, /"k"\s*:\s*"([^"]{10,80})"/];
  for (var i = 0; i < pats.length && !k; i++) { km = pats[i].exec(after); if (km) k = km[1]; }
  for (var j = 0; j < pats.length && !k; j++) { km = pats[j].exec(before); if (km) k = km[1]; }
  return k ? { enc: { ciphertext: m[1], iv: m[2], salt: m[3] }, k: k } : null;
}

function npConfig(html) {
  var idx = html.indexOf("NP_CONFIG"); if (idx < 0) return null;
  var eq = html.indexOf("=", idx), br = eq >= 0 ? html.indexOf("{", eq) : -1; if (br < 0) return null;
  var js = L.jsonAt(html, br); if (!js) return null;
  try { return JSON.parse(js); } catch (e) { return null; }
}

function sub(label, url) { var g = L.guessLang(label, url); return { label: label, lang: g.lang, forced: g.forced, url: url }; }

function resolveEmbed(html, iframeUrl) {
  var subs = [], seen = {}, m;
  var p = html.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]*?\{\}\)\)/);
  if (p) { try { html += "\n" + L.unpack(p[0]); } catch (e) {} }
  var norm = html.replace(/\\\//g, "/");
  var re = /["']?(?:file|src)["']?\s*:\s*["']([^"']+\.vtt[^"']*)["']/g;
  while ((m = re.exec(norm))) { var u = L.urljoin(iframeUrl, m[1]); if (!seen[u]) { seen[u] = 1; subs.push(sub(/forced/i.test(u) ? "Türkçe (Forced)" : "Türkçe", u)); } }
  re = /["']([^"']*track\.php\?[^"']+)["']/g;
  while ((m = re.exec(norm))) { var u2 = L.urljoin(iframeUrl, m[1]); if (u2.indexOf("v=") >= 0 && !/v=$/.test(u2) && !seen[u2]) { seen[u2] = 1; subs.push(sub("Türkçe Altyazı", u2)); } }

  var sourceKey = null, mk = /(?:window\.)?openPlayer\(\s*['"]([^'"]+)['"]/.exec(html) || /source2\.php\?v=([a-zA-Z0-9+\/=_-]+)/.exec(html) || /player\(\s*['"]([^'"]+)['"]/.exec(html);
  if (mk) sourceKey = mk[1];
  var master = null, np = npConfig(html);
  if (np) {
    var srcs = (np.sources || []).filter(function (s) { return s && s.master; });
    if (srcs.length) { var ch = srcs.filter(function (s) { return s.kind === "orig"; })[0] || srcs[0]; master = String(ch.master).replace(/\\\//g, "/"); }
    var ns = np.subtitles || [], names = ["Türkçe (Forced)", "İngilizce (Forced)", "Türkçe", "İngilizce"];
    for (var i = 0; i < ns.length; i++) {
      var item = ns[i], f = typeof item === "string" ? item : (item && (item.file || item.url || item.src));
      if (!f) continue;
      var full = L.urljoin(iframeUrl, String(f).replace(/\\\//g, "/")); if (seen[full]) continue; seen[full] = 1;
      subs.push(sub(i < names.length ? names[i] : ((item && item.label) || "Altyazı " + (i + 1)), full));
    }
    if (!subs.length && np.track && np.track.indexOf("v=") >= 0 && !/v=$/.test(np.track)) { var ft = L.urljoin(iframeUrl, np.track); if (!seen[ft]) { seen[ft] = 1; subs.push(sub("Türkçe", ft)); } }
  }
  if (sourceKey && !master) {
    try {
      var s2 = L.urljoin(iframeUrl, "source2.php") + "?v=" + encodeURIComponent(sourceKey), h = hdrs(s2, iframeUrl, false); h["X-Requested-With"] = "XMLHttpRequest";
      var r = host.fetch(s2, { headers: h, timeout: 10 });
      if (r.status === 200) {
        var d = JSON.parse(r.text);
        if (!d.expired && d.playlist && d.playlist.length) {
          var pi = d.playlist[0];
          if (pi.sources && pi.sources.length) master = String(pi.sources[0].file).replace(/\\\//g, "/");
          var tr = pi.tracks || [];
          for (var t = 0; t < tr.length; t++) { var tf = tr[t].file || tr[t].src; if (tf && !/v=$/.test(tf)) { var fu = L.urljoin(iframeUrl, String(tf).replace(/\\\//g, "/")); if (!seen[fu]) { seen[fu] = 1; subs.push(sub(tr[t].label || tr[t].kind || "Türkçe", fu)); } } }
        }
      }
    } catch (e) {}
  }
  if (!master) { var mm = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(html) || /(https?::?[^"'\s]+\.m3u8[^"'\s]*)/.exec(html); if (mm) master = mm[1].replace(/\\\//g, "/"); }
  if (!subs.length && /hotlinger|dplayer/.test(iframeUrl)) {
    var mv = /v=([a-zA-Z0-9_-]{8,})/.exec(iframeUrl);
    if (mv) subs.push(sub("Türkçe Altyazı", L.origin(iframeUrl) + "/track.php?v=" + mv[1] + "&h=" + L.b64encode(DOMAIN + "/").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")));
  }
  return { master: master, subs: subs };
}

function pageCandidates(path) {
  var clean = path.replace(/^\/+|\/+$/g, "");
  var isSeries = /^dizi\//.test(clean) || /\/sezon/.test(clean) || /-sezon/.test(clean) || /-bolum/.test(clean);
  var wo = clean.replace(/^(film\/|dizi\/)/, ""), c;
  if (isSeries) c = [DOMAIN + "/dizi/" + wo, DOMAIN + "/dizi/" + wo + "/izle", DOMAIN + "/" + clean];
  else { var base = /\/izle$/.test(wo) ? wo.slice(0, -5) : wo;
    c = [DOMAIN + "/film/" + base + "/izle", DOMAIN + "/film/" + base, DOMAIN + "/dizi/" + base + "/izle", DOMAIN + "/dizi/" + base, DOMAIN + "/" + base + "/izle", DOMAIN + "/" + base]; }
  var seen = {}; return c.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
}

function resolve(req) {
  var param = String(req.slug), cands = param.indexOf("http") === 0 ? [param] : pageCandidates(param), last = "sayfa bulunamadı";
  for (var i = 0; i < cands.length; i++) {
    try {
      var page = cands[i];
      var r = host.fetch(page, { headers: hdrs(page, DOMAIN + "/", false), timeout: 15 });
      if (r.status !== 200) { last = "HTTP " + r.status; continue; }
      var e = extractEnc(r.text); if (!e) { last = "şifreli veri yok"; continue; }
      var iframeRaw = decryptEnc(e.enc, e.k);
      if (!/^(https?:|\/\/)/.test(iframeRaw)) { last = "çözülen veri URL değil"; continue; }
      var iframe = iframeRaw.indexOf("//") === 0 ? "https:" + iframeRaw : iframeRaw;
      var dm = /\\?"runtimeMin\\?"\s*:\s*(\d+)/.exec(r.text), duration = dm ? parseFloat(dm[1]) * 60 : 0;
      var ir = host.fetch(iframe, { headers: hdrs(iframe, page, true), timeout: 15 });
      if (ir.status < 200 || ir.status >= 300) {
        if (/dplayer/.test(iframe)) { var alt = iframe.replace(/sn\.dplayer\d+\.site/, "sn.hotlinger.com"); ir = host.fetch(alt, { headers: hdrs(alt, page, true), timeout: 15 }); if (ir.status >= 200 && ir.status < 300) iframe = alt; }
        if (ir.status < 200 || ir.status >= 300) { last = "iframe " + ir.status + " (cf_clearance ayarı gerekebilir)"; continue; }
      }
      var x = resolveEmbed(ir.text, iframe);
      if (!x.master) { last = "master bulunamadı"; continue; }
      var headers = {}, cf = host.setting("cf_clearance");
      headers["User-Agent"] = UA; if (cf) headers["Cookie"] = "cf_clearance=" + cf;
      return { url: x.master, referer: iframe, headers: headers, headersFor: CF_HOSTS, subs: x.subs, name: "selcuk", ttl: 6 * 3600,
        subsMode: "segmented", subShift: -1.1, duration: duration };
    } catch (err) { last = String(err); log(cands[i] + " hatası: " + err); }
  }
  throw new Error("Çözülemedi: " + last);
}
