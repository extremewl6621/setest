package app.yerel.iptv

import app.cash.quickjs.QuickJs
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

const val DEFAULT_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

class MemoryCookieJar : CookieJar {
    private val store = HashMap<String, MutableList<Cookie>>()
    @Synchronized override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val l = store.getOrPut(url.host) { mutableListOf() }
        for (c in cookies) { l.removeAll { it.name == c.name && it.path == c.path }; l.add(c) }
    }
    @Synchronized override fun loadForRequest(url: HttpUrl): List<Cookie> =
        store[url.host]?.filter { it.matches(url) } ?: emptyList()
}

/** JS tarafına açılan arayüz (QuickJS bunu `host` nesnesi olarak görür). */
interface Host {
    fun fetchRaw(url: String, optsJson: String): String
    fun log(msg: String)
}

/**
 * Sağlayıcı JS'ini QuickJS içinde çalıştırır.
 * Her çözümleme kendi QuickJS örneği + kendi çerez kavanozu ile yapılır (oturum izolasyonu).
 */
class JsRuntime(private val http: OkHttpClient) {

    private val prelude = """
        var host_ = host;
        var host = {
          log: function(m){ host_.log(String(m)); },
          fetch: function(url, opts){ return JSON.parse(host_.fetchRaw(String(url), JSON.stringify(opts || {}))); }
        };
        var console = { log: function(){ host.log([].slice.call(arguments).join(' ')); } };
        console.warn = console.error = console.info = console.debug = console.log;
    """.trimIndent()

    fun resolve(providerId: String, script: String, slug: String, params: Map<String, String>): JSONObject {
        var result: JSONObject? = null
        var error: Throwable? = null
        // QuickJS + paketlenmiş JS derin özyineleme yapabilir: büyük yığınlı iş parçacığı
        val t = Thread(null, {
            try { result = runOnce(providerId, script, slug, params) } catch (e: Throwable) { error = e }
        }, "js-$providerId", 16L * 1024 * 1024)
        t.start(); t.join()
        error?.let { throw RuntimeException(it.message ?: it.toString()) }
        return result!!
    }

    private fun runOnce(id: String, script: String, slug: String, params: Map<String, String>): JSONObject {
        val client = http.newBuilder().cookieJar(MemoryCookieJar()).build()
        val host = object : Host {
            override fun log(msg: String) { android.util.Log.d("js:$id", msg) }
            override fun fetchRaw(url: String, optsJson: String): String = doFetch(client, url, optsJson)
        }
        val qjs = QuickJs.create()
        try {
            qjs.set("host", Host::class.java, host)
            qjs.evaluate(prelude, "prelude.js")
            qjs.evaluate(script, "$id.js")
            val req = JSONObject().put("slug", slug).put("params", JSONObject(params as Map<*, *>))
            val out = qjs.evaluate("JSON.stringify(resolve($req))", "call.js") as? String
                ?: throw RuntimeException("resolve() sonuç döndürmedi")
            return JSONObject(out)
        } finally {
            qjs.close()
        }
    }

    private fun doFetch(client: OkHttpClient, url: String, optsJson: String): String {
        val o = JSONObject(optsJson)
        val method = o.optString("method", "GET").uppercase()
        val timeout = o.optLong("timeout", 20)
        val rb = Request.Builder().url(url)
        var hasUa = false
        var contentType = "application/x-www-form-urlencoded"
        o.optJSONObject("headers")?.let { h ->
            for (k in h.keys()) {
                if (k.equals("User-Agent", true)) hasUa = true
                if (k.equals("Content-Type", true)) contentType = h.getString(k)
                if (k.equals("Accept-Encoding", true)) continue
                rb.header(k, h.getString(k))
            }
        }
        if (!hasUa) rb.header("User-Agent", DEFAULT_UA)
        if (method == "POST") rb.post((o.optString("body", "")).toRequestBody(contentType.toMediaTypeOrNull()))
        else rb.method(method, null)

        val c = client.newBuilder()
            .callTimeout(timeout, TimeUnit.SECONDS).readTimeout(timeout, TimeUnit.SECONDS).build()
        c.newCall(rb.build()).execute().use { r ->
            val hdrs = JSONObject()
            for (n in r.headers.names()) hdrs.put(n.lowercase(), r.header(n))
            return JSONObject()
                .put("status", r.code).put("headers", hdrs)
                .put("url", r.request.url.toString())
                .put("text", r.body?.string() ?: "")
                .toString()
        }
    }
}
