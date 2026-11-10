/* Ortak yardımcılar (tüm eklentilerden önce yüklenir). Kullanım: L.b64decode(...), L.urljoin(...) */
var L = (function () {
  var CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  var STUB_TPL = "\nvar _noop = function(){};\nvar _makeEventTarget = function() {\n    return {\n        addEventListener: _noop,\n        removeEventListener: _noop,\n        dispatchEvent: _noop\n    };\n};\n\nvar window = _makeEventTarget();\nwindow.innerWidth = 1920;\nwindow.innerHeight = 1080;\nwindow.location = { href: '__ORIGIN__/', hostname: '__HOST__', origin: '__ORIGIN__', protocol: 'https:' };\nwindow.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36' };\nwindow.localStorage = { totalPlayTime: 0 };\nwindow.document = {\n    addEventListener: _noop,\n    removeEventListener: _noop,\n    getElementById: function(){ return { addEventListener: _noop, removeEventListener: _noop, style: {}, classList: { add: _noop, remove: _noop }, querySelector: function(){ return null; }, querySelectorAll: function(){ return []; } }; },\n    querySelector: function(){ return null; },\n    querySelectorAll: function(){ return []; },\n    createElement: function(){ return { setAttribute: _noop, addEventListener: _noop, style: {}, classList: { add: _noop, remove: _noop }, parentNode: null, innerHTML: '' }; },\n    getElementsByClassName: function(){ return []; },\n    getElementsByTagName: function(){ return []; },\n    getElementsByName: function(){ return []; },\n    body: { appendChild: _noop, removeChild: _noop, classList: { add: _noop, remove: _noop } },\n    head: { appendChild: _noop, removeChild: _noop },\n    documentElement: { clientWidth: 1920, clientHeight: 1080, style: {} },\n    visibilityState: 'visible',\n    fullscreenElement: null,\n    cookie: '',\n    readyState: 'complete'\n};\n\nvar document = window.document;\nvar localStorage = window.localStorage;\nvar navigator = window.navigator;\nvar location = window.location;\n\nvar atob = function(s) {\n    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';\n    var str = String(s).replace(/=+$/, '').replace(/[\\s]/g, '');\n    var output = '';\n    if (str.length % 4 === 1) throw new Error('bad atob input');\n    for (var bc = 0, bs, buffer, idx = 0;\n         (buffer = str.charAt(idx++));\n         ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,\n         bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {\n        buffer = chars.indexOf(buffer);\n    }\n    return output;\n};\nvar btoa = function(s) {\n    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';\n    var str = String(s);\n    var output = '';\n    for (var block, charCode, idx = 0, map = chars;\n         str.charAt(idx | 0) || (map = '=', idx % 1);\n         output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {\n        charCode = str.charCodeAt(idx += 3 / 4);\n        block = block << 8 | charCode;\n    }\n    return output;\n};\n\nvar $ = function() {\n    var obj = {\n        append: function(){ return obj; }, prepend: function(){ return obj; },\n        on: function(){ return obj; }, once: function(){ return obj; },\n        off: function(){ return obj; }, remove: function(){ return obj; },\n        css: function(){ return obj; }, attr: function(){ return obj; },\n        text: function(){ return obj; }, html: function(){ return obj; },\n        addClass: function(){ return obj; }, removeClass: function(){ return obj; },\n        val: function(){ return ''; }, each: function(){ return obj; },\n        eq: function(){ return obj; }, not: function(){ return obj; },\n        find: function(){ return obj; },\n        length: 0,\n        parentNode: { insertBefore: _noop },\n        classList: { add: _noop, remove: _noop }\n    };\n    return obj;\n};\n$.fn = {};\n\nvar jwplayer = function() {\n    return {\n        setup: function(){ return this; },\n        on: function(){ return this; }, once: function(){ return this; },\n        off: function(){ return this; }, addButton: function(){ return this; },\n        getContainer: function(){ return null; },\n        getPosition: function(){ return 0; },\n        getState: function(){ return 'idle'; },\n        getDuration: function(){ return 0; },\n        getFullscreen: function(){ return false; },\n        getCaptionsList: function(){ return []; },\n        getCurrentAudioTrack: function(){ return 0; },\n        getCurrentCaptions: function(){ return 0; },\n        setCurrentCaptions: function(){},\n        setCurrentAudioTrack: function(){},\n        seek: function(){}, load: function(){},\n        play: function(){}, stop: function(){},\n        key: ''\n    };\n};\njwplayer.key = '';\n\nvar console = { log: _noop, warn: _noop, error: _noop, info: _noop, debug: _noop, dir: _noop, trace: _noop, table: _noop, group: _noop, groupEnd: _noop };\n\nvar gtag = _noop;\nvar setInterval = function(){ return 0; };\nvar setTimeout = function(){ return 0; };\nvar clearInterval = _noop;\nvar clearTimeout = _noop;\nvar requestAnimationFrame = function(){ return 0; };\nvar cancelAnimationFrame = _noop;\nvar Defer = { dom: _noop };\nvar Message = function(){ return { show: function(){ return this; } }; };\nMessage.clearAll = _noop;\nMessage.parent = { appendChild: _noop, removeChild: _noop };\nMessage.Stack = [];\nMessage.idGen = function(){ return 0; };\nMessage.Util = { find: function(){ return -1; }, toDash: function(s){ return s; }, getSizes: function(){ return {width:1920,height:1080}; }, rePosition: _noop };\nMessage.stylePresets = [];\nMessage.config = { types: _noop };\nMessage.prototype = { init: _noop, show: _noop, stylize: _noop };\n\nvar initVisibilityChecker = function(){ return { isVisible: function(){ return false; } }; };\nvar jwMenuAc = _noop;\nvar jwMenuKapa = _noop;\nvar tooltipShown = false;\nvar audioLoaded = 0;\nvar audioTracks = [];\nvar curCaptions = [];\nvar currentAudioTrackIndex = 0;\nvar curCaptionIndex = 0;\nvar forcedCaption = false;\nvar trAltyazi = false;\nvar trAltyazi2 = false;\nvar trAlyazi = false;\nvar trAlyazi2 = false;\n";

  function b64bytes(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+\/]/g, "");
    var out = [], i = 0, v, k, chunk;
    while (i < s.length) {
      chunk = s.substr(i, 4); i += 4; v = [];
      for (k = 0; k < chunk.length; k++) v.push(CH.indexOf(chunk.charAt(k)));
      if (v.length >= 2) out.push(((v[0] << 2) | (v[1] >> 4)) & 255);
      if (v.length >= 3) out.push(((v[1] << 4) | (v[2] >> 2)) & 255);
      if (v.length >= 4) out.push(((v[2] << 6) | v[3]) & 255);
    }
    return out;
  }
  function utf8(b) {
    var s = "", i = 0, c, cp;
    while (i < b.length) {
      c = b[i++];
      if (c < 128) s += String.fromCharCode(c);
      else if (c < 224) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
      else if (c < 240) s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
      else { cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63); cp -= 0x10000; s += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 1023)); }
    }
    return s;
  }
  function latin1(b) { var s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
  function utf8bytes(str) {
    var out = [], i, c, d;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) { d = str.charCodeAt(++i); c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); out.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
      else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return out;
  }
  function b64decode(s) { return utf8(b64bytes(s)); }
  function b64encode(str) {
    var b = utf8bytes(str), out = "", i;
    for (i = 0; i < b.length; i += 3) {
      var n = (b[i] << 16) | ((b[i + 1] || 0) << 8) | (b[i + 2] || 0);
      out += CH.charAt((n >> 18) & 63) + CH.charAt((n >> 12) & 63) + (i + 1 < b.length ? CH.charAt((n >> 6) & 63) : "=") + (i + 2 < b.length ? CH.charAt(n & 63) : "=");
    }
    return out;
  }
  function hex(b) { var s = ""; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? "0" : "") + b[i].toString(16); return s; }
  function unhex(h) { var o = []; for (var i = 0; i + 1 < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; }
  function rot13(s) { return String(s).replace(/[a-zA-Z]/g, function (c) { var b = c <= "Z" ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b); }); }
  function padB64(s) { while (s.length % 4) s += "="; return s; }

  function origin(u) { var m = /^(https?:\/\/[^\/?#]+)/i.exec(u || ""); return m ? m[1] : ""; }
  function urljoin(base, rel) {
    rel = String(rel).trim();
    if (/^https?:\/\//i.test(rel)) return rel;
    if (rel.indexOf("//") === 0) return "https:" + rel;
    var m = /^(https?:\/\/[^\/?#]+)([^?#]*)/i.exec(base);
    if (!m) return rel;
    if (rel.charAt(0) === "/") return m[1] + rel;
    return m[1] + (m[2] || "/").replace(/[^\/]*$/, "") + rel;
  }
  function stripTags(s) { return String(s).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim(); }
  function htmlDecode(s) { return String(s).replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }
  function cleanUrl(u) { return u ? String(u).replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&").replace(/\\/g, "").replace(/["']/g, "").trim() : u; }
  function unescapeJs(s) {
    return String(s).replace(/\\u0022/g, '"').replace(/\\u0027/g, "'").replace(/\\u0026/g, "&").replace(/\\\\\//g, "/").replace(/\\\//g, "/").replace(/\\\\/g, "\\");
  }
  function jsSingleQuoteUnescape(s) {
    return String(s).replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, function (_, t) {
      if (t.charAt(0) === "u" && t.length === 5) return String.fromCharCode(parseInt(t.slice(1), 16));
      if (t.charAt(0) === "x" && t.length === 3) return String.fromCharCode(parseInt(t.slice(1), 16));
      if (t === "n") return "\n"; if (t === "t") return "\t"; if (t === "r") return "\r";
      return t;
    });
  }
  function unicodeLabel(s) { return String(s).replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); }).trim(); }

  /* Dean Edwards packer */
  function baseEncode(num, base) {
    var d = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (num === 0) return d.charAt(0);
    var r = ""; while (num > 0) { r = d.charAt(num % base) + r; num = Math.floor(num / base); } return r;
  }
  function unpack(packed) {
    var m = /\}\s*\(\s*'([\s\S]*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\.split\('\|'\)/.exec(packed);
    if (!m) return packed;
    var radix = parseInt(m[2], 10), sym = m[4].split("|"), lookup = {}, i;
    for (i = 0; i < sym.length; i++) { var k = baseEncode(i, radix); lookup[k] = sym[i] ? sym[i] : k; }
    return m[1].replace(/\b\w+\b/g, function (w) { return Object.prototype.hasOwnProperty.call(lookup, w) ? lookup[w] : w; }).replace(/\\'/g, "'").replace(/\\"/g, '"');
  }

  /* packed/obfüske scripti QuickJS içinde çalıştırıp video linkini değişkenlerden okur (MiniRacer yerine) */
  function decodeJs(scriptText, siteOrigin) {
    var ge = eval, js = unpack(scriptText);
    var host_ = /^https?:\/\/([^\/]+)/.exec(siteOrigin || "https://example.com");
    var stub = STUB_TPL.replace(/__ORIGIN__/g, siteOrigin || "https://example.com").replace(/__HOST__/g, host_ ? host_[1] : "example.com");
    var names = ["so3", "h3o", "thl", "voz", "file_link", "file", "sources"], i;
    try { ge(stub); } catch (e) { host.log("stub hatası: " + e); }
    for (i = 0; i < names.length; i++) { try { ge(names[i] + "=undefined"); } catch (e) {} }
    try { ge(js); } catch (e) { host.log("JS eval hatası: " + String(e).slice(0, 160)); }
    for (i = 0; i < names.length; i++) {
      try {
        var v = ge("(typeof " + names[i] + "!=='undefined'&&" + names[i] + ")?JSON.stringify(" + names[i] + "):null");
        if (!v) continue;
        var o = JSON.parse(v);
        if (typeof o === "string" && o.indexOf("http") === 0) return o;
        if (o && o.length) for (var j = 0; j < o.length; j++) {
          if (o[j] && typeof o[j] === "object" && o[j].file && String(o[j].file).indexOf("http") === 0) return o[j].file;
          if (typeof o[j] === "string" && o[j].indexOf("http") === 0) return o[j];
        }
      } catch (e) {}
    }
    var m = /sources\s*:\s*\[\s*\{\s*file\s*:\s*(\w+)\s*\}/.exec(scriptText) || /sources\s*:\s*\[\s*\{\s*file\s*:\s*(\w+)\s*\}/.exec(js);
    if (m) { try { var v2 = ge("typeof " + m[1] + "==='string'?" + m[1] + ":null"); if (v2 && v2.indexOf("http") === 0) return v2; } catch (e) {} }
    return null;
  }

  /* OpenSSL/CryptoJS "Salted__" tarzı: EVP_BytesToKey(MD5) + AES-256-CBC */
  function evpKeyIv(passBytes, saltBytes, keyLen, ivLen) {
    var d = [], prev = [], total = [];
    while (total.length < keyLen + ivLen) {
      prev = unhex(host.crypto({ op: "md5", dataHex: hex(prev.concat(passBytes, saltBytes)) }));
      total = total.concat(prev);
    }
    return { key: total.slice(0, keyLen), iv: total.slice(keyLen, keyLen + ivLen) };
  }
  function aesOpenSsl(passBytes, saltHex, ctB64) {
    var kv = evpKeyIv(passBytes, unhex(saltHex), 32, 16);
    return utf8(unhex(host.crypto({ op: "aesCbcDecrypt", keyHex: hex(kv.key), ivHex: hex(kv.iv), dataHex: hex(b64bytes(ctB64)), unpad: true })));
  }

  function guessLang(label, url) {
    var c = (String(label) + " " + String(url)).toLowerCase();
    var forced = /forced|zorunlu/.test(c);
    if (/\b(eng|en)\b|english|ingilizce|i̇ngilizce|_eng|ing/.test(c)) return { lang: "en", forced: forced };
    if (/\b(ara|ar)\b|arabic|arap/.test(c)) return { lang: "ar", forced: forced };
    return { lang: "tr", forced: forced };
  }

  /* html içinde '{' konumundan başlayan JSON nesnesini dengeli parantezle keser */
  function jsonAt(s, idx) {
    var depth = 0, inStr = false, esc = false, i, c;
    for (i = idx; i < s.length; i++) {
      c = s.charAt(i);
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) return s.slice(idx, i + 1); }
    }
    return null;
  }

  function get(url, headers, timeout) { return host.fetch(url, { headers: headers || {}, timeout: timeout || 15 }); }

  return {
    UA: UA, b64decode: b64decode, b64encode: b64encode, b64bytes: b64bytes, utf8: utf8, latin1: latin1, utf8bytes: utf8bytes,
    hex: hex, unhex: unhex, rot13: rot13, padB64: padB64, origin: origin, urljoin: urljoin, stripTags: stripTags,
    htmlDecode: htmlDecode, cleanUrl: cleanUrl, unescapeJs: unescapeJs, jsSingleQuoteUnescape: jsSingleQuoteUnescape,
    unicodeLabel: unicodeLabel, unpack: unpack, decodeJs: decodeJs, aesOpenSsl: aesOpenSsl, evpKeyIv: evpKeyIv,
    guessLang: guessLang, jsonAt: jsonAt, get: get
  };
})();
