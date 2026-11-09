/* HDFilmCehennemi sağlayıcısı  (cehennem.py'nin JS karşılığı)
 * Sözleşme: resolve({slug, params}) -> {url, referer, subs[], name, ttl}
 * Senkron çalışır. Ağ: host.fetchRaw (fetch() sarmalayıcısı aşağıda).
 */
var BASE = "https://www.hdfilmcehennemi.nl";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var JS_STUB = "\nvar _noop = function(){};\nvar _makeEventTarget = function() {\n    return {\n        addEventListener: _noop,\n        removeEventListener: _noop,\n        dispatchEvent: _noop\n    };\n};\n\nvar window = _makeEventTarget();\nwindow.innerWidth = 1920;\nwindow.innerHeight = 1080;\nwindow.location = { href: 'https://www.hdfilmcehennemi.nl/', hostname: 'www.hdfilmcehennemi.nl', origin: 'https://www.hdfilmcehennemi.nl', protocol: 'https:' };\nwindow.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' };\nwindow.localStorage = { totalPlayTime: 0 };\nwindow.document = {\n    addEventListener: _noop,\n    removeEventListener: _noop,\n    getElementById: function(){ return { addEventListener: _noop, removeEventListener: _noop, style: {}, classList: { add: _noop, remove: _noop }, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; } }; },\n    querySelector: function(){ return null; },\n    querySelectorAll: function(){ return []; },\n    createElement: function(){ return { setAttribute: _noop, addEventListener: _noop, style: {}, classList: { add: _noop, remove: _noop }, parentNode: null, innerHTML: '' }; },\n    getElementsByClassName: function(){ return []; },\n    getElementsByTagName: function(){ return []; },\n    getElementsByName: function(){ return []; },\n    body: { appendChild: _noop, removeChild: _noop, classList: { add: _noop, remove: _noop } },\n    head: { appendChild: _noop, removeChild: _noop },\n    documentElement: { clientWidth: 1920, clientHeight: 1080, style: {} },\n    visibilityState: 'visible',\n    fullscreenElement: null,\n    cookie: '',\n    readyState: 'complete'\n};\n\nvar document = window.document;\nvar localStorage = window.localStorage;\nvar navigator = window.navigator;\nvar location = window.location;\n\nvar atob = function(s) {\n    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';\n    var str = String(s).replace(/=+$/, '').replace(/[\\s]/g, '');\n    var output = '';\n    if (str.length % 4 === 1) throw new Error('bad atob input');\n    for (var bc = 0, bs, buffer, idx = 0;\n         (buffer = str.charAt(idx++));\n         ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,\n         bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {\n        buffer = chars.indexOf(buffer);\n    }\n    return output;\n};\nvar btoa = function(s) {\n    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';\n    var str = String(s);\n    var output = '';\n    for (var block, charCode, idx = 0, map = chars;\n         str.charAt(idx | 0) || (map = '=', idx % 1);\n         output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {\n        charCode = str.charCodeAt(idx += 3 / 4);\n        block = block << 8 | charCode;\n    }\n    return output;\n};\n\nvar $ = function() {\n    var obj = {\n        append: function(){ return obj; }, prepend: function(){ return obj; },\n        on: function(){ return obj; }, once: function(){ return obj; },\n        off: function(){ return obj; }, remove: function(){ return obj; },\n        css: function(){ return obj; }, attr: function(){ return obj; },\n        text: function(){ return obj; }, html: function(){ return obj; },\n        addClass: function(){ return obj; }, removeClass: function(){ return obj; },\n        val: function(){ return ''; }, each: function(){ return obj; },\n        eq: function(){ return obj; }, not: function(){ return obj; },\n        find: function(){ return obj; },\n        length: 0,\n        parentNode: { insertBefore: _noop },\n        classList: { add: _noop, remove: _noop }\n    };\n    return obj;\n};\n$.fn = {};\n\nvar jwplayer = function() {\n    return {\n        setup: function(){ return this; },\n        on: function(){ return this; }, once: function(){ return this; },\n        off: function(){ return this; }, addButton: function(){ return this; },\n        getContainer: function(){ return null; },\n        getPosition: function(){ return 0; },\n        getState: function(){ return 'idle'; },\n        getDuration: function(){ return 0; },\n        getFullscreen: function(){ return false; },\n        getCaptionsList: function(){ return []; },\n        getCurrentAudioTrack: function(){ return 0; },\n        getCurrentCaptions: function(){ return 0; },\n        setCurrentCaptions: function(){},\n        setCurrentAudioTrack: function(){},\n        seek: function(){}, load: function(){},\n        play: function(){}, stop: function(){},\n        key: ''\n    };\n};\njwplayer.key = '';\n\nvar console = { log: _noop, warn: _noop, error: _noop, info: _noop, debug: _noop, dir: _noop, trace: _noop, table: _noop, group: _noop, groupEnd: _noop };\n\nvar gtag = _noop;\nvar setInterval = function(){ return 0; };\nvar setTimeout = function(){ return 0; };\nvar clearInterval = _noop;\nvar clearTimeout = _noop;\nvar requestAnimationFrame = function(){ return 0; };\nvar cancelAnimationFrame = _noop;\nvar Defer = { dom: _noop };\nvar Message = function(){ return { show: function(){ return this; } }; };\nMessage.clearAll = _noop;\nMessage.parent = { appendChild: _noop, removeChild: _noop };\nMessage.Stack = [];\nMessage.idGen = function(){ return 0; };\nMessage.Util = { find: function(){ return -1; }, toDash: function(s){ return s; }, getSizes: function(){ return {width:1920,height:1080}; }, rePosition: _noop };\nMessage.stylePresets = [];\nMessage.config = { types: _noop };\nMessage.prototype = { init: _noop, show: _noop, stylize: _noop };\n\nvar initVisibilityChecker = function(){ return { isVisible: function(){ return false; } }; };\nvar jwMenuAc = _noop;\nvar jwMenuKapa = _noop;\nvar tooltipShown = false;\nvar audioLoaded = 0;\nvar audioTracks = [];\nvar curCaptions = [];\nvar currentAudioTrackIndex = 0;\nvar curCaptionIndex = 0;\nvar forcedCaption = false;\nvar trAltyazi = false;\nvar trAltyazi2 = false;\nvar trAlyazi = false;\nvar trAlyazi2 = false;\n";

function log(m) { host.log("[cehennem] " + m); }

function normalizeUrl(u) {
  if (!u) return u;
  return u.replace(/\\\//g, "/").replace(/\\/g, "").replace(/"/g, "").replace(/'/g, "").trim();
}

function urljoin(base, rel) {
  if (/^https?:\/\//i.test(rel)) return rel;
  if (rel.indexOf("//") === 0) return "https:" + rel;
  var m = /^(https?:\/\/[^\/]+)(\/.*)?$/.exec(base);
  var origin = m[1], path = m[2] || "/";
  if (rel.charAt(0) === "/") return origin + rel;
  return origin + path.replace(/[^\/]*$/, "") + rel;
}

function stripTags(s) { return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim(); }

// ---------- Dean Edwards unpacker ----------
function baseEncode(num, base) {
  var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (num === 0) return digits.charAt(0);
  var res = "";
  while (num > 0) { res = digits.charAt(num % base) + res; num = Math.floor(num / base); }
  return res;
}

function unpackDeanEdwards(packed) {
  var re = /\}\s*\(\s*'([\s\S]*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/;
  var m = re.exec(packed);
  if (!m) return packed;
  var payload = m[1], radix = parseInt(m[2], 10), symtab = m[4].split("|");
  var lookup = {};
  for (var i = 0; i < symtab.length; i++) {
    var key = baseEncode(i, radix);
    lookup[key] = symtab[i] ? symtab[i] : key;
  }
  var out = payload.replace(/\b\w+\b/g, function (w) {
    return Object.prototype.hasOwnProperty.call(lookup, w) ? lookup[w] : w;
  });
  return out.replace(/\\'/g, "'").replace(/\\"/g, '"');
}

// ---------- dc_ çözücü (QuickJS içinde eval) ----------
function decodeDc(scriptText) {
  var unpacked = unpackDeanEdwards(scriptText);
  var js = unpacked !== scriptText ? unpacked : scriptText;
  var names = ["so3", "h3o", "thl", "voz", "file_link"];
  var ge = eval; // dolaylı eval = global kapsam
  try { ge(JS_STUB); } catch (e) { log("stub hatası: " + e); }
  for (var i = 0; i < names.length; i++) { try { ge(names[i] + "=undefined"); } catch (e) {} }
  try { ge(js); } catch (e) { log("JS eval hatası: " + String(e).slice(0, 200)); }
  for (i = 0; i < names.length; i++) {
    try {
      var v = ge("typeof " + names[i] + "==='string'?" + names[i] + ":null");
      if (v && v.indexOf("http") === 0) return v;
    } catch (e) {}
  }
  var m = /sources\s*:\s*\[\s*\{\s*file\s*:\s*(\w+)\s*\}/.exec(scriptText) || /sources\s*:\s*\[\s*\{\s*file\s*:\s*(\w+)\s*\}/.exec(js);
  if (m) {
    try {
      var v2 = ge("typeof " + m[1] + "==='string'?" + m[1] + ":null");
      if (v2 && v2.indexOf("http") === 0) return v2;
    } catch (e) {}
  }
  return null;
}

// ---------- altyazı ----------
function cleanLabel(t) { try { return JSON.parse('"' + t + '"'); } catch (e) { return t; } }

function detectLang(label, url) {
  var c = (label + " " + url).toLowerCase();
  if (/türk|turk|turkish|tur/.test(c)) return ["Türkçe", "tr"];
  if (/ing|eng|english/.test(c)) return ["İngilizce", "en"];
  return [label, "tr"];
}

function extractSubs(script) {
  var subs = [];
  try {
    var tm = /tracks:\s*\[([\s\S]*?)\]/.exec(script);
    if (!tm) return subs;
    var raw = tm[1], m, re;
    re = /\{[^\}]*"file"\s*:\s*"([^"]+)"[^\}]*"label"\s*:\s*"([^"]+)"/g;
    while ((m = re.exec(raw))) {
      var f = m[1].replace(/\\\//g, "/"), d = detectLang(cleanLabel(m[2]), f);
      subs.push({ label: d[0], lang: d[1], forced: /forced|zorunlu/i.test(m[2] + f), url: urljoin(BASE, f) });
    }
    if (!subs.length) {
      re = /\{[^\}]*"label"\s*:\s*"([^"]+)"[^\}]*"file"\s*:\s*"([^"]+)"/g;
      while ((m = re.exec(raw))) {
        var f2 = m[2].replace(/\\\//g, "/"), d2 = detectLang(cleanLabel(m[1]), f2);
        subs.push({ label: d2[0], lang: d2[1], forced: /forced|zorunlu/i.test(m[1] + f2), url: urljoin(BASE, f2) });
      }
    }
  } catch (e) { log("altyazı hatası: " + e); }
  return subs;
}

// ---------- HTML ayrıştırma (BeautifulSoup yerine regex) ----------
function parseCandidates(html) {
  var cands = [], starts = [], m;
  var divRe = /<div[^>]*alternative-links[^>]*>/gi;
  while ((m = divRe.exec(html))) starts.push({ idx: m.index + m[0].length, tag: m[0] });
  for (var i = 0; i < starts.length; i++) {
    var end = i + 1 < starts.length ? starts[i + 1].idx : html.length;
    var lm = /data-lang="([^"]*)"/i.exec(starts[i].tag);
    var lang = lm ? lm[1].toUpperCase() : "";
    var region = html.slice(starts[i].idx, end);
    var bre = /<button([^>]*)>([\s\S]*?)<\/button>/gi, b;
    while ((b = bre.exec(region))) {
      if (!/class="[^"]*\balternative-link\b[^"]*"/i.test(b[1])) continue;
      var vid = /data-video="([^"]+)"/i.exec(b[1]);
      if (!vid) continue;
      var name = stripTags(b[2]).replace("(HDrip Xbet)", "").trim();
      cands.push({ name: (name + " " + lang).trim(), id: vid[1] });
    }
  }
  if (!cands.length) {
    var bre2 = /<button([^>]*data-video="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/gi, b2;
    while ((b2 = bre2.exec(html))) cands.push({ name: stripTags(b2[3]), id: b2[2] });
  }
  return cands;
}

function prio(n) {
  n = n.toLowerCase();
  if (n.indexOf("rapid") >= 0) return 1;
  if (n.indexOf("close") >= 0 || n.indexOf("mobi") >= 0) return 2;
  return 3;
}

function findIframe(apiText) {
  var m = /data-src=\\?"((?:[^"\\]|\\\/)+)\\?"/.exec(apiText);
  if (m) return m[1];
  var t = /<iframe[^>]*?(?:data-src|src)="([^"]+)"/i.exec(apiText);
  return t ? t[1] : "";
}

function resolve(req) {
  var slug = String(req.slug).replace(/^\/+|\/+$/g, "");
  var filmUrl = BASE + "/" + slug + "/";
  var r = host.fetch(filmUrl, { headers: { "Referer": BASE + "/", "User-Agent": UA }, timeout: 15 });
  if (r.status === 404) throw new Error("Film bulunamadı: " + filmUrl);
  if (r.status === 403 || r.status === 503) throw new Error("Cloudflare engeli (" + r.status + ")");

  var cands = parseCandidates(r.text);
  log("butonlar: " + cands.map(function (c) { return c.name; }).join(", "));
  cands = cands.map(function (c, i) { c.i = i; return c; })
    .sort(function (a, b) { return (prio(a.name) - prio(b.name)) || (a.i - b.i); });

  for (var ci = 0; ci < cands.length; ci++) {
    var item = cands[ci];
    try {
      var api = host.fetch(BASE + "/video/" + item.id + "/", {
        headers: { "Referer": filmUrl, "X-Requested-With": "fetch", "Accept": "application/json", "User-Agent": UA }, timeout: 12
      });
      var iframe = normalizeUrl(findIframe(api.text));
      if (!iframe) continue;

      var low = iframe.toLowerCase();
      if (low.indexOf("rapidrame") >= 0) {
        var rid = iframe.indexOf("?rapidrame_id=") >= 0 ? iframe.split("?rapidrame_id=").pop() : iframe.replace(/\/+$/, "").split("/").pop();
        rid = rid.split("?")[0].split("&")[0].replace(/^\/+|\/+$/g, "");
        iframe = BASE + "/rplayer/" + rid;
      } else if (iframe.indexOf("//") === 0) iframe = "https:" + iframe;
      else if (iframe.charAt(0) === "/") iframe = BASE + iframe;

      var ref = BASE + "/";
      var p = host.fetch(iframe, { headers: {
        "Referer": ref, "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8"
      }, timeout: 15 });
      var pt = p.text;
      if (pt.toLowerCase().indexOf("access denied") >= 0 && pt.length < 1000) continue;

      // 1) doğrudan m3u8/txt/mp4
      var dm = pt.match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|txt|mp4)(?:[^\s"'<>]*)?/g) || [];
      for (var k = 0; k < dm.length; k++) {
        var cu = normalizeUrl(dm[k]);
        if (/player|favicon|\.vtt|logo|poster/.test(cu)) continue;
        if (!/\/hls|\/hls2|master|\/txt\//.test(cu)) continue;
        return done(cu, ref, extractSubs(pt), item.name);
      }

      // 2) packed script -> JS motoru
      var scripts = [], sre = /<script[^>]*>([\s\S]*?)<\/script>/gi, sm;
      while ((sm = sre.exec(pt))) scripts.push(sm[1]);
      for (var s = 0; s < scripts.length; s++) {
        var sc = scripts[s];
        if (sc.indexOf("sources:") < 0 && sc.indexOf("dc_") < 0 && sc.indexOf("eval(function") < 0) continue;
        var link = decodeDc(sc);
        if (link && link.indexOf("http") >= 0) return done(link, ref, extractSubs(sc), item.name);
      }
    } catch (e) { log("[" + item.name + "] hata: " + e); }
  }
  throw new Error("Hiçbir kaynaktan link çözülemedi.");
}

function done(url, ref, subs, name) {
  var ttl = 3 * 3600;
  var em = /[?&]e=(\d+)/.exec(url);
  if (em) ttl = Math.max(600, parseInt(em[1], 10) - Math.floor(Date.now() / 1000) - 600);
  return { url: url, referer: ref, subs: subs, name: name, ttl: ttl, subsMode: "segmented" };
}
