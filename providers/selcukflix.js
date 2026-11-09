/* Selçukflix sağlayıcısı  (selcukflix.py'nin JS karşılığı)
 * Akış: film/dizi sayfası -> enc (AES-CBC/PBKDF2) decrypt -> iframe -> NP_CONFIG / source2.php / packer
 * -> master.m3u8 + altyazılar (TR Forced / EN Forced / TR / EN sırası korunur)
 *
 * NOT: Host tarafı /stream /fetch /subs /subs_playlist route'larını zaten yapıyor.
 * Bu dosya sadece resolve() sözleşmesini karşılar.
 */
var BASE = "https://selcukflix.app";
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";
// Pichive/CDN için cf_clearance cookie'si (opsiyonel). Host bunu override edebilir.
var CF_CLEARANCE = "";

function log(m) { host.log("[selcukflix] " + m); }

// ---------- Yardımcılar ----------

function normalizeUrl(u) {
  if (!u) return u;
  return String(u).replace(/\\\//g, "/").replace(/\\/g, "").replace(/^['"]|['"]$/g, "").trim();
}

function urljoin(base, rel) {
  if (!rel) return rel;
  rel = normalizeUrl(rel);
  if (/^https?:\/\//i.test(rel)) return rel;
  if (rel.indexOf("//") === 0) return "https:" + rel;
  var m = /^(https?:\/\/[^\/]+)(\/.*)?$/.exec(base);
  if (!m) return rel;
  var origin = m[1], path = m[2] || "/";
  if (rel.charAt(0) === "/") return origin + rel;
  return origin + path.replace(/[^\/]*$/, "") + rel;
}

function b64ToBytes(s) {
  // Standart base64 (atob host'ta var mı bilinmiyor -> saf JS)
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  s = String(s).replace(/=+$/, "").replace(/[^A-Za-z0-9+/]/g, "");
  var out = [];
  var buf = 0, bits = 0;
  for (var i = 0; i < s.length; i++) {
    var v = chars.indexOf(s.charAt(i));
    if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xff); }
  }
  return out;
}

function bytesToUtf8(bytes) {
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xC0) { /* skip */ }
    else if (b < 0xE0) { out += String.fromCharCode(((b & 0x1F) << 6) | (bytes[++i] & 0x3F)); }
    else if (b < 0xF0) { out += String.fromCharCode(((b & 0x0F) << 12) | ((bytes[++i] & 0x3F) << 6) | (bytes[++i] & 0x3F)); }
    else {
      var cp = ((b & 0x07) << 18) | ((bytes[++i] & 0x3F) << 12) | ((bytes[++i] & 0x3F) << 6) | (bytes[++i] & 0x3F);
      cp -= 0x10000;
      out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF));
    }
  }
  return out;
}

function hexToBytes(h) {
  h = String(h).replace(/[^0-9a-fA-F]/g, "");
  var out = [];
  for (var i = 0; i + 1 < h.length; i += 2) out.push(parseInt(h.substr(i, 2), 16));
  return out;
}

function utf8Bytes(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); }
    else if (c < 0xD800 || c >= 0xE000) { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F)); }
    else { /* surrogate pair */ var c2 = s.charCodeAt(++i); var cp = 0x10000 + (((c & 0x3FF) << 10) | (c2 & 0x3FF)); out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)); }
  }
  return out;
}

// ---------- SHA-512 (saf JS) ----------
var SHA512_K = [
  0x428a2f98,0xd728ae22,0x71374491,0x23ef65cd,0xb5c0fbcf,0xec4d3b2f,0xe9b5dba5,0x8189dbbc,
  0x3956c25b,0xf348b538,0x59f111f1,0xb605d019,0x923f82a4,0xaf194f9b,0xab1c5ed5,0xda6d8118,
  0xd807aa98,0xa3030242,0x12835b01,0x45706fbe,0x243185be,0x4ee4b28c,0x550c7dc3,0xd5ffb4e2,
  0x72be5d74,0xf27b896f,0x80deb1fe,0x3b1696b1,0x9bdc06a7,0x25c71235,0xc19bf174,0xcf692694,
  0xe49b69c1,0x9ef14ad2,0xefbe4786,0x384f25e3,0x0fc19dc6,0x8b8cd5b5,0x240ca1cc,0x77ac9c65,
  0x2de92c6f,0x592b0275,0x4a7484aa,0x6ea6e483,0x5cb0a9dc,0xbd41fbd4,0x76f988da,0x831153b5,
  0x983e5152,0xee66dfab,0xa831c66d,0x2db43210,0xb00327c8,0x98fb213f,0xbf597fc7,0xbeef0ee4,
  0xc6e00bf3,0x3da88fc2,0xd5a79147,0x930aa725,0x06ca6351,0xe003826f,0x14292967,0x0a0e6e70,
  0x27b70a85,0x46d22ffc,0x2e1b2138,0x5c26c926,0x4d2c6dfc,0x5ac42aed,0x53380d13,0x9d95b3df,
  0x650a7354,0x8baf63de,0x766a0abb,0x3c77b2a8,0x81c2c92e,0x47edaee6,0x92722c85,0x1482353b,
  0xa2bfe8a1,0x4cf10364,0xa81a664b,0xbc423001,0xc24b8b70,0xd0f89791,0xc76c51a3,0x0654be30,
  0xd192e819,0xd6ef5218,0xd6990624,0x5565a910,0xf40e3585,0x5771202a,0x106aa070,0x32bbd1b8,
  0x19a4c116,0xb8d2d0c8,0x1e376c08,0x5141ab53,0x2748774c,0xdf8eeb99,0x34b0bcb5,0xe19b48a8,
  0x391c0cb3,0xc5c95a63,0x4ed8aa4a,0xe3418acb,0x5b9cca4f,0x7763e373,0x682e6ff3,0xd6b2b8a3,
  0x748f82ee,0x5defb2fc,0x78a5636f,0x43172f60,0x84c87814,0xa1f0ab72,0x8cc70208,0x1a6439ec,
  0x90befffa,0x23631e28,0xa4506ceb,0xde82bde9,0xbef9a3f7,0xb2c67915,0xc67178f2,0xe372532b,
  0xca273ece,0xea26619c,0xd186b8c7,0x21c0c207,0xeada7dd6,0xcde0eb1e,0xf57d4f7f,0xee6ed178,
  0x06f067aa,0x72176fba,0x0a637dc5,0xa2c898a6,0x113f9804,0xbef90dae,0x1b710b35,0x131c471b,
  0x28db77f5,0x23047d84,0x32caab7b,0x40c72493,0x3c9ebe0a,0x15c9bebc,0x431d67c4,0x9c100d4c,
  0x4cc5d4be,0xcb3e42b6,0x597f299c,0xfc657e2a,0x5fcb6fab,0x3ad6faec,0x6c44198c,0x4a475817
];
function _u64(h, l) { return [h >>> 0, l >>> 0]; }
function _add64(a, b) {
  var lo = (a[1] + b[1]) >>> 0;
  var carry = lo < a[1] ? 1 : 0;
  return [ (a[0] + b[0] + carry) >>> 0, lo ];
}
function _rotr64(x, n) {
  var h = x[0], l = x[1];
  if (n < 32) return [ ((h >>> n) | (l << (32 - n))) >>> 0, ((l >>> n) | (h << (32 - n))) >>> 0 ];
  n -= 32;
  return [ ((l >>> n) | (h << (32 - n))) >>> 0, ((h >>> n) | (l << (32 - n))) >>> 0 ];
}
function sha512(bytes) {
  var H = [
    [0x6a09e667,0xf3bcc908],[0xbb67ae85,0x84caa73b],[0x3c6ef372,0xfe94f82b],[0xa54ff53a,0x5f1d36f1],
    [0x510e527f,0xade682d1],[0x9b05688c,0x2b3e6c1f],[0x1f83d9ab,0xfb41bd6b],[0x5be0cd19,0x137e2179]
  ];
  var msg = bytes.slice();
  var bitLenHi = Math.floor((msg.length * 8) / 0x100000000);
  var bitLenLo = (msg.length * 8) >>> 0;
  msg.push(0x80);
  while ((msg.length % 128) !== 112) msg.push(0);
  // 128-bit length (üst 64 sıfır, alt 64 bit uzunluk)
  for (var i = 0; i < 8; i++) msg.push(0);
  for (i = 0; i < 4; i++) msg.push((bitLenHi >>> (24 - i * 8)) & 0xFF);
  for (i = 0; i < 4; i++) msg.push((bitLenLo >>> (24 - i * 8)) & 0xFF);

  var W = new Array(80);
  for (var off = 0; off < msg.length; off += 128) {
    for (var t = 0; t < 16; t++) {
      W[t] = [
        (msg[off + t * 8] << 24) | (msg[off + t * 8 + 1] << 16) | (msg[off + t * 8 + 2] << 8) | msg[off + t * 8 + 3],
        (msg[off + t * 8 + 4] << 24) | (msg[off + t * 8 + 5] << 16) | (msg[off + t * 8 + 6] << 8) | msg[off + t * 8 + 7]
      ];
      W[t][0] = W[t][0] >>> 0; W[t][1] = W[t][1] >>> 0;
    }
    for (t = 16; t < 80; t++) {
      var s0 = (function (x) {
        var a = _rotr64(x, 1), b = _rotr64(x, 8), c = [ x[0] >>> 7, (x[1] >>> 7) | (x[0] << 25) ];
        return [ (a[0] ^ b[0] ^ (c[0] >>> 0)) >>> 0, (a[1] ^ b[1] ^ (c[1] >>> 0)) >>> 0 ];
      })(W[t - 15]);
      var s1 = (function (x) {
        var a = _rotr64(x, 19), b = _rotr64(x, 61), c = [ (x[0] >>> 6) | (x[1] << 26), (x[1] >>> 6) | (x[0] << 26) ];
        return [ (a[0] ^ b[0] ^ (c[0] >>> 0)) >>> 0, (a[1] ^ b[1] ^ (c[1] >>> 0)) >>> 0 ];
      })(W[t - 2]);
      var w15 = W[t - 15], w2 = W[t - 2];
      var w16 = W[t - 16], w7 = W[t - 7];
      W[t] = _add64(_add64(_add64(s1, w7), s0), w16);
    }
    var a = H[0].slice(), b = H[1].slice(), c = H[2].slice(), d = H[3].slice();
    var e = H[4].slice(), f = H[5].slice(), g = H[6].slice(), h = H[7].slice();
    for (t = 0; t < 80; t++) {
      var S1 = (function (x) {
        var r1 = _rotr64(x, 14), r2 = _rotr64(x, 18), r3 = _rotr64(x, 41);
        return [ (r1[0] ^ r2[0] ^ r3[0]) >>> 0, (r1[1] ^ r2[1] ^ r3[1]) >>> 0 ];
      })(e);
      var ch = [ ((e[0] & f[0]) ^ (~e[0] & g[0])) >>> 0, ((e[1] & f[1]) ^ (~e[1] & g[1])) >>> 0 ];
      var K = [ SHA512_K[t * 2], SHA512_K[t * 2 + 1] ];
      var t1 = _add64(_add64(_add64(h, S1), ch), K);
      t1 = _add64(t1, W[t]);
      var S0 = (function (x) {
        var r1 = _rotr64(x, 28), r2 = _rotr64(x, 34), r3 = _rotr64(x, 39);
        return [ (r1[0] ^ r2[0] ^ r3[0]) >>> 0, (r1[1] ^ r2[1] ^ r3[1]) >>> 0 ];
      })(a);
      var maj = [ ((a[0] & b[0]) ^ (a[0] & c[0]) ^ (b[0] & c[0])) >>> 0, ((a[1] & b[1]) ^ (a[1] & c[1]) ^ (b[1] & c[1])) >>> 0 ];
      var t2 = _add64(S0, maj);
      h = g; g = f; f = e;
      e = _add64(d, t1);
      d = c; c = b; b = a;
      a = _add64(t1, t2);
    }
    H[0] = _add64(H[0], a); H[1] = _add64(H[1], b); H[2] = _add64(H[2], c); H[3] = _add64(H[3], d);
    H[4] = _add64(H[4], e); H[5] = _add64(H[5], f); H[6] = _add64(H[6], g); H[7] = _add64(H[7], h);
  }
  var out = [];
  for (var j = 0; j < 8; j++) {
    out.push((H[j][0] >>> 24) & 0xFF, (H[j][0] >>> 16) & 0xFF, (H[j][0] >>> 8) & 0xFF, H[j][0] & 0xFF);
    out.push((H[j][1] >>> 24) & 0xFF, (H[j][1] >>> 16) & 0xFF, (H[j][1] >>> 8) & 0xFF, H[j][1] & 0xFF);
  }
  return out;
}

// ---------- HMAC-SHA512 ----------
function hmacSha512(key, data) {
  var blockSize = 128;
  if (key.length > blockSize) key = sha512(key);
  while (key.length < blockSize) key.push(0);
  var oKey = [], iKey = [];
  for (var i = 0; i < blockSize; i++) { oKey.push(key[i] ^ 0x5c); iKey.push(key[i] ^ 0x36); }
  return sha512(oKey.concat(sha512(iKey.concat(data))));
}

// ---------- PBKDF2-HMAC-SHA512 ----------
function pbkdf2Sha512(password, salt, iterations, dkLen) {
  var pass = utf8Bytes(password);
  var block = salt.slice();
  // block index = 1 (big-endian uint32)
  block.push(0, 0, 0, 1);
  var u = hmacSha512(pass, block);
  var result = u.slice();
  for (var i = 1; i < iterations; i++) {
    u = hmacSha512(pass, u);
    for (var j = 0; j < result.length; j++) result[j] ^= u[j];
  }
  return result.slice(0, dkLen);
}

// ---------- AES-CBC decrypt (saf JS, 128/256) ----------
var AES_SBOX = null, AES_INV_SBOX = null;
function initAesTables() {
  if (AES_SBOX) return;
  AES_SBOX = new Array(256); AES_INV_SBOX = new Array(256);
  var p = 1, q = 1;
  do {
    p = (p ^ (p << 1) ^ (p & 0x80 ? 0x1B : 0)) & 0xFF;
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xFF;
    if (q & 0x80) q ^= 0x09;
    var x = q ^ ((q << 1) | (q >> 7)) ^ ((q << 2) | (q >> 6)) ^ ((q << 3) | (q >> 5)) ^ ((q << 4) | (q >> 4));
    x = (x ^ 0x63) & 0xFF;
    AES_SBOX[p] = x; AES_INV_SBOX[x] = p;
  } while (p !== 1);
}
function _xtime(a) { a <<= 1; return a & 0x100 ? (a ^ 0x1B) & 0xFF : a; }
function _mul(a, b) {
  var r = 0;
  while (b) { if (b & 1) r ^= a; a = _xtime(a); b >>= 1; }
  return r & 0xFF;
}
function _expandKey(key) {
  initAesTables();
  var Nk = key.length / 4, Nr = Nk + 6;
  var w = new Array(4 * (Nr + 1));
  for (var i = 0; i < Nk; i++) w[i] = [key[4*i], key[4*i+1], key[4*i+2], key[4*i+3]];
  var rcon = 1;
  for (i = Nk; i < 4 * (Nr + 1); i++) {
    var t = w[i - 1].slice();
    if (i % Nk === 0) {
      t.push(t.shift());
      t = t.map(function(b){ return AES_SBOX[b]; });
      t[0] ^= rcon;
      rcon = _xtime(rcon);
    } else if (Nk > 6 && i % Nk === 4) {
      t = t.map(function(b){ return AES_SBOX[b]; });
    }
    w[i] = w[i - Nk].map(function(b, k){ return b ^ t[k]; });
  }
  return { w: w, Nr: Nr };
}
function _addRoundKey(state, w, round) {
  for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) state[r][c] ^= w[round * 4 + c][r];
}
function _invShiftRows(s) {
  for (var r = 1; r < 4; r++) { var row = s[r]; for (var i = 0; i < r; i++) row.unshift(row.pop()); }
}
function _invSubBytes(s) { for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) s[r][c] = AES_INV_SBOX[s[r][c]]; }
function _invMixColumns(s) {
  for (var c = 0; c < 4; c++) {
    var a = [s[0][c], s[1][c], s[2][c], s[3][c]];
    s[0][c] = _mul(a[0], 0x0e) ^ _mul(a[1], 0x0b) ^ _mul(a[2], 0x0d) ^ _mul(a[3], 0x09);
    s[1][c] = _mul(a[0], 0x09) ^ _mul(a[1], 0x0e) ^ _mul(a[2], 0x0b) ^ _mul(a[3], 0x0d);
    s[2][c] = _mul(a[0], 0x0d) ^ _mul(a[1], 0x09) ^ _mul(a[2], 0x0e) ^ _mul(a[3], 0x0b);
    s[3][c] = _mul(a[0], 0x0b) ^ _mul(a[1], 0x0d) ^ _mul(a[2], 0x09) ^ _mul(a[3], 0x0e);
  }
}
function aesCbcDecrypt(cipherBytes, keyBytes, ivBytes) {
  initAesTables();
  var exp = _expandKey(keyBytes);
  var Nr = exp.Nr, w = exp.w;
  var out = [];
  var prev = ivBytes.slice();
  for (var off = 0; off < cipherBytes.length; off += 16) {
    var block = cipherBytes.slice(off, off + 16);
    if (block.length < 16) break;
    var state = [[],[],[],[]];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) state[r][c] = block[c * 4 + r];
    _addRoundKey(state, w, Nr);
    for (var round = Nr - 1; round >= 1; round--) {
      _invShiftRows(state);
      _invSubBytes(state);
      _addRoundKey(state, w, round);
      _invMixColumns(state);
    }
    _invShiftRows(state);
    _invSubBytes(state);
    _addRoundKey(state, w, 0);
    for (r = 0; r < 4; r++) for (c = 0; c < 4; c++) out.push(state[r][c] ^ prev[c * 4 + r]);
    prev = block;
  }
  // PKCS#7 unpad
  if (out.length) {
    var pad = out[out.length - 1];
    if (pad >= 1 && pad <= 16 && pad <= out.length) out = out.slice(0, out.length - pad);
  }
  return out;
}

// ---------- enc payload çözümü (PBKDF2-SHA512 999 iter + AES-CBC) ----------

function decryptEncPayload(enc, k) {
  try {
    var ciphertext = b64ToBytes(enc.ciphertext);
    var iv = hexToBytes(enc.iv);
    var salt = hexToBytes(enc.salt);
    var key = pbkdf2Sha512(k, salt, 999, 32);
    var plain = aesCbcDecrypt(ciphertext, key, iv);
    return bytesToUtf8(plain).trim();
  } catch (e) {
    log("decrypt hata: " + e);
    return null;
  }
}

function extractEncFromHtml(html) {
  var m = /\\"enc\\"\s*:\s*\{\s*\\"ciphertext\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"iv\\"\s*:\s*\\"([^"\\]+)\\"\s*,\s*\\"salt\\"\s*:\s*\\"([^"\\]+)\\"/.exec(html);
  if (!m) m = /"enc"\s*:\s*\{\s*"ciphertext"\s*:\s*"([^"]+)"\s*,\s*"iv"\s*:\s*"([^"]+)"\s*,\s*"salt"\s*:\s*"([^"]+)"/.exec(html);
  if (!m) return null;
  var enc = { ciphertext: m[1], iv: m[2], salt: m[3] };
  var k = null;
  var after = html.substr(m.index + m[0].length, 800);
  var km = /\\"k\\"\s*:\s*\\"([^"\\]{10,80})\\"/.exec(after) || /"k"\s*:\s*"([^"]{10,80})"/.exec(after);
  if (!km) {
    var before = html.substr(Math.max(0, m.index - 800), 800);
    km = /\\"k\\"\s*:\s*\\"([^"\\]{10,80})\\"/.exec(before) || /"k"\s*:\s*"([^"]{10,80})"/.exec(before);
  }
  if (km) k = km[1];
  return k ? { enc: enc, k: k } : null;
}

function extractDurationSeconds(html) {
  var m = /\\?"runtimeMin\\?"\s*:\s*(\d+)/.exec(html);
  if (m) return parseInt(m[1], 10) * 60;
  m = /\\?"timeRequired\\?"\s*:\s*\\?"PT(?:(\d+)H)?(?:(\d+)M)?/.exec(html);
  if (m) return (parseInt(m[1] || "0", 10) * 3600) + (parseInt(m[2] || "0", 10) * 60);
  return null;
}

// ---------- Dean Edwards unpacker ----------
function baseEncode(num, base) {
  var digits = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (num === 0) return digits.charAt(0);
  var res = "";
  while (num > 0) { res = digits.charAt(num % base) + res; num = Math.floor(num / base); }
  return res;
}
function unpackPacker(packed) {
  var re = /\}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\.split\(['"]\|['"]\)/;
  var m = re.exec(packed);
  if (!m) return null;
  var payload = m[1], radix = parseInt(m[2], 10), symtab = m[4].split("|");
  var lookup = {};
  for (var i = 0; i < symtab.length; i++) {
    var key = baseEncode(i, radix);
    lookup[key] = symtab[i] ? symtab[i] : key;
  }
  return payload.replace(/\b\w+\b/g, function (w) {
    return Object.prototype.hasOwnProperty.call(lookup, w) ? lookup[w] : w;
  }).replace(/\\'/g, "'").replace(/\\"/g, '"');
}

// Mini JS ortamı (packer eval için)
function evaluatePacker(htmlContent) {
  var pm = /(eval\(function\(p,a,c,k,e,d\).*?;\s*p\W+a\W+c\W+k\W+e\W+d\))/.exec(htmlContent);
  if (!pm) return htmlContent;
  var unpacked = unpackPacker(pm[1]);
  if (unpacked) return htmlContent + "\n" + unpacked;
  return htmlContent;
}

// NP_CONFIG parse
function parseNpConfig(html) {
  var idx = html.indexOf("NP_CONFIG");
  if (idx === -1) return null;
  var eq = html.indexOf("=", idx);
  if (eq === -1) return null;
  var brace = html.indexOf("{", eq);
  if (brace === -1) return null;
  // Dengeli parantez
  var depth = 0, inStr = false, quote = "", esc = false, end = -1;
  for (var i = brace; i < html.length; i++) {
    var ch = html.charAt(i);
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === quote) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return null;
  try { return JSON.parse(html.slice(brace, end)); } catch (e) { return null; }
}

// ---------- Altyazı çıkarma (sıra zorlaması ile) ----------

function resolveEmbedPlayer(iframeHtml, iframeUrl) {
  var subs = [], seen = {};
  iframeHtml = evaluatePacker(iframeHtml);
  var norm = iframeHtml.replace(/\\\//g, "/");

  function addSub(label, url) {
    url = urljoin(iframeUrl, url);
    if (!url || seen[url]) return;
    seen[url] = 1;
    subs.push({ label: label, lang: guessLang(label, url), forced: /forced|zorunlu/i.test(label), url: url });
  }

  // 1) file/src ...vtt
  var re = /["'](?:file|src)["']\s*:\s*["']([^"']+\.vtt[^"']*)["']/g, m;
  while ((m = re.exec(norm))) addSub(/forced/i.test(m[1]) ? "Türkçe (Forced)" : "Türkçe", m[1]);

  // 2) track.php?v=...
  re = /["']([^"']*track\.php\?[^"']+)["']/g;
  while ((m = re.exec(norm))) {
    if (m[1].indexOf("v=") >= 0 && !/v=$/.test(m[1])) addSub("Türkçe Altyazı", m[1]);
  }

  // 3) NP_CONFIG
  var np = parseNpConfig(iframeHtml);
  var master = null;

  if (np) {
    var srcs = (np.sources || []).filter(function (s) { return s && s.master; });
    if (srcs.length) {
      var chosen = srcs.find(function (s) { return s.kind === "orig"; }) || srcs[0];
      master = normalizeUrl(chosen.master);
    }
    var npSubs = np.subtitles || [];
    for (var i = 0; i < npSubs.length; i++) {
      var it = npSubs[i];
      var f = (it && (it.file || it.url || it.src)) || (typeof it === "string" ? it : null);
      if (!f) continue;
      var lbl;
      if (i === 0) lbl = "Türkçe (Forced)";
      else if (i === 1) lbl = "İngilizce (Forced)";
      else if (i === 2) lbl = "Türkçe";
      else if (i === 3) lbl = "İngilizce";
      else lbl = (it && it.label) || ("Altyazı " + (i + 1));
      addSub(lbl, f);
    }
    if (!subs.length && np.track && np.track.indexOf("v=") >= 0 && !/v=$/.test(np.track)) {
      addSub("Türkçe", np.track);
    }
  }

  // 4) openPlayer / source2.php key
  var keyM = /(?:window\.)?openPlayer\(\s*['"]([^'"]+)['"]/.exec(iframeHtml)
          || /source2\.php\?v=([a-zA-Z0-9+/=_-]+)/.exec(iframeHtml)
          || /player\(\s*['"]([^'"]+)['"]/.exec(iframeHtml);
  var sourceKey = keyM ? keyM[1] : null;

  if (sourceKey && !master) {
    try {
      var srcUrl = urljoin(iframeUrl, "source2.php") + "?v=" + encodeURIComponent(sourceKey);
      var headers = videoHeaders(srcUrl, iframeUrl);
      headers["X-Requested-With"] = "XMLHttpRequest";
      var r = host.fetch(srcUrl, { headers: headers, timeout: 15 });
      if (r.status === 200) {
        var data = null;
        try { data = JSON.parse(r.text); } catch (e) { data = null; }
        if (data && !data.expired && data.playlist && data.playlist.length) {
          var p = data.playlist[0];
          if (p.sources && p.sources.length) master = normalizeUrl(p.sources[0].file);
          var tracks = p.tracks || [];
          for (var ti = 0; ti < tracks.length; ti++) {
            var tr = tracks[ti];
            var tf = tr.file || tr.src;
            if (tf && !/v=$/.test(tf)) addSub(tr.label || tr.kind || "Türkçe", tf);
          }
        }
      }
    } catch (e) { log("source2 hatası: " + e); }
  }

  // 5) m3u8 regex fallback
  if (!master) {
    var m3 = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(iframeHtml) || /(https?::?[^"'\s]+\.m3u8[^"'\s]*)/.exec(iframeHtml);
    if (m3) master = normalizeUrl(m3[1]);
  }

  // 6) track.php fallback (hotlinger/dplayer)
  if (!subs.length && /hotlinger|dplayer/.test(iframeUrl)) {
    var vm = /v=([a-zA-Z0-9_-]{8,})/.exec(iframeUrl);
    if (vm) {
      var baseOrigin = "https://selcukflix.app/";
      var b64Origin = btoaSafe(baseOrigin);
      var pu = /^(https?:\/\/[^\/]+)/.exec(iframeUrl);
      if (pu) addSub("Türkçe Altyazı", pu[1] + "/track.php?v=" + vm[1] + "&h=" + b64Origin);
    }
  }

  return { master: master, subs: subs };
}

function btoaSafe(s) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var bytes = utf8Bytes(s);
  var out = "";
  for (var i = 0; i < bytes.length; i += 3) {
    var b0 = bytes[i], b1 = bytes[i+1], b2 = bytes[i+2];
    out += chars.charAt(b0 >> 2);
    out += chars.charAt(((b0 & 3) << 4) | (b1 === undefined ? 0 : b1 >> 4));
    out += b1 === undefined ? "=" : chars.charAt(((b1 & 15) << 2) | (b2 === undefined ? 0 : b2 >> 6));
    out += b2 === undefined ? "=" : chars.charAt(b2 & 63);
  }
  return out.replace(/=+$/, "");
}

function guessLang(label, url) {
  var hay = (label + " " + url).toLowerCase();
  if (/türk|turk|turkish|tr\b/.test(hay)) return "tr";
  if (/ing|eng|english/.test(hay)) return "en";
  return "und";
}

// ---------- Video başlıkları (pichive/cfd için cookie) ----------

function videoHeaders(targetUrl, referer, isIframe) {
  var tHost = (/^https?:\/\/([^\/]+)/.exec(targetUrl) || [])[1] || "";
  var rHost = (/^https?:\/\/([^\/]+)/.exec(referer) || [])[1] || "";

  var actualRef;
  if (/\.cfd/.test(targetUrl) || /\.(jpg|ts|vtt)$/i.test(targetUrl)) {
    actualRef = rHost ? ("https://" + rHost + "/") : "https://four.pichive.online/";
  } else {
    actualRef = referer || "https://four.pichive.online/";
  }
  var origin = rHost ? ("https://" + rHost) : "https://four.pichive.online";

  var h = {
    "User-Agent": UA,
    "Referer": actualRef,
    "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7"
  };
  if (isIframe) {
    h["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
    h["Upgrade-Insecure-Requests"] = "1";
    h["Sec-Fetch-Dest"] = "iframe";
    h["Sec-Fetch-Mode"] = "navigate";
    h["Sec-Fetch-Site"] = "cross-site";
  } else {
    h["Origin"] = origin;
    h["Accept"] = "*/*";
    h["Sec-Fetch-Dest"] = "empty";
    h["Sec-Fetch-Mode"] = "cors";
    h["Sec-Fetch-Site"] = "cross-site";
  }

  var check = tHost + " " + rHost;
  if (/pichive|hotlinger|dplayer|cfd|selcukflix/.test(check) && CF_CLEARANCE) {
    h["Cookie"] = "cf_clearance=" + CF_CLEARANCE;
  }
  return h;
}

// ---------- Sayfa adayları ----------

function getPageCandidates(input) {
  var clean = String(input || "").replace(/^\/+|\/+$/g, "");
  var isSeries = /^dizi\//.test(clean) || /\/sezon/.test(clean) || /-sezon/.test(clean) || /-bolum/.test(clean);
  var withoutPrefix = clean.replace(/^(film\/|dizi\/)/, "");

  var cands;
  if (isSeries) {
    cands = [
      BASE + "/dizi/" + withoutPrefix,
      BASE + "/dizi/" + withoutPrefix + "/izle",
      BASE + "/" + clean
    ];
  } else {
    var hasIzle = /\/izle$/.test(withoutPrefix);
    var baseSlug = hasIzle ? withoutPrefix.slice(0, -5) : withoutPrefix;
    cands = [
      BASE + "/film/" + baseSlug + "/izle",
      BASE + "/film/" + baseSlug,
      BASE + "/dizi/" + baseSlug + "/izle",
      BASE + "/dizi/" + baseSlug,
      BASE + "/" + baseSlug + "/izle",
      BASE + "/" + baseSlug
    ];
  }
  // tekilleştir
  var seen = {}, out = [];
  for (var i = 0; i < cands.length; i++) {
    if (!seen[cands[i]]) { seen[cands[i]] = 1; out.push(cands[i]); }
  }
  return out;
}

// ---------- Ana resolve ----------

function resolve(req) {
  var input = String(req.slug || "").trim();
  if (!input) throw new Error("Boş slug");

  var candidates = /^https?:\/\//.test(input) ? [input] : getPageCandidates(input);

  for (var ci = 0; ci < candidates.length; ci++) {
    var pageUrl = candidates[ci];
    try {
      log("deneniyor " + pageUrl);
      var pageRes = host.fetch(pageUrl, {
        headers: videoHeaders(pageUrl, BASE + "/"),
        timeout: 25
      });
      if (pageRes.status !== 200) continue;

      var html = pageRes.text;
      var encData = extractEncFromHtml(html);
      if (!encData) continue;

      var iframeRaw = decryptEncPayload(encData.enc, encData.k);
      if (!iframeRaw) continue;
      if (!/^(https?:|\/\/)/.test(iframeRaw)) continue;

      var iframeUrl = iframeRaw.indexOf("//") === 0 ? "https:" + iframeRaw : iframeRaw;
      var duration = extractDurationSeconds(html);

      var iframeRes = host.fetch(iframeUrl, {
        headers: videoHeaders(iframeUrl, pageUrl, true),
        timeout: 25
      });

      if (iframeRes.status !== 200) {
        if (/dplayer/.test(iframeUrl)) {
          var alt = iframeUrl.replace(/sn\.dplayer\d+\.site/, "sn.hotlinger.com");
          var altRes = host.fetch(alt, { headers: videoHeaders(alt, pageUrl, true), timeout: 25 });
          if (altRes.status === 200) { iframeUrl = alt; iframeRes = altRes; }
        }
        if (iframeRes.status !== 200) continue;
      }

      var resolved = resolveEmbedPlayer(iframeRes.text, iframeUrl);
      if (!resolved.master) continue;

      log("çözüldü: " + resolved.master + " | altyazı: " + resolved.subs.length);

      // ttl: URL'de e= epoch varsa ondan, yoksa 6 saat
      var ttl = 6 * 3600;
      var em = /[?&]e=(\d+)/.exec(resolved.master);
      if (em) ttl = Math.max(600, parseInt(em[1], 10) - Math.floor(Date.now() / 1000) - 600);

      return {
        url: resolved.master,
        referer: BASE + "/",
        subs: resolved.subs,
        name: input,
        ttl: ttl,
        subsMode: "single" // /subs tek VTT döndürüyor
      };
    } catch (e) {
      log("[" + pageUrl + "] hata: " + e);
      continue;
    }
  }

  throw new Error("Hiçbir sayfadan stream çözülemedi: " + input);
}