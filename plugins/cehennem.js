// HDFilmCehennemi Eklentisi (cehennem.py port)
function resolve(slug, prefer, config) {
  var baseUrl = (config.base_url || "https://www.hdfilmcehennemi.nl").replace(/\/+$/, "");
  var filmUrl = baseUrl + "/" + slug.replace(/^\/+|\/+$/g, "") + "/";

  var pageRes = httpGet(filmUrl, {
    "Referer": baseUrl + "/"
  });

  if (pageRes.status === 404 || !pageRes.body) {
    return { error: "Film bulunamadı: " + filmUrl };
  }

  var html = pageRes.body;
  var candidates = [];

  var blockRegex = /<div[^>]*class="[^"]*alternative-links[^"]*"[^>]*data-lang="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi;
  var bMatch;
  while ((bMatch = blockRegex.exec(html)) !== null) {
    var lang = (bMatch[1] || "").toUpperCase();
    var inner = bMatch[2];
    var btnRegex = /<button[^>]*data-video="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
    var btnMatch;
    while ((btnMatch = btnRegex.exec(inner)) !== null) {
      var cleanName = btnMatch[2].replace(/<[^>]+>/g, "").replace("(HDrip Xbet)", "").trim();
      candidates.push({
        name: (cleanName + " " + lang).trim(),
        id: btnMatch[1]
      });
    }
  }

  if (candidates.length === 0) {
    var fallbackBtn = /<button[^>]*data-video="([^"]+)"[^>]*>([\s\S]*?)<\/button>/gi;
    var fbMatch;
    while ((fbMatch = fallbackBtn.exec(html)) !== null) {
      candidates.push({
        name: fbMatch[2].replace(/<[^>]+>/g, "").trim(),
        id: fbMatch[1]
      });
    }
  }

  // Kaynak önceliklendirme: rapid -> close/mobi -> diğerleri
  candidates.sort(function (a, b) {
    function score(item) {
      var n = item.name.toLowerCase();
      if (prefer && prefer !== "any" && n.indexOf(prefer.toLowerCase()) !== -1) return 0;
      if (n.indexOf("rapid") !== -1) return 1;
      if (n.indexOf("close") !== -1 || n.indexOf("mobi") !== -1) return 2;
      return 3;
    }
    return score(a) - score(b);
  });

  for (var i = 0; i < candidates.length; i++) {
    var item = candidates[i];
    var apiRes = httpGet(baseUrl + "/video/" + item.id + "/", {
      "Referer": filmUrl,
      "X-Requested-With": "fetch",
      "Accept": "application/json"
    });

    if (!apiRes.body) continue;

    var iframeMatch = apiRes.body.match(/data-src=\\?"([^"\\]+)"/) || apiRes.body.match(/src=\\?"([^"\\]+)"/);
    if (!iframeMatch) continue;

    var iframeUrl = iframeMatch[1].replace(/\\\//g, "/").replace(/\\/g, "").trim();

    if (iframeUrl.toLowerCase().indexOf("rapidrame") !== -1) {
      var rId = iframeUrl.indexOf("?rapidrame_id=") !== -1
        ? iframeUrl.split("?rapidrame_id=").pop()
        : iframeUrl.replace(/\/+$/, "").split("/").pop();
      rId = rId.split("?")[0].split("&")[0].replace(/^\/+|\/+$/g, "");
      iframeUrl = baseUrl + "/rplayer/" + rId;
    } else if (iframeUrl.indexOf("//") === 0) {
      iframeUrl = "https:" + iframeUrl;
    } else if (iframeUrl.indexOf("/") === 0) {
      iframeUrl = baseUrl + iframeUrl;
    }

    var refererOrigin = baseUrl + "/";
    var playerRes = httpGet(iframeUrl, {
      "Referer": refererOrigin
    });

    var pText = playerRes.body || "";
    if (pText.toLowerCase().indexOf("access denied") !== -1 && pText.length < 1000) {
      continue;
    }

    var subs = extractSubtitles(pText, baseUrl);

    // 1. Doğrudan m3u8 / txt / mp4 taraması
    var directMatches = pText.match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|txt|mp4)(?:[^\s"'<>]*)?/g) || [];
    for (var d = 0; d < directMatches.length; d++) {
      var cleanUrl = directMatches[d].replace(/\\\//g, "/").replace(/\\/g, "").trim();
      if (/player|favicon|\.vtt|logo|poster/.test(cleanUrl)) continue;
      if (!/\/hls|\/hls2|master|\/txt\//.test(cleanUrl)) continue;

      return {
        master_url: cleanUrl,
        referer: refererOrigin,
        subs: subs,
        source_name: item.name
      };
    }

    // 2. Script bloklarında Dean Edwards + dc_ decode
    var scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    var sMatch;
    while ((sMatch = scriptRegex.exec(pText)) !== null) {
      var sc = sMatch[1];
      if (sc.indexOf("sources:") === -1 && sc.indexOf("dc_") === -1 && sc.indexOf("eval(function") === -1) {
        continue;
      }
      var decodedUrl = decodePlayerJs(sc, baseUrl);
      if (decodedUrl && decodedUrl.indexOf("http") === 0) {
        var scSubs = extractSubtitles(sc, baseUrl);
        return {
          master_url: decodedUrl,
          referer: refererOrigin,
          subs: scSubs.length > 0 ? scSubs : subs,
          source_name: item.name
        };
      }
    }
  }

  return { error: "Hiçbir kaynaktan link çözülemedi." };
}

function extractSubtitles(text, baseDomain) {
  var subs = [];
  var tracksMatch = text.match(/tracks:\s*\[([\s\S]*?)\]/);
  if (!tracksMatch) return subs;

  var raw = tracksMatch[1];
  var itemRegex = /\{[^\}]*"file"\s*:\s*"([^"]+)"[^\}]*"label"\s*:\s*"([^"]+)"/g;
  var m;
  while ((m = itemRegex.exec(raw)) !== null) {
    var path = m[1].replace(/\\\//g, "/");
    var label = m[2];
    try { label = JSON.parse('"' + label + '"'); } catch (e) {}
    var low = (label + " " + path).toLowerCase();
    var lang = /ing|eng|english/.test(low) ? "en" : "tr";
    var fullUrl = path.indexOf("http") === 0 ? path : baseDomain + (path.indexOf("/") === 0 ? "" : "/") + path;
    subs.push({ label: label, lang: lang, url: fullUrl });
  }
  return subs;
}
