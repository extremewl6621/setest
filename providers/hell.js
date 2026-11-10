/* FilmizleHell (playturka)  —  filmizlehell.py'nin JS karşılığı
 * Link: /hell/stream?film=film/4109-ali-g-ben-kimim-izle
 */
var SITE = L.base("https://filmizlehell.net");
var BASE = "https://p.playturka.space";
var SITE_KEY_DEFAULT = "site_CU4xULeVJUTX6XKl";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
var SUB_LANGS = ["tr", "en"], LANG_LABELS = { tr: "Türkçe", en: "İngilizce" };
var AUDIO_PLAYLISTS = [["audio0", "tr", "Türkçe", "playlist_aud0.m3u8"], ["audio1", "es", "İspanyolca", "playlist_aud1.m3u8"]];
function log(m) { host.log("[hell] " + m); }

var PAIRS = "AZ BY CX DW EV FU GT HS IR JQ KP LO MN NM OL PK ZA YB XC WD VE UF TG SH RI QJ az by cx dw ev fu gt hs ir jq kp lo mn nm ol pk za yb xc wd ve uf tg sh ri qj 05 16 27 38 49 50 61 72 83 94 +- /_ -+ _/".split(" ");
var REV = {}; PAIRS.forEach(function (p) { REV[p.charAt(1)] = p.charAt(0); });

function decrypt(enc) {
  if (!enc || typeof enc !== "string") return null;
  var s = enc.trim().split("").map(function (c) { return REV.hasOwnProperty(c) ? REV[c] : c; }).join("");
  try { return JSON.parse(L.b64decode(L.padB64(s))); } catch (e) { return null; }
}
function uuid() { return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.floor(Math.random() * 16); return (c === "x" ? r : (r & 3) | 8).toString(16); }); }
function hdr() { return { "User-Agent": UA, "Referer": BASE + "/", "Accept": "*/*" }; }
function expOf(u) { var m = /[?&]exp=(\d+)/.exec(u || ""); return m ? parseInt(m[1], 10) : 0; }
function dirOf(u) { return u.split("?")[0].replace(/[^\/]*$/, ""); }

function masterFromApi(d) {
  if (!d || typeof d !== "object") return null;
  var files = d.files || {}, ks = ["masterUrl", "master_url", "url", "video_url"];
  for (var i = 0; i < ks.length; i++) { var v = files[ks[i]] || d[ks[i]]; if (typeof v === "string" && v.indexOf("master.m3u8") >= 0) return v; }
  var stack = [d];
  while (stack.length) {
    var cur = stack.pop();
    if (cur && typeof cur === "object") { for (var k in cur) stack.push(cur[k]); }
    else if (typeof cur === "string" && cur.indexOf("master.m3u8") >= 0) return cur;
  }
  return null;
}

function signedMaster(id, visitor, site) {
  var url = BASE + "/api/video-url?id=" + id + "&visitor_id=" + encodeURIComponent(visitor) + "&site_key=" + encodeURIComponent(site);
  var r = host.fetch(url, { headers: { "User-Agent": UA, "Referer": BASE + "/", "Origin": BASE, "Accept": "application/json, text/plain, */*" }, timeout: 15 });
  if (r.status === 200) {
    var d = decrypt(r.text); if (!d) { try { d = JSON.parse(r.text); } catch (e) {} }
    var u = masterFromApi(d); if (u) return u;
  } else log("video-url API " + r.status);
  var r2 = host.fetch(BASE + "/videos/" + id + "/master.m3u8", { headers: hdr(), timeout: 15 });
  if (r2.text.indexOf("#EXTM3U") >= 0 && (r2.url || "").indexOf("token=") >= 0) return r2.url;
  return null;
}

function reachable(url) {
  try { var h = hdr(); h["Range"] = "bytes=0-64"; var r = host.fetch(url, { headers: h, timeout: 8 }); return (r.status === 200 || r.status === 206) && r.text.indexOf("#EXTM3U") >= 0; } catch (e) { return false; }
}

function resolve(req) {
  var film = String(req.slug).replace(/^\/+/, "");
  var filmUrl = film.indexOf("http") === 0 ? film : SITE + "/" + film;
  var r = host.fetch(filmUrl, { headers: hdr(), timeout: 15 });
  if (r.status !== 200) throw new Error("sayfa çekilemedi: HTTP " + r.status);
  var vm = /activeSource:\s*'https:\/\/p\.playturka\.space\/#([A-Za-z0-9_-]+)'/.exec(r.text);
  if (!vm) throw new Error("video id bulunamadı (activeSource yok)");
  var id = vm[1];
  var vc = /am_visitor_id=([^;"'\s]+)/.exec(r.text), visitor = vc ? vc[1] : uuid();
  var sk = /site_key=([A-Za-z0-9_]+)/.exec(r.text), site = sk ? sk[1] : SITE_KEY_DEFAULT;

  var signed = signedMaster(id, visitor, site), videosBase = BASE + "/videos/" + id + "/", text, variantBase, audioBase = videosBase;
  if (signed) { text = host.fetch(signed, { headers: hdr(), timeout: 15 }).text; variantBase = dirOf(signed); }
  else {
    var fr = host.fetch(videosBase + "master.m3u8", { headers: hdr(), timeout: 15 });
    signed = fr.url || (videosBase + "master.m3u8"); text = fr.text; variantBase = dirOf(signed);
  }
  if (text.indexOf("#EXTM3U") < 0) throw new Error("master alınamadı");

  var hasAudio = text.indexOf("#EXT-X-MEDIA:TYPE=AUDIO") >= 0, usable = [];
  if (!hasAudio) for (var a = 0; a < AUDIO_PLAYLISTS.length; a++) { var u = L.urljoin(audioBase, AUDIO_PLAYLISTS[a][3]); if (reachable(u)) usable.push([AUDIO_PLAYLISTS[a][0], AUDIO_PLAYLISTS[a][1], AUDIO_PLAYLISTS[a][2], u]); }

  var out = text.split(/\r?\n/).map(function (line) {
    if (line.indexOf("#EXT-X-MEDIA") === 0 && line.indexOf('URI="') >= 0) return line.replace(/URI="([^"]+)"/, function (_, p) { return 'URI="' + L.urljoin(audioBase, p) + '"'; });
    if (line.indexOf("#EXT-X-STREAM-INF") === 0) return usable.length && line.indexOf('AUDIO="') < 0 ? line.replace(/,$/, "") + ',AUDIO="' + usable[0][0] + '"' : line;
    if (line && line.charAt(0) !== "#") return L.urljoin(variantBase, line.trim());
    return line;
  });
  if (usable.length) {
    var al = usable.map(function (x) { return '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="' + x[0] + '",NAME="' + x[2] + '",DEFAULT=' + (x[1] === "tr" ? "YES" : "NO") + ',AUTOSELECT=YES,LANGUAGE="' + x[1] + '",URI="' + x[3] + '"'; });
    var at = out.length && out[0].indexOf("#EXTM3U") === 0 ? 1 : 0;
    out = out.slice(0, at).concat(al, out.slice(at));
  }
  var subs = [];
  for (var s = 0; s < SUB_LANGS.length; s++) {
    var su = videosBase + "subtitles/" + SUB_LANGS[s] + ".vtt";
    try { var h = hdr(); h["Range"] = "bytes=0-32"; var sr = host.fetch(su, { headers: h, timeout: 8 });
      if ((sr.status === 200 || sr.status === 206) && sr.text.trim().toUpperCase().indexOf("WEBVTT") === 0) subs.push({ label: LANG_LABELS[SUB_LANGS[s]], lang: SUB_LANGS[s], forced: false, url: su }); } catch (e) {}
  }
  var exp = expOf(signed), ttl = exp ? Math.max(120, exp - Math.floor(Date.now() / 1000) - 60) : 3600;
  log(id + ": " + subs.length + " altyazı, " + (usable.length ? usable.length + " ek ses" : "ses master'da"));
  return { url: signed, master: out.join("\n"), referer: BASE + "/", subs: subs, name: id, ttl: ttl, subsMode: "segmented" };
}
