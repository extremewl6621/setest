package app.yerel.iptv

import android.util.Base64
import android.util.Log
import fi.iki.elonen.NanoHTTPD
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okio.ByteString.Companion.encodeUtf8
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit

data class Sub(val label: String, val lang: String, val forced: Boolean, val url: String)

class Resolved(
    val url: String, val referer: String, val subs: List<Sub>, val name: String,
    val subsMode: String, val expiresAt: Long
) {
    val created = System.currentTimeMillis()
    @Volatile var duration = 0.0
    @Volatile var lastAliveCheck = created
}

class ResolveError(msg: String) : Exception(msg)

/**
 * Yerel IPTV sunucusu.
 *
 *   /<saglayici>/stream?film=<slug>           -> HLS master (M3U listesine konan link)
 *   /<saglayici>/fetch?b=..&ref=..            -> playlist/segment relay
 *   /<saglayici>/subs_playlist, subs_segment, subs
 *   /<saglayici>/playlist.m3u?slugs=a,b,c     -> hazır M3U listesi üretir
 *
 * Sağlayıcı kimliği (id) yolun ilk parçası olduğu için farklı sitelerin linkleri asla karışmaz.
 */
class LocalServer(
    private val store: ProviderStore,
    private val js: JsRuntime,
    private val http: OkHttpClient,
    host: String,
    port: Int
) : NanoHTTPD(host, port) {

    private val cache = ConcurrentHashMap<String, Resolved>()
    private val locks = ConcurrentHashMap<String, Any>()
    private val scrapeSlots = Semaphore(3)
    private val cors = mapOf(
        "Access-Control-Allow-Origin" to "*",
        "Access-Control-Allow-Methods" to "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers" to "*",
        "Access-Control-Expose-Headers" to "*"
    )
    private val slugRe = Regex("^[\\p{L}\\p{N}._\\-/]{1,200}$")

    // ---------- yönlendirme ----------
    override fun serve(session: IHTTPSession): Response {
        return try {
            route(session)
        } catch (e: Exception) {
            Log.e("LocalServer", "hata", e)
            text(500, "Hata: ${e.message}")
        }
    }

    private fun route(s: IHTTPSession): Response {
        if (s.method == Method.OPTIONS) return withCors(newFixedLengthResponse(Response.Status.NO_CONTENT, "text/plain", ""))
        val seg = s.uri.trim('/').split('/').filter { it.isNotEmpty() }
        val proxy = "http://" + (s.headers["host"] ?: "127.0.0.1:$listeningPort")
        if (seg.isEmpty()) return home(proxy)
        val p = store.get(seg[0]) ?: return text(404, "Bilinmeyen sağlayıcı: ${seg[0]}")
        return when (seg.getOrNull(1) ?: "") {
            "stream" -> handleStream(p, s, proxy)
            "fetch" -> handleFetch(p, s, proxy)
            "subs_playlist" -> handleSubsPlaylist(p, s, proxy)
            "subs_segment" -> handleSubsSegment(s)
            "subs" -> handleSubs(s)
            "playlist.m3u" -> handleM3u(p, s, proxy)
            "" -> text(200, "Sağlayıcı: ${p.name}\nKullanım: /${p.id}/stream?film=SLUG")
            else -> text(404, "Bulunamadı")
        }
    }

    // ---------- ana sayfa ----------
    private fun home(proxy: String): Response {
        val sb = StringBuilder("<html><head><meta charset=utf-8><title>Yerel IPTV</title></head>")
        sb.append("<body style='font-family:sans-serif;background:#1a1a2e;color:#eee;padding:24px'>")
        sb.append("<h2 style='color:#e94560'>Yerel IPTV</h2><p>Sunucu: <code>$proxy</code></p><ul>")
        for (p in store.all().filter { it.enabled }) {
            sb.append("<li><b>${p.name}</b> v${p.version}<br><code>$proxy/${p.id}/stream?film=SLUG</code><br>")
            sb.append("<a style='color:#9cf' href='$proxy/${p.id}/playlist.m3u?slugs=ornek-1,ornek-2'>M3U örneği</a></li>")
        }
        sb.append("</ul></body></html>")
        return withCors(newFixedLengthResponse(Response.Status.OK, "text/html; charset=utf-8", sb.toString()))
    }

    private fun handleM3u(p: Provider, s: IHTTPSession, proxy: String): Response {
        val slugs = (s.parms["slugs"] ?: "").split(',').map { it.trim() }.filter { it.isNotEmpty() }
        val sb = StringBuilder("#EXTM3U\n")
        for (sl in slugs) {
            sb.append("#EXTINF:-1 group-title=\"${p.name}\",$sl\n")
            sb.append("$proxy/${p.id}/stream?film=${URLEncoder.encode(sl, "UTF-8")}\n")
        }
        return withCors(newFixedLengthResponse(Response.Status.OK, "audio/x-mpegurl; charset=utf-8", sb.toString()))
    }

    // ---------- /stream ----------
    private fun handleStream(p: Provider, s: IHTTPSession, proxy: String): Response {
        if (s.method == Method.HEAD)
            return withCors(newFixedLengthResponse(Response.Status.OK, "application/vnd.apple.mpegurl", ""))
        val slug = cleanSlug(s.parms["film"]) ?: return text(400, "Eksik veya geçersiz ?film=")
        val prefer = (s.parms["prefer"] ?: "any").lowercase()

        val r = try { resolveCached(p, slug, prefer) } catch (e: ResolveError) { return text(404, e.message ?: "Çözülemedi") }

        val resp = upstream(r.url, r.referer, null)
        if (!resp.isSuccessful) {
            val code = resp.code; resp.close(); cache.remove(key(p.id, slug, prefer))
            return text(code, "Master hatası: $code")
        }
        val body = resp.body!!
        if (!body.source().rangeEquals(0, "#EXTM3U".encodeUtf8())) return binary(resp, null)  // doğrudan mp4 vb.

        var content = body.string()
        val base = resp.request.url.toString()
        resp.close()

        val audio = langSet(s.parms["audio_langs"], null)
        if (audio != null) content = filterAudio(content, audio)

        var out = rewrite(content, base, proxy, p.id, r.referer)

        val wantSubs = (s.parms["subs"] ?: "1").lowercase() !in setOf("0", "false", "no")
        if (wantSubs && r.subs.isNotEmpty() && out.contains("#EXT-X-STREAM-INF")) {
            val wanted = langSet(s.parms["subs_langs"], setOf("tr", "en"))
            var subs = if (wanted == null) r.subs else r.subs.filter { it.lang in wanted }
            if (subs.isEmpty()) subs = r.subs
            if (r.subsMode == "segmented" && r.duration <= 0) r.duration = durationOf(content, base, r.referer)
            out = injectSubs(out, subs, proxy, p.id, r)
        }
        return withCors(newFixedLengthResponse(Response.Status.OK, "application/vnd.apple.mpegurl", out).also {
            it.addHeader("Cache-Control", "no-cache, no-store")
        })
    }

    private fun key(id: String, slug: String, prefer: String) = "$id|$slug|$prefer"

    private fun resolveCached(p: Provider, slug: String, prefer: String): Resolved {
        val k = key(p.id, slug, prefer)
        val lock = locks.getOrPut(k) { Any() }
        return synchronized(lock) {   // aynı film için eşzamanlı istekler tek tarama yapar
            val c = cache[k]
            if (c != null && System.currentTimeMillis() < c.expiresAt) {
                if (System.currentTimeMillis() - c.lastAliveCheck < 120_000 || alive(c)) {
                    c.lastAliveCheck = System.currentTimeMillis()
                    return c
                }
            }
            val script = store.script(p.id) ?: throw ResolveError("Sağlayıcı dosyası yok: ${p.id}")
            if (!scrapeSlots.tryAcquire(20, TimeUnit.SECONDS)) throw ResolveError("Çok fazla eşzamanlı çözümleme")
            try {
                val o = try {
                    js.resolve(p.id, script, slug, mapOf("prefer" to prefer))
                } catch (e: Exception) { throw ResolveError(e.message ?: "Çözümleme hatası") }
                val url = o.optString("url")
                if (!url.startsWith("http")) throw ResolveError("Sağlayıcı geçerli url döndürmedi")
                val subsArr = o.optJSONArray("subs")
                val subs = ArrayList<Sub>()
                if (subsArr != null) for (i in 0 until subsArr.length()) {
                    val so = subsArr.getJSONObject(i)
                    subs.add(Sub(so.optString("label", "Altyazı"), so.optString("lang", "und"), so.optBoolean("forced"), so.getString("url")))
                }
                val ttl = o.optLong("ttl", 3 * 3600).coerceAtLeast(60)
                val r = Resolved(url, o.optString("referer", url), subs, o.optString("name", slug),
                    o.optString("subsMode", "single"), System.currentTimeMillis() + ttl * 1000)
                cache[k] = r
                r
            } finally { scrapeSlots.release() }
        }
    }

    private fun alive(r: Resolved): Boolean = try {
        val c = http.newBuilder().callTimeout(4, TimeUnit.SECONDS).build()
        c.newCall(headersFor(r.url, r.referer, null)).execute().use { it.code in 200..206 }
    } catch (e: Exception) { false }

    // ---------- /fetch (relay) ----------
    private fun handleFetch(p: Provider, s: IHTTPSession, proxy: String): Response {
        val b = s.parms["b"] ?: return text(400, "Eksik URL")
        val (target, ref) = try {
            Pair(b64d(b), s.parms["ref"]?.takeIf { it.isNotEmpty() }?.let { b64d(it) } ?: "")
        } catch (e: Exception) { return text(400, "Geçersiz URL") }
        if (!target.startsWith("http://") && !target.startsWith("https://")) return text(400, "Geçersiz şema")

        if (s.method == Method.HEAD)
            return withCors(newFixedLengthResponse(Response.Status.OK, guessType(target), "").also { it.addHeader("Accept-Ranges", "bytes") })

        val resp = upstream(target, ref, s.headers["range"])
        if (!resp.isSuccessful && resp.code != 206) { val c = resp.code; resp.close(); return text(c, "Upstream hatası: $c") }
        val body = resp.body!!
        if (body.source().rangeEquals(0, "#EXTM3U".encodeUtf8())) {
            val content = body.string()
            val base = resp.request.url.toString()
            resp.close()
            return withCors(newFixedLengthResponse(Response.Status.OK, "application/vnd.apple.mpegurl",
                rewrite(content, base, proxy, p.id, ref)).also { it.addHeader("Cache-Control", "no-cache") })
        }
        return binary(resp, target)
    }

    private fun binary(resp: okhttp3.Response, target: String?): Response {
        val url = target ?: resp.request.url.toString()
        val ct = guessType(url).takeIf { url.substringBefore('?').lowercase().matches(Regex(".*\\.(png|jpe?g|gif|webp)$")) }
            ?: resp.header("Content-Type") ?: guessType(url)
        val st = Response.Status.lookup(resp.code) ?: Response.Status.OK
        val len = resp.header("Content-Length")?.toLongOrNull()
        val stream = resp.body!!.byteStream()
        val out = if (len != null) newFixedLengthResponse(st, ct, stream, len) else newChunkedResponse(st, ct, stream)
        resp.header("Content-Range")?.let { out.addHeader("Content-Range", it) }
        out.addHeader("Accept-Ranges", resp.header("Accept-Ranges") ?: "bytes")
        out.addHeader("Cache-Control", "public, max-age=3600")
        return withCors(out)
    }

    private fun guessType(u: String): String {
        val path = u.substringBefore('?').lowercase()
        return when {
            path.endsWith(".m3u8") -> "application/vnd.apple.mpegurl"
            path.endsWith(".vtt") -> "text/vtt; charset=utf-8"
            path.endsWith(".mp4") -> "video/mp4"
            path.endsWith(".ts") || path.matches(Regex(".*\\.(png|jpe?g|gif|webp)$")) || "/seg-" in path -> "video/mp2t"
            else -> "application/octet-stream"
        }
    }

    // ---------- altyazılar ----------
    private fun handleSubsPlaylist(p: Provider, s: IHTTPSession, proxy: String): Response {
        val b = s.parms["b"] ?: return text(400, "Eksik url")
        val ref = s.parms["ref"] ?: ""
        val dur = s.parms["dur"]?.toDoubleOrNull()?.takeIf { it > 0 }
        val sb = StringBuilder("#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-PLAYLIST-TYPE:VOD\n")
        if (dur == null) {
            sb.append("#EXT-X-TARGETDURATION:36000\n#EXTINF:0,\n$proxy/${p.id}/subs?b=$b&ref=$ref\n")
        } else {
            val seg = 30.0
            val n = Math.max(1, Math.ceil(dur / seg).toInt())
            sb.append("#EXT-X-TARGETDURATION:${seg.toInt() + 1}\n")
            for (i in 0 until n) {
                val st = i * seg; val en = Math.min(dur, st + seg)
                sb.append("#EXTINF:${"%.3f".format(java.util.Locale.US, Math.max(0.001, en - st))},\n")
                sb.append("$proxy/${p.id}/subs_segment?b=$b&ref=$ref&start=${"%.3f".format(java.util.Locale.US, st)}&end=${"%.3f".format(java.util.Locale.US, en)}\n")
            }
        }
        sb.append("#EXT-X-ENDLIST\n")
        return withCors(newFixedLengthResponse(Response.Status.OK, "application/vnd.apple.mpegurl", sb.toString()))
    }

    private val vttCache = ConcurrentHashMap<String, Pair<Long, String>>()
    private fun vtt(b: String, refB: String): String {
        vttCache[b]?.let { if (System.currentTimeMillis() - it.first < 4 * 3600_000) return it.second }
        val url = b64d(b); val ref = if (refB.isNotEmpty()) b64d(refB) else ""
        http.newCall(headersFor(url, ref, null)).execute().use { r ->
            if (!r.isSuccessful) throw RuntimeException("HTTP ${r.code}")
            var t = r.body!!.string()
            if (!t.trimStart().startsWith("WEBVTT")) t = "WEBVTT\n\n$t"
            vttCache[b] = System.currentTimeMillis() to t
            return t
        }
    }

    private fun handleSubs(s: IHTTPSession): Response = try {
        withCors(newFixedLengthResponse(Response.Status.OK, "text/vtt; charset=utf-8", vtt(s.parms["b"] ?: "", s.parms["ref"] ?: "")))
    } catch (e: Exception) { text(500, e.message ?: "hata") }

    private val cueRe = Regex("(?:(\\d{1,2}):)?(\\d{2}):(\\d{2})[.,](\\d{3})\\s*-->\\s*(?:(\\d{1,2}):)?(\\d{2}):(\\d{2})[.,](\\d{3})")
    private fun secs(h: String, m: String, sec: String, ms: String) =
        (if (h.isEmpty()) 0 else h.toInt()) * 3600 + m.toInt() * 60 + sec.toInt() + ms.toInt() / 1000.0

    private fun handleSubsSegment(s: IHTTPSession): Response = try {
        val start = s.parms["start"]?.toDouble() ?: 0.0
        val end = s.parms["end"]?.toDouble() ?: 0.0
        val full = vtt(s.parms["b"] ?: "", s.parms["ref"] ?: "")
        val picked = full.trim().split(Regex("\\r?\\n\\r?\\n+")).filter { blk ->
            val m = cueRe.find(blk) ?: return@filter false
            val g = m.groupValues
            secs(g[1], g[2], g[3], g[4]) < end && secs(g[5], g[6], g[7], g[8]) > start
        }.map { blk -> blk.lines().dropWhile { !it.contains("-->") }.joinToString("\n") }
        withCors(newFixedLengthResponse(Response.Status.OK, "text/vtt; charset=utf-8", "WEBVTT\n\n" + picked.joinToString("\n\n") + "\n"))
    } catch (e: Exception) { text(500, e.message ?: "hata") }

    // ---------- HLS yardımcıları ----------
    private val uriRe = Regex("URI=\"([^\"]+)\"")

    private fun rewrite(content: String, base: String, proxy: String, id: String, ref: String): String {
        val refB = if (ref.isNotEmpty()) b64e(ref) else ""
        fun wrap(rel: String): String {
            val abs = base.toHttpUrlOrNull()?.resolve(rel)?.toString() ?: rel
            return "$proxy/$id/fetch?b=${b64e(abs)}&ref=$refB"
        }
        val sb = StringBuilder()
        for (raw in content.lines()) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            if (line.startsWith("#")) {
                sb.append(if (line.contains("URI=\"")) uriRe.replace(line) { m -> "URI=\"" + wrap(m.groupValues[1]) + "\"" } else line)
            } else sb.append(wrap(line))
            sb.append('\n')
        }
        return if (sb.startsWith("#EXTM3U")) sb.toString() else "#EXTM3U\n$sb"
    }

    private fun injectSubs(content: String, subs: List<Sub>, proxy: String, id: String, r: Resolved): String {
        val refB = b64e(r.referer)
        var def = subs.indexOfFirst { it.lang == "tr" && !it.forced }
        if (def < 0) def = 0
        val media = subs.mapIndexed { i, s ->
            val durQs = if (r.subsMode == "segmented" && r.duration > 0) "&dur=${"%.3f".format(java.util.Locale.US, r.duration)}" else ""
            val u = "$proxy/$id/subs_playlist?b=${b64e(s.url)}&ref=$refB$durQs"
            "#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID=\"subs\",NAME=\"${s.label.replace("\"", "")}\"," +
                "DEFAULT=${if (i == def) "YES" else "NO"},AUTOSELECT=YES,FORCED=${if (s.forced) "YES" else "NO"}," +
                "LANGUAGE=\"${s.lang}\",URI=\"$u\""
        }
        val out = ArrayList<String>()
        var inserted = false
        for (line in content.lines()) {
            var l = line
            if (l.startsWith("#EXT-X-STREAM-INF")) {
                if (!inserted) { out.addAll(media); inserted = true }
                if (!l.contains("SUBTITLES=")) l = l.trimEnd(',') + ",SUBTITLES=\"subs\""
            }
            out.add(l)
        }
        return out.joinToString("\n")
    }

    private fun filterAudio(content: String, wanted: Set<String>): String {
        var kept = 0
        val out = content.lines().filter { raw ->
            val s = raw.trim()
            if (s.startsWith("#EXT-X-MEDIA:") && s.contains("TYPE=AUDIO")) {
                val lang = Regex("LANGUAGE=\"([^\"]+)\"").find(s)?.groupValues?.get(1)?.substringBefore('-')?.lowercase() ?: ""
                if (lang !in wanted) return@filter false
                kept++
            }
            true
        }
        return if (kept > 0) out.joinToString("\n") else content
    }

    private fun durationOf(master: String, masterUrl: String, ref: String): Double = try {
        val lines = master.lines()
        val i = lines.indexOfFirst { it.trim().startsWith("#EXT-X-STREAM-INF") }
        val variant = lines.drop(i + 1).firstOrNull { it.isNotBlank() && !it.startsWith("#") }?.trim()
        if (i < 0 || variant == null) 0.0 else {
            val vu = masterUrl.toHttpUrlOrNull()!!.resolve(variant).toString()
            http.newCall(headersFor(vu, ref, null)).execute().use { r ->
                Regex("#EXTINF:([\\d.]+)").findAll(r.body!!.string()).sumOf { it.groupValues[1].toDouble() }
            }
        }
    } catch (e: Exception) { 0.0 }

    // ---------- ortak ----------
    private fun headersFor(url: String, ref: String, range: String?): Request {
        val rb = Request.Builder().url(url).header("User-Agent", DEFAULT_UA).header("Accept", "*/*")
        if (ref.isNotEmpty()) {
            rb.header("Referer", ref)
            ref.toHttpUrlOrNull()?.let { rb.header("Origin", "${it.scheme}://${it.host}" + if (it.port != 80 && it.port != 443) ":${it.port}" else "") }
        }
        if (range != null) rb.header("Range", range)
        return rb.build()
    }

    private fun upstream(url: String, ref: String, range: String?): okhttp3.Response =
        http.newCall(headersFor(url, ref, range)).execute()

    private fun cleanSlug(s: String?): String? {
        val t = s?.trim()?.trim('/') ?: return null
        return if (t.isNotEmpty() && slugRe.matches(t) && !t.contains("..")) t else null
    }

    private fun langSet(v: String?, default: Set<String>?): Set<String>? {
        val t = v?.trim()?.lowercase()
        if (t == null || t.isEmpty()) return default
        if (t == "all") return null
        return t.split(',').map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }

    private fun b64e(s: String) = Base64.encodeToString(s.toByteArray(), Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
    private fun b64d(s: String) = String(Base64.decode(s, Base64.URL_SAFE or Base64.NO_WRAP))

    private fun text(code: Int, msg: String): Response =
        withCors(newFixedLengthResponse(Response.Status.lookup(code) ?: Response.Status.INTERNAL_ERROR, "text/plain; charset=utf-8", msg))

    private fun withCors(r: Response): Response { cors.forEach { (k, v) -> r.addHeader(k, v) }; return r }
}
