/* SonAnime  —  sonanime.js'in (Node) uygulama içi karşılığı
 * Link: /sonanime/stream?film=anime/dragon-ball/season/1/episode/1   (&q=720 ile kalite)
 * Ayar (isteğe bağlı): token=<hesabın accessToken değeri>
 */
var SITE = L.base("https://sonanime.com"), API = "https://api.sonanime.com/";
var CHROME = "131";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + CHROME + ".0.0.0 Safari/537.36";
var HINTS = { "sec-ch-ua": '"Google Chrome";v="' + CHROME + '", "Chromium";v="' + CHROME + '", "Not_A Brand";v="24"', "sec-ch-ua-mobile": "?0", "sec-ch-ua-platform": '"Windows"' };
function log(m) { host.log("[sonanime] " + m); }

function apiHeaders() {
  var h = { "User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Origin": SITE, "Referer": SITE + "/", "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "same-site" };
  for (var k in HINTS) h[k] = HINTS[k];
  var t = host.setting("token"); if (t) h["Authorization"] = "Bearer " + t;
  return h;
}

function resolve(req) {
  var m = String(req.slug).replace(/^\/+|\/+$/g, "").match(/^(?:anime\/)?([^\/]+)\/season\/(\d+)\/episode\/(\d+)$/);
  if (!m) throw new Error("film formatı: anime/<slug>/season/<n>/episode/<n>");
  var slug = m[1], season = +m[2], episode = +m[3];
  var data = null, last = "";
  for (var attempt = 1; attempt <= 3 && !data; attempt++) {
    var r = host.fetch(API + "api/anime/link/" + encodeURIComponent(slug), { headers: apiHeaders(), timeout: 15 });
    if (r.status === 200) data = JSON.parse(r.text);
    else { last = "API hatası: " + r.status + " " + r.text.slice(0, 120); if (r.status !== 429 && r.status < 500) break; }
  }
  if (!data) throw new Error(last || "API cevap vermedi");
  var eps = data.episodes || [], ep = null;
  for (var i = 0; i < eps.length; i++) if (+eps[i].anime_season === season && +eps[i].episode_number === episode) { ep = eps[i]; break; }
  if (!ep) throw new Error("bölüm yok (API " + eps.length + " bölüm döndürdü)");

  var sources = [], sizes = [1080, 720, 480, 360];
  for (var s = 0; s < sizes.length; s++) { var u = ep["episode_link_" + sizes[s]]; if (u) sources.push({ url: u, size: sizes[s] }); }
  if (!sources.length) throw new Error("bölümde video linki yok (giriş/premium gerekebilir)");
  var q = req.params && req.params.q, chosen = sources[0];
  if (q && /^\d+$/.test(q)) for (var j = 0; j < sources.length; j++) if (sources[j].size === +q) chosen = sources[j];

  var ttl = 1800;
  if (typeof ep.links_expire_at === "number") ttl = Math.max(60, ep.links_expire_at - Math.floor(Date.now() / 1000) - 300);
  var subs = [], st = ep.subtitles || [];
  for (var k = 0; k < st.length; k++) {
    var f = st[k] && (st[k].file || st[k].url || st[k].src);
    if (f) subs.push({ label: st[k].label || "Türkçe", lang: "tr", forced: false, url: L.urljoin(SITE, f) });
  }
  log(slug + " S" + season + "E" + episode + " " + chosen.size + "p");
  var hdr = { "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7", "Sec-Fetch-Dest": "video", "Sec-Fetch-Mode": "no-cors", "Sec-Fetch-Site": "cross-site", "User-Agent": UA };
  for (var kk in HINTS) hdr[kk] = HINTS[kk];
  return { url: chosen.url, referer: SITE + "/", headers: hdr, subs: subs, name: slug, ttl: ttl, subsMode: "single" };
}
