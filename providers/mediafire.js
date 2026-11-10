/* MediaFire link çözücü  —  mediafire_worker.py'nin JS karşılığı
 * Link: /mediafire/?url=https://www.mediafire.com/file/xxxx/dosya.mkv
 * Uygulama doğrudan dosyayı Range'li akıtır; cihaz kendi IP'sinden indirdiği için ek proxy modu gerekmez.
 */
function log(m) { host.log("[mediafire] " + m); }

function decodeScrambled(v) {
  try { var raw = L.b64decode(v).trim(); return raw.indexOf("http") === 0 ? raw : null; } catch (e) { return null; }
}

function extractDirect(html, allowFallback) {
  var tags = html.match(/<a\b[^>]*>/gi) || [];
  for (var i = 0; i < tags.length; i++) {
    var tag = tags[i];
    var isBtn = /class=["'][^"']*\binput\b[^"']*\bpopsok\b/i.test(tag) || /id=["']downloadButton["']/i.test(tag) || /data-scrambled-url=/i.test(tag);
    if (!isBtn) continue;
    var scr = /data-scrambled-url=["']([^"']+)["']/i.exec(tag);
    if (scr) { var u = decodeScrambled(scr[1]); if (u) return u; }
    var href = /href=["']([^"']+)["']/i.exec(tag);
    if (href) { var h = href[1].trim(); if (h && h !== "#" && h.toLowerCase().indexOf("javascript") !== 0) return h; }
  }
  if (allowFallback) { var m = /https?:\/\/download\d+\.mediafire\.com\/[^\s"'<>]+/i.exec(html); if (m) return m[0]; }
  return null;
}

function cleanDirect(u) {
  u = u.replace(/&amp;/g, "&");
  try { u = decodeURIComponent(u); } catch (e) {}
  u = u.trim().replace("//www.mediafire.com//www.mediafire.com", "//www.mediafire.com").replace("https://www.mediafire.com//", "https://www.mediafire.com/");
  return u;
}

function resolve(req) {
  var page = String(req.slug).split("&")[0].trim();
  if (page.indexOf("http") !== 0) throw new Error("MediaFire sayfa adresi (?url=https://www.mediafire.com/file/...) gerekli");
  var cookie = host.setting("cookie");
  for (var attempt = 1; attempt <= 2; attempt++) {
    var h = { "User-Agent": L.UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8" };
    if (cookie) h["Cookie"] = cookie;
    var r = host.fetch(page, { headers: h, timeout: 20 });
    if (r.status !== 200) { log("sayfa durumu " + r.status + " (deneme " + attempt + ")"); continue; }
    var d = extractDirect(r.text, true);
    if (d) {
      d = cleanDirect(d);
      log("doğrudan link: " + d.slice(0, 90));
      return { url: d, referer: "https://www.mediafire.com/", subs: [], name: "mediafire", ttl: 120 };
    }
    if (/recaptcha|verify you are human/i.test(r.text)) throw new Error("MediaFire doğrulama (captcha) istedi. Eklenti ayarına cookie=... ekleyebilirsin.");
    log("indirme linki sayfada bulunamadı (deneme " + attempt + ")");
  }
  throw new Error("Link bulunamadı veya MediaFire doğrulama istedi");
}
