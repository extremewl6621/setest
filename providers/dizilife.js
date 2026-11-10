/* DiziLife (dizi72.life)  —  dizilife.py'nin JS karşılığı
 * Link: /dizilife/stream?film=dizi/<ana-slug>/sezon/1/bolum/2   (ya da tam sayfa adresi)
 */
var BASE = "https://dizi72.life";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";

function playerUrl(html) {
  var pats = [/<iframe[^>]+src=["']([^"']+player\/[^"']+)["']/i, /(https?:\/\/[a-z0-9]+\.xyz\/player\/[A-Za-z0-9_-]+)/i,
    /(https?:\/\/[^"']+\/player\/[A-Za-z0-9_-]+)/i, /data-player=["']([^"']+)["']/i, /<a[^>]+href=["']([^"']+player\/[^"']+)["']/i];
  for (var i = 0; i < pats.length; i++) { var m = pats[i].exec(html); if (m) return m[1]; }
  var all = html.match(/href=["']([^"']+)["']/g) || [];
  for (var j = 0; j < all.length; j++) { var l = all[j].replace(/^href=["']|["']$/g, ""); if (l.indexOf("/player/") >= 0 && l.indexOf("http") === 0) return l; }
  return null;
}

function resolve(req) {
  var p = String(req.slug).trim().replace(/^\/+/, "");
  var url = p.indexOf("http") === 0 ? p : (/^(dizi|film)\//.test(p) ? BASE + "/" + p : BASE + "/dizi/" + p);
  var r = host.fetch(url, { headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8", "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8", "Referer": BASE }, timeout: 30 });
  if (r.status !== 200) throw new Error("Bölüm sayfası " + r.status);
  var pu = playerUrl(r.text);
  if (!pu) throw new Error("Player URL bulunamadı");
  var tm = /\/player\/([A-Za-z0-9_-]+)/.exec(pu) || /\.click\/([A-Za-z0-9_-]+)\//.exec(pu);
  if (!tm) throw new Error("Token çıkarılamadı");
  host.log("[dizilife] token " + tm[1]);
  return { url: "https://one.82b6b2a6748f1e.click/" + tm[1] + "/master.m3u8", referer: pu.replace(/\/[^\/]*$/, "/"), subs: [], name: "dizilife", ttl: 6 * 3600 };
}
