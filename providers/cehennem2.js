/* HDFilmCehennemi2  —  cehennem2.py'nin JS karşılığı
 * Link: /cehennem2/stream?film=ali-g-ben-kimim-izle
 */
var BASE = "https://www.hdfilmcehennemi2.biz";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";
function log(m) { host.log("[cehennem2] " + m); }

function normUrl(u) {
  if (!u) return "";
  u = L.unescapeJs(u).replace(/\\/g, "").replace(/["']/g, "").trim();
  return u.indexOf("//") === 0 ? "https:" + u : u;
}

function subItem(file, label) {
  file = normUrl(file); if (!file) return null;
  var c = (label + " " + file).toLowerCase();
  if (c.indexOf("_eng") >= 0 || c.indexOf("english") >= 0 || c.indexOf("ing") >= 0) return { label: "İngilizce", lang: "en", forced: false, url: file };
  if (c.indexOf("_tur") >= 0 || c.indexOf("türk") >= 0 || c.indexOf("turkish") >= 0) {
    var f = c.indexOf("forced") >= 0 || c.indexOf("zorunlu") >= 0;
    return { label: f ? "Türkçe (Forced)" : "Türkçe", lang: "tr", forced: f, url: file };
  }
  return { label: label || "Türkçe", lang: "tr", forced: false, url: file };
}

function fromPlayer(html, iframeSrc) {
  var link = null, subs = [], seen = {}, m;
  var jre = /JSON\.parse\(\s*'((?:\\.|[^'])+)'\s*\)/g;
  while ((m = jre.exec(html))) {
    try {
      var d = JSON.parse(L.jsSingleQuoteUnescape(m[1]));
      if (d && typeof d === "object") {
        if (d.file && !link) link = L.urljoin(iframeSrc, normUrl(d.file));
        var tr = d.tracks || [];
        for (var i = 0; i < tr.length; i++) {
          var t = tr[i]; if (!t || !t.file) continue;
          var tf = L.urljoin(iframeSrc, normUrl(t.file));
          if ((tf.indexOf(".vtt") >= 0 || tf.indexOf(".srt") >= 0 || t.kind === "captions" || t.kind === "subtitles") && !seen[tf]) {
            seen[tf] = 1; var si = subItem(tf, t.label || "Türkçe"); if (si) subs.push(si);
          }
        }
      }
    } catch (e) { log("JWPlayer JSON uyarısı: " + e); }
  }
  var norm = L.unescapeJs(html);
  if (!subs.length) {
    var r1 = /\{[^{}]*?"file"\s*:\s*"([^"]+?\.vtt[^"]*)"[^{}]*?"label"\s*:\s*"([^"]+)"[^{}]*?\}/g, r2 = /\{[^{}]*?"label"\s*:\s*"([^"]+)"[^{}]*?"file"\s*:\s*"([^"]+?\.vtt[^"]*)"[^{}]*?\}/g;
    while ((m = r1.exec(norm))) { var u1 = L.urljoin(iframeSrc, normUrl(m[1])); if (!seen[u1]) { seen[u1] = 1; subs.push(subItem(u1, m[2])); } }
    while ((m = r2.exec(norm))) { var u2 = L.urljoin(iframeSrc, normUrl(m[2])); if (!seen[u2]) { seen[u2] = 1; subs.push(subItem(u2, m[1])); } }
  }
  if (!link) {
    var mm = /(https?:\/\/[^\s"'<>\\]+?master\.m3u8[^\s"'<>\\]*)/.exec(norm) || /["']file["']\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/.exec(norm);
    if (mm) link = normUrl(mm[1]);
    else { var sm = /<source[^>]+src=["']([^"']+)["']/i.exec(norm); if (sm) link = L.urljoin(iframeSrc, normUrl(sm[1])); }
  }
  return { link: link, subs: subs };
}

function iframeFrom(htmlFrag) {
  var m = /<iframe[^>]*?(?:data-src|src)=["']([^"']+)["']/i.exec(htmlFrag);
  return m ? normUrl(m[1]) : "";
}

function resolve(req) {
  var slug = String(req.slug).replace(/^\/+|\/+$/g, "");
  var target = slug.indexOf("http") === 0 ? slug : BASE + "/" + slug + "/";
  var r = host.fetch(target, { headers: { "Referer": BASE + "/", "User-Agent": UA }, timeout: 12 });
  if (r.status === 404) throw new Error("Sayfa bulunamadı (404)");
  if (r.status === 403 || r.status === 503) throw new Error("Cloudflare engeli (" + r.status + ")");
  var html = r.text, link = null, subs = [], refOrigin = BASE;

  var xd = /data-video-player[^>]*x-data=(["'])([\s\S]*?)\1/i.exec(html) || /x-data=(["'])([^"']*JSON\.parse[^"']*)\1/i.exec(html);
  var jm = xd ? /JSON\.parse\('((?:\\.|[^'])+)'\)/.exec(L.htmlDecode(xd[2])) : null;
  if (jm) {
    try {
      var vd = JSON.parse(L.jsSingleQuoteUnescape(jm[1])), all = [], order = ["dual", "tr", "en", "org"], k;
      for (k = 0; k < order.length; k++) if (vd[order[k]] && vd[order[k]].length) all = all.concat(vd[order[k]]);
      for (var key in vd) if (order.indexOf(key) < 0 && vd[key] && vd[key].length !== undefined && typeof vd[key] === "object") all = all.concat(vd[key]);
      for (var i = 0; i < all.length && !link; i++) {
        var vid = all[i]; if (!vid) continue;
        var tpl = vid.template ? L.b64decode(vid.template) : "";
        var ifr = iframeFrom(tpl.replace("{url}", vid.link || "").replace("{slug}", vid.slug || ""));
        if (!ifr) continue;
        log("iframe: " + ifr.slice(0, 90));
        var v = host.fetch(ifr, { headers: { "User-Agent": UA, "Referer": target }, timeout: 12 });
        if (v.status < 200 || v.status >= 300 || v.text.indexOf("Bu sitede oynatmaya izin verilmiyor") >= 0)
          v = host.fetch(ifr, { headers: { "User-Agent": UA, "Referer": BASE + "/" }, timeout: 12 });
        if (v.status >= 200 && v.status < 300) {
          var x = fromPlayer(v.text, ifr);
          if (x.link) { link = x.link; subs = x.subs; refOrigin = L.origin(ifr) + "/"; }
        }
      }
    } catch (e) { log("JSON işleme hatası: " + e); }
  }
  if (!link) {
    var ifr2 = iframeFrom(html);
    if (ifr2 && ifr2.indexOf("youtube.com") < 0) {
      var v2 = host.fetch(ifr2, { headers: { "User-Agent": UA, "Referer": target }, timeout: 12 });
      if (v2.status >= 200 && v2.status < 300) { var y = fromPlayer(v2.text, ifr2); link = y.link; subs = y.subs; refOrigin = L.origin(ifr2) + "/"; }
    }
  }
  if (!link) throw new Error("Akış linki (m3u8) çözülemedi.");
  return { url: link, referer: refOrigin, subs: subs.filter(function (s) { return s; }), name: "HDFilmCehennemi2", ttl: 12600, subsMode: "segmented", subShift: 1.1 };
}
