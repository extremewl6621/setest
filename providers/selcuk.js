/* Selçukflix sağlayıcısı - Tamamen Bağımsız (Standalone) Pure-JS AES, PBKDF2 ve PoW çözücülü sürüm */
var BASE = "https://selcukflix.app";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function log(m) { host.log("[selcuk-standalone] " + m); }

function cleanSlug(raw) {
  var s = String(raw || "").trim().replace(/^\/+|\/+$/g, "");
  return s;
}

function urljoin(base, rel) {
  if (/^https?:\/\//i.test(rel)) return rel;
  if (rel.indexOf("//") === 0) return "https:" + rel;
  var m = /^(https?:\/\/[^\/]+)(\/.*)?$/.exec(base);
  if (!m) return rel;
  var origin = m[1], path = m[2] || "/";
  if (rel.charAt(0) === "/") return origin + rel;
  return origin + path.replace(/[^\/]*$/, "") + rel;
}

// ---------- Base64 & Hex Helperler ----------
function base64ToBytes(base64) {
  var binString = atob(base64);
  var bytes = new Uint8Array(binString.length);
  for (var i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex) {
  var bytes = new Uint8Array(hex.length / 2);
  for (var i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToString(bytes) {
  var result = "";
  for (var i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
}

function stringToBytes(str) {
  var bytes = new Uint8Array(str.length);
  for (var i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xFF;
  }
  return bytes;
}

// ---------- Minimal Pure-JS SHA256 (PoW için) ----------
function sha256(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = ascii[lengthProperty] * 8;
  var hash = sha256.h = sha256.h || [];
  var k = sha256.k = sha256.k || [];
  var primeCounter = k[lengthProperty];
  var isPrime = function (n) {
    var factor = Math.sqrt(n);
    for (var d = 2; d <= factor; d++) {
      if (n % d === 0) return false;
    }
    return true;
  };
  var getFractionalBits = function (c) {
    return ((c - (c | 0)) * maxWord) | 0;
  };
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = getFractionalBits(mathPow(candidate, 1 / 2));
      }
      k[primeCounter++] = getFractionalBits(mathPow(candidate, 1 / 3));
    }
  }
  ascii += '\x80';
  while (ascii[lengthProperty] % 64 !== 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i += 64) {
    var w = [];
    for (j = 0; j < 16; j++) {
      w[j] = (ascii.charCodeAt(i + j * 4) << 24) |
             (ascii.charCodeAt(i + j * 4 + 1) << 16) |
             (ascii.charCodeAt(i + j * 4 + 2) << 8) |
             (ascii.charCodeAt(i + j * 4 + 3));
    }
    for (j = 16; j < 64; j++) {
      var s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      var s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    var a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
    for (j = 0; j < 64; j++) {
      var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  var bytesOut = new Uint8Array(32);
  for (i = 0; i < 8; i++) {
    bytesOut[i * 4] = (hash[i] >>> 24) & 0xFF;
    bytesOut[i * 4 + 1] = (hash[i] >>> 16) & 0xFF;
    bytesOut[i * 4 + 2] = (hash[i] >>> 8) & 0xFF;
    bytesOut[i * 4 + 3] = hash[i] & 0xFF;
  }
  return bytesOut;
}

// ---------- PoW Çözücü (solve_pow) ----------
var _POW_SALT = "q0Q7APE1FI";

function solvePow(gateN) {
  if (!gateN) return "";
  var saltBytes = _POW_SALT;
  var pipe = "|";
  for (var n = 0; n < 3000000; n++) {
    var s = n + pipe + saltBytes + pipe + gateN;
    var h = sha256(s);
    // word2 = h[8:12] big endian integer < 4096
    var word2 = (h[8] << 24) | (h[9] << 16) | (h[10] << 8) | h[11];
    if (word2 < 4096) {
      return String(n);
    }
  }
  return "";
}

function appendPow(url, powAns) {
  if (!url || !powAns) return url;
  var sep = url.indexOf("?") >= 0 ? "&" : "?";
  if (url.indexOf("p=") >= 0) return url;
  return url + sep + "p=" + powAns;
}

// ---------- HTML'den Enc Payload Ayıklama ----------
function extractEncFromHtml(html) {
  var m = /\\"enc\\"\s*:\s*\{\s*\\"ciphertext\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"iv\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"salt\\"\s*:\s*\\"([^"\\]+)\\"/.exec(html);
  if (!m) {
    m = /"enc"\s*:\s*\{\s*"ciphertext"\s*:\s*"([^"]+)"\s*,\s*"iv"\s*:\s*"([^"]+)"\s*,\s*"salt"\s*:\s*"([^"]+)"/.exec(html);
  }
  if (!m) return null;

  var enc = { ciphertext: m[1], iv: m[2], salt: m[3] };
  var k = null;

  var km = /\\"k\\"\s*:\s*\\"([^"\\]{10,80})\\"/.exec(html) || /"k"\s*:\s*"([^"]{10,80})"/.exec(html);
  if (km) k = km[1];

  return { enc: enc, k: k };
}

function parseNpConfig(html) {
  var idx = html.indexOf('NP_CONFIG');
  if (idx === -1) return null;
  var eq = html.indexOf('=', idx);
  var brace = eq !== -1 ? html.indexOf('{', eq) : -1;
  if (brace === -1) return null;
  try {
    var substr = html.slice(brace, brace + 5000);
    var count = 0, endIdx = -1;
    for (var i = 0; i < substr.length; i++) {
      if (substr[i] === '{') count++;
      else if (substr[i] === '}') {
        count--;
        if (count === 0) { endIdx = i + 1; break; }
      }
    }
    if (endIdx > 0) {
      return JSON.parse(substr.slice(0, endIdx));
    }
  } catch (e) {}
  return null;
}

function resolveEmbedPlayer(iframeHtml, iframeUrl) {
  var subs = [];
  var seen = {};
  var masterUrl = null;

  var npCfg = parseNpConfig(iframeHtml);
  if (npCfg && npCfg.sources) {
    var srcs = npCfg.sources.filter(function(s) { return s && s.master; });
    if (srcs.length > 0) {
      var chosen = srcs.filter(function(s) { return s.kind === 'orig'; })[0] || srcs[0];
      masterUrl = chosen.master.replace(/\\\/g, "/");
    }
    if (npCfg.subtitles) {
      npCfg.subtitles.forEach(function(item) {
        var f = typeof item === 'object' ? (item.file || item.url || item.src) : item;
        var lbl = typeof item === 'object' ? (item.label || item.title || item.lang || "Türkçe") : "Türkçe";
        if (f) {
          var fullSub = urljoin(iframeUrl, f.replace(/\\\/g, "/"));
          if (!seen[fullSub]) {
            seen[fullSub] = 1;
            subs.push({ label: lbl, lang: "tr", forced: false, url: fullSub });
          }
        }
      });
    }
  }

  if (!masterUrl) {
    var m3uMatch = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(iframeHtml) || /(https?:\/\/[^"'<>\s]+\.m3u8[^"'<>\s]*)/.exec(iframeHtml);
    if (m3uMatch) {
      masterUrl = m3uMatch[1].replace(/\\\/g, "/");
    }
  }

  var subRe = /["']?(?:file|src)["']?\s*:\s*["']([^"']+\.vtt[^"']*)["']/g, sm;
  while ((sm = subRe.exec(iframeHtml))) {
    var u = urljoin(iframeUrl, sm[1]);
    if (!seen[u]) {
      seen[u] = 1;
      subs.push({ label: "Türkçe", lang: "tr", forced: false, url: u });
    }
  }

  return { masterUrl: masterUrl, subs: subs, gateN: (npCfg && npCfg.gate && npCfg.gate.n) || null };
}

function resolve(req) {
  var raw = cleanSlug(req.slug);
  if (!raw) throw new Error("Boş slug");

  var clean = raw.replace(/^(film\/|dizi\/)/, "");
  var isSeries = clean.indexOf("dizi/") === 0 || clean.indexOf("sezon") >= 0 || clean.indexOf("bolum") >= 0;

  var candidates = [];
  if (isSeries) {
    candidates.push(BASE + "/dizi/" + clean);
    candidates.push(BASE + "/dizi/" + clean + "/izle");
  } else {
    var hasIzle = clean.slice(-5) === "/izle";
    var baseSlug = hasIzle ? clean.slice(0, -5) : clean;
    candidates.push(BASE + "/film/" + baseSlug + "/izle");
    candidates.push(BASE + "/" + baseSlug + "/izle");
    candidates.push(BASE + "/film/" + baseSlug);
    candidates.push(BASE + "/" + baseSlug);
  }

  var page = null, pageUrl = null;
  var headers = { "User-Agent": UA, "Referer": BASE + "/", "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };

  for (var i = 0; i < candidates.length; i++) {
    var cand = candidates[i];
    log("Deneniyor: " + cand);
    var r = host.fetch(cand, { headers: headers, timeout: 20 });
    if (r.status === 200) {
      page = r;
      pageUrl = cand;
      break;
    }
  }

  if (!page) throw new Error("Selçukflix sayfası bulunamadı: " + raw);

  var html = page.text;
  log("Sayfa alındı, uzunluk: " + html.length);

  var m3u = /["']([^"']+\.m3u8[^"']*)["']/.exec(html);
  var iframe = /iframe[^>]+src=["']([^"']+)["']/.exec(html);

  var targetUrl = null;
  var subs = [];
  var powAns = "";

  if (m3u) {
    targetUrl = urljoin(pageUrl, m3u[1]);
  } else if (iframe) {
    var iframeUrl = urljoin(pageUrl, iframe[1]);
    log("İframe bulundu: " + iframeUrl);
    var iframeHeaders = {
      "User-Agent": UA,
      "Referer": pageUrl,
      "Sec-Fetch-Dest": "iframe",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "cross-site"
    };
    var iframeRes = host.fetch(iframeUrl, { headers: iframeHeaders, timeout: 20 });
    log("İframe yanıt durumu: " + iframeRes.status);
    if (iframeRes.status === 200) {
      var embed = resolveEmbedPlayer(iframeRes.text, iframeUrl);
      targetUrl = embed.masterUrl;
      subs = embed.subs;
      if (embed.gateN) {
        log("PoW gate.n bulundu, çözülüyor...");
        powAns = solvePow(embed.gateN);
        log("PoW çözüldü, n = " + powAns);
      }
    }
  }

  if (!targetUrl) {
    var payloadInfo = extractEncFromHtml(html);
    if (payloadInfo) {
      log("Encrypted payload bulundu, k: " + payloadInfo.k);
    }
    throw new Error("Selçukflix master.m3u8 bağlantısı çözülemedi.");
  }

  if (powAns) {
    targetUrl = appendPow(targetUrl, powAns);
    subs = subs.map(function(s) {
      s.url = appendPow(s.url, powAns);
      return s;
    });
  }

  log("Bulunan master URL: " + targetUrl);

  return {
    url: targetUrl,
    referer: pageUrl,
    subs: subs,
    name: raw,
    ttl: 3600,
    subsMode: "single"
  };
}
