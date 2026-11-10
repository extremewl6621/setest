/* Tube: YouTube canlı yayınları + TV kanalları (HLS)  —  tube.js'in uygulama içi karşılığı
 * Link: /tube/trt1.m3u8  /tube/cnn.m3u8  /tube/<11 haneli YouTube id>.m3u8
 * İsteğe bağlı ayar: custom={"yt":{"kanal":{"name":"..","id":"..","handle":"@.."}},"tv":{"kanal":{"name":"..","url":"https://.."}}}
 */
var CHANNELS = {
  cnn:         { name: "CNN Türk",               id: "6N8_r2uwLEc", handle: "@cnnturk",              group: "Haber" },
  sozcu:       { name: "Sözcü TV",               id: "ztmY_cCtUl0", handle: "@Sozcutelevizyonu",     group: "Haber" },
  kozatv:      { name: "KOZA Televizyonu",       id: "nZQk3nYkzZw", handle: "@KozaTv",               group: "Haber" },
  Halktv:      { name: "Halktv",                 id: "8_qAqJdVAuM", handle: "@Halktv-eu",            group: "Haber" },
  bloomberght: { name: "Bloomberg HT",           id: "j7B_zsL11Pw", handle: "@bloomberght",          group: "Haber" },
  trthaber:    { name: "TRT Haber",              id: "GefoJ-LXYfc", handle: "@trthaber",             group: "Haber" },
  ahaber:      { name: "A Haber",                id: "o2i1o4cFRzA", handle: "@Ahaber",               group: "Haber" },
  haberturktv: { name: "Habertürk TV",           id: "RNVNlJSUFoE", handle: "@haberturktv",          group: "Haber" },
  haberglobal: { name: "Haber Global",           id: "EqoCJ8BPxtE", handle: "@haberglobal",          group: "Haber" },
  birguntv:    { name: "BirGün TV",              id: "46PAWd_9qPo", handle: "@birguntv",             group: "Genel" },
  ntv:         { name: "NTV",                    id: "pqq5c6k70kk", handle: "@NTV",                  group: "Haber" },
  apara:       { name: "A Para",                 id: "Fas1VhgP8Uk", handle: "@apara",                group: "Haber" },
  benguturk:   { name: "Bengütürk TV",           id: "MOhcWsOL1Us", handle: "@tvbenguturk",          group: "Haber" },
  krt:         { name: "KRT TV",                 id: "_k0wG2Qah1g", handle: "@krtcanli",             group: "Haber" },
  tv100:       { name: "TV 100",                 id: "4WSvLRk83-c", handle: "@tv100",                group: "Haber" },
  ulusal:      { name: "Ulusal Kanal",           id: "Gcxkjxhbhk8", handle: "@ulusalkanalTV",        group: "Haber" },
  bein:        { name: "beIN SPORTS Türkiye",    id: "i7UpPgxfZZ8", handle: "@beINSPORTSTürkiye",    group: "Spor" },
  cartoon:     { name: "Cartoon Network Türkiye",id: "JyMeD9wfMZQ", handle: "@cartoonnetworkturkiye",group: "Çocuk" },
  kemalsunal:  { name: "Kemal Sunal Filmleri",   id: "uA2Lffjey3g", handle: "@KemalSunalFilmleriveSahneleri",group: "Dizi / YouTube" },
  muhtesem:    { name: "Muhteşem Yüzyıl",        id: "tZxD_s29JZc", handle: null,                    group: "Dizi / YouTube" },
  leyla:       { name: "Leyla ile Mecnun",       id: "3nlND4audLg", handle: null,                    group: "Dizi / YouTube" },
  kanal7:      { name: "Kanal 7",                id: "2exv1i3jgIY", handle: "@kanal7tvcanli",        group: "Genel" },
};

// Statik HLS kanalları (test.py -> STATIC_CHANNELS). Bunlar sabit link olduğu için 302 ile yönlendirilir.
var TV = "https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/";
var STATIC = {
  trt1:        { name: "TRT 1",        group: "Genel",    logo: TV + "trt-1-tr.png",  url: "https://tv-trt1.medya.trt.com.tr/master.m3u8" },
  atv:         { name: "ATV",          group: "Genel",    logo: "https://i.imgur.com/HyVUwFC.png", url: "https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/atv/atv_1080p.m3u8" },
  kanald:      { name: "Kanal D",      group: "Genel",    logo: "https://i.imgur.com/9o1atM6.png", url: "https://demiroren.daioncdn.net/kanald/kanald.m3u8?app=kanald_web&ce=3" },
  showtv:      { name: "Show TV",      group: "Genel",    logo: TV + "show-tr.png",   url: "https://ciner.daioncdn.net/showtv/showtv.m3u8?app=showtv_web" },
  startv:      { name: "Star TV",      group: "Genel",    logo: "https://i.imgur.com/9O3DHRB.png", url: "https://dogus.daioncdn.net/startv/startv_720p.m3u8?app=a20ac41e-bdc3-4aa1-934d-26b484480ac9&ce=3&sid=8l4w3lst4co5" },
  nowtv:       { name: "NOW TV",       group: "Genel",    logo: "https://i.imgur.com/5EYjWK7.png", url: "https://uycyyuuzyh.turknet.ercdn.net/nphindgytw/nowtv/nowtv.m3u8" },
  tv8:         { name: "TV 8",         group: "Genel",    logo: TV + "tv8-tr.png",    url: "https://tv8.daioncdn.net/tv8/tv8.m3u8?app=7ddc255a-ef47-4e81-ab14-c0e5f2949788&ce=3" },
  tv360:       { name: "360",          group: "Genel",    logo: TV + "360-tr.png",    url: "https://turkmedya-live.ercdn.net/tv360/tv360.m3u8" },
  trthaber:    { name: "TRT Haber",    group: "Haber",    logo: TV + "trt-haber-tr.png", url: "https://tv-trthaber.medya.trt.com.tr/master.m3u8" },
  ntv:         { name: "NTV",          group: "Genel",    logo: TV + "ntv-tr.png",    url: "https://dogus.daioncdn.net/ntv/ntv.m3u8?app=ntv_web" },
  haberturk:   { name: "Haber Türk",   group: "Haber",    logo: TV + "haberturk-tr.png", url: "https://rmtftbjlne.turknet.ercdn.net/bpeytmnqyp/haberturktv/haberturktv_1080p.m3u8" },
  haberglobal: { name: "Haber Global", group: "Haber",    logo: TV + "haber-global-tr.png", url: "https://tv.ensonhaber.com/haberglobal/haberglobal.m3u8" },
  ahaber:      { name: "A Haber",      group: "Haber",    logo: TV + "a-haber-tr.png", url: "https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/ahaber/ahaber.m3u8" },
  aspor:       { name: "A Spor",       group: "Spor",     logo: "https://i.imgur.com/ZhkZzLf.png", url: "https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/aspor/aspor.m3u8" },
  trtspor:     { name: "TRT Spor",     group: "Spor",     logo: "https://cdn-i.pr.trt.com.tr/trttv/w750/h750/q100/13687983.png", url: "https://trt.daioncdn.net/trtspor/master.m3u8?app=web" },
  trtbelgesel: { name: "TRT Belgesel", group: "Belgesel", logo: TV + "trt-belgesel-tr.png", url: "https://tv-trtbelgesel.medya.trt.com.tr/master.m3u8" },
  trtcocuk:    { name: "TRT Çocuk",    group: "Çocuk",    logo: TV + "trt-cocuk-tr.png", url: "https://tv-trtcocuk.medya.trt.com.tr/master.m3u8" },
  trtmuzik:    { name: "TRT Müzik",    group: "Müzik",    logo: "https://i.imgur.com/JgUzRH8.png", url: "https://tv-trtmuzik.medya.trt.com.tr/master.m3u8" },
  trtturk:     { name: "TRT Türk",     group: "Genel",    logo: TV + "trt-turk-tr.png", url: "https://tv-trtturk.medya.trt.com.tr/master.m3u8" },
  diyanet:     { name: "Diyanet TV",   group: "Dini",     logo: TV + "diyanet-tv-tr.png", url: "https://eustr73.mediatriple.net/videoonlylive/mtikoimxnztxlive/broadcast_5e3bf95a47e07.smil/playlist.m3u8" },
};

// Dinamik kanallar: sayfa her istekte taranır, taze (token'lı) link 302 ile verilir.
// Mevcut kanalların slug'larına dokunulmaz; bunlar yeni slug'lardır.
//   page/referer : linkin okunacağı sayfa
//   patterns     : ham HTML'de linki yakalayan regex'ler (1. grup = link), sırayla denenir
//   height       : (isteğe bağlı) ana listeden bu yükseklikteki akışı seç, yoksa ana liste kalır
var DYNAMIC = {
  hturk: {
    name: "Habertürk TV (otomatik)", group: "Haber", logo: TV + "haberturk-tr.png",
    page: "https://www.haberturk.com/canliyayin", referer: "https://www.haberturk.com/",
    patterns: [
      /var\s+videoUrl\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /["'](https?:\/\/[^"']*daioncdn\.net\/[^"']+\.m3u8[^"']*)["']/i,
    ],
  },
  nowtv720: {
    name: "NOW TV 720p (otomatik)", group: "Genel", logo: "https://i.imgur.com/5EYjWK7.png",
    page: "https://www.nowtv.com.tr/canli-yayin", referer: "https://www.nowtv.com.tr/",
    height: 720,
    patterns: [
      /daiUrl\s*:\s*['"]([^'"]+\.m3u8[^'"]*)['"]/i,
      /(https?:(?:\\?\/){2}[^"'\s<>]*ercdn\.net[^"'\s<>]*\.m3u8[^"'\s<>]*)/i,
    ],
  },
};

/* ---- Mantık (tube.js'in uygulama içi karşılığı) ---- */
var UA_WEB = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var UA_ANDROID = "com.google.android.youtube/20.10.38 (Linux; U; Android 14)";
var CLIENTS = [
  { name: "ANDROID", ua: UA_ANDROID, ctx: { clientName: "ANDROID", clientVersion: "20.10.38" }, headers: {}, extra: {} },
  { name: "ANDROID_VR", ua: "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
    ctx: { clientName: "ANDROID_VR", clientVersion: "1.60.19", deviceMake: "Oculus", deviceModel: "Quest 3", androidSdkVersion: 32, osName: "Android", osVersion: "12L" },
    headers: { "X-YouTube-Client-Name": "28", "X-YouTube-Client-Version": "1.60.19" }, extra: { contentCheckOk: true, racyCheckOk: true } },
  { name: "IOS", ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
    ctx: { clientName: "IOS", clientVersion: "20.10.4", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82" },
    headers: { "X-YouTube-Client-Name": "5", "X-YouTube-Client-Version": "20.10.4" }, extra: { contentCheckOk: true, racyCheckOk: true } }
];
function log(m) { host.log("[tube] " + m); }

function custom() {
  var raw = host.setting("custom");           // {"yt":{"slug":{"name":..,"id":..,"handle":..}},"tv":{"slug":{"name":..,"url":..}}}
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { log("custom ayarı geçersiz JSON"); return {}; }
}

function liveIdFromHandle(handle) {
  var clean = String(handle || "").replace(/^@/, "").trim();
  if (!clean) return null;
  try {
    var r = host.fetch("https://www.youtube.com/@" + encodeURIComponent(clean) + "/live", { headers: { "User-Agent": UA_WEB, "Accept-Language": "tr-TR,tr;q=0.9", "Cookie": "CONSENT=YES+1; SOCS=CAI" }, timeout: 15 });
    var html = r.text, id = null, idx = html.indexOf('"videoDetails"');
    if (idx !== -1) {
      var block = html.substring(idx, idx + 20000), vid = /"videoId":"([a-zA-Z0-9_-]{11})"/.exec(block);
      if (vid && /"isLive"\s*:\s*true/.test(block)) id = vid[1];
    }
    if (!id) { var can = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})"/.exec(html); if (can) id = can[1]; }
    return id;
  } catch (e) { return null; }
}

function apiKey(videoId) {
  var r = host.fetch("https://www.youtube.com/watch?v=" + videoId, { headers: { "User-Agent": UA_WEB, "Accept-Language": "tr-TR,tr;q=0.9", "Cookie": "CONSENT=YES+1; SOCS=CAI" }, timeout: 15 });
  var m = /"INNERTUBE_API_KEY":"([^"]+)"/.exec(r.text);
  return m ? m[1] : null;
}

function player(key, videoId, c) {
  var client = { hl: "tr", gl: "TR" }, k;
  for (k in c.ctx) client[k] = c.ctx[k];
  var payload = { context: { client: client }, videoId: videoId, playbackContext: { contentPlaybackContext: { html5Preference: "HTML5_PREF_WANTS" } } };
  for (k in c.extra) payload[k] = c.extra[k];
  var h = { "User-Agent": c.ua, "Content-Type": "application/json" };
  for (k in c.headers) h[k] = c.headers[k];
  var r = host.fetch("https://www.youtube.com/youtubei/v1/player?key=" + key, { method: "POST", headers: h, body: JSON.stringify(payload), timeout: 15 });
  return JSON.parse(r.text);
}

function ttlOf(url, data) {
  var ttl = data && data.streamingData && Number(data.streamingData.expiresInSeconds);
  if (!ttl) { var m = /[\/?&]expire[=\/](\d+)/.exec(url); if (m) ttl = Number(m[1]) - Math.floor(Date.now() / 1000); }
  if (!ttl || ttl <= 0) return 300;
  return Math.min(Math.max(ttl - 600, 60), 12 * 3600);
}

function youtubeHls(videoId) {
  var key = apiKey(videoId);
  if (!key) throw new Error("INNERTUBE_API_KEY bulunamadı (YouTube sayfası engellemiş olabilir)");
  var notes = [], muxed = null, muxedData = null;
  for (var i = 0; i < CLIENTS.length; i++) {
    var c = CLIENTS[i], data;
    try { data = player(key, videoId, c); } catch (e) { notes.push(c.name + ": " + e); continue; }
    var sd = data && data.streamingData, hls = sd && sd.hlsManifestUrl;
    if (hls) return { url: hls, ttl: ttlOf(hls, data) };
    var ps = data && data.playabilityStatus, st = (ps && ps.status) || "?";
    notes.push(c.name + ": " + st + (ps && ps.reason ? " (" + ps.reason + ")" : "") + ", HLS yok");
    if (!muxed && sd && sd.formats) {
      var f = sd.formats.filter(function (x) { return x.url && /^video\/mp4/.test(x.mimeType || ""); }).sort(function (a, b) { return (b.height || 0) - (a.height || 0); })[0];
      if (f) { muxed = f; muxedData = data; }
    }
    if (st !== "OK") break;
  }
  if (muxed) return { url: muxed.url, ttl: ttlOf(muxed.url, muxedData) };
  throw new Error(notes.join(" | "));
}

function pickVariant(master, height, referer) {
  var r = host.fetch(master, { headers: { "User-Agent": UA_WEB, "Referer": referer }, timeout: 15 });
  if (r.status !== 200) return master;
  var lines = r.text.split(/\r?\n/);
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf("#EXT-X-STREAM-INF") !== 0) continue;
    var m = /RESOLUTION=\d+x(\d+)/.exec(lines[i]);
    if (m && Number(m[1]) === height && lines[i + 1]) {
      var u = L.urljoin(master, lines[i + 1].trim());
      if (u.indexOf("?") < 0 && master.indexOf("?") >= 0) u += master.substring(master.indexOf("?"));
      return u;
    }
  }
  return master;
}

function dynamicUrl(ch) {
  var r = host.fetch(ch.page, { headers: { "User-Agent": UA_WEB, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8", "Referer": ch.referer || ch.page }, timeout: 15 });
  if (r.status !== 200) throw new Error("HTTP " + r.status);
  for (var i = 0; i < ch.patterns.length; i++) {
    var m = ch.patterns[i].exec(r.text);
    if (!m || !m[1]) continue;
    var u = L.cleanUrl(m[1]);
    if (u.indexOf("//") === 0) u = "https:" + u;
    if (ch.height) { try { u = pickVariant(u, ch.height, ch.referer || ch.page); } catch (e) {} }
    return u;
  }
  throw new Error("Canlı yayın linki sayfada bulunamadı");
}

function result(url, ttl, ref, yt) {
  var o = { url: url, referer: ref || "", subs: [], ttl: ttl, name: "tube" };
  if (yt) { o.headers = { "User-Agent": UA_WEB }; o.headersFor = ["googlevideo", "youtube", "ytimg"]; }
  return o;
}

function resolve(req) {
  var slug = String(req.slug).replace(/\.(m3u8|mp4|ts)$/i, "").toLowerCase().replace(/^\/+|\/+$/g, ""), cu = custom();
  var tvC = (cu.tv && cu.tv[slug]) || null;
  if (tvC && tvC.url) return result(tvC.url, 600, "", false);
  if (STATIC[slug]) return result(STATIC[slug].url, 600, "", false);
  if (DYNAMIC[slug]) { log(slug + ": dinamik kanal çözülüyor"); return result(dynamicUrl(DYNAMIC[slug]), 900, DYNAMIC[slug].referer, false); }

  var ch = (cu.yt && cu.yt[slug]) || CHANNELS[slug], bare = /^[\w-]{11}$/.test(req.slug) && !ch;
  if (!ch && !bare) throw new Error("Bilinmeyen kanal: " + slug);
  var id = ch ? ch.id : req.slug, source = "sabit";
  if (ch && ch.handle) { var live = liveIdFromHandle(ch.handle); if (live) { id = live; source = "handle"; } }
  if (!id) throw new Error("Canlı ID bulunamadı (" + slug + ")");
  log(slug + ": video " + id + " [" + source + "]");
  var y = youtubeHls(id);
  return result(y.url, y.ttl, "", true);
}
