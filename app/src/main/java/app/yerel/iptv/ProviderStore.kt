package app.yerel.iptv

import android.content.Context
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Provider(
    val id: String,
    val name: String,
    val version: String,
    val file: String,
    val baseUrl: String,
    val enabled: Boolean
)

/**
 * Sağlayıcı deposu. filesDir/providers/<id>.js + installed.json
 * İlk açılışta APK içindeki manifest.json + providers/*.js kopyalanır.
 * Sonra manifest URL'sinden (GitHub raw) güncellenir.
 */
class ProviderStore(private val ctx: Context, private val http: OkHttpClient) {
    private val dir = File(ctx.filesDir, "providers").apply { mkdirs() }
    private val index = File(dir, "installed.json")
    private val idRe = Regex("^[a-z0-9_-]{2,32}$")

    @Volatile private var list: List<Provider> = emptyList()

    init {
        if (!index.exists()) installBundled()
        list = readIndex()
    }

    fun all(): List<Provider> = list
    fun get(id: String): Provider? = list.firstOrNull { it.id == id && it.enabled }
    fun script(id: String): String? = File(dir, "$id.js").takeIf { it.exists() }?.readText()

    private fun installBundled() {
        try {
            val manifest = ctx.assets.open("manifest.json").bufferedReader().readText()
            val ps = JSONObject(manifest).getJSONArray("providers")
            for (i in 0 until ps.length()) {
                val p = ps.getJSONObject(i)
                val id = p.getString("id")
                if (!idRe.matches(id)) continue
                val js = ctx.assets.open(p.getString("file")).bufferedReader().readText()
                File(dir, "$id.js").writeText(js)
            }
            index.writeText(ps.toString())
        } catch (e: Exception) {
            index.writeText("[]")
        }
    }

    private fun readIndex(): List<Provider> = try {
        val arr = JSONArray(index.readText())
        (0 until arr.length()).map {
            val p = arr.getJSONObject(it)
            Provider(
                p.getString("id"), p.optString("name", p.getString("id")),
                p.optString("version", "0"), p.optString("file", ""),
                p.optString("baseUrl", ""), p.optBoolean("enabled", true)
            )
        }
    } catch (e: Exception) { emptyList() }

    /** Manifest + JS dosyalarını indirir. Dönüş: kullanıcıya gösterilecek özet. */
    fun update(manifestUrl: String): String {
        if (manifestUrl.isBlank()) return "Manifest URL boş; gömülü sağlayıcılar kullanılıyor."
        val manifestText = httpGet(manifestUrl)
        val root = JSONObject(manifestText)
        val ps = root.getJSONArray("providers")
        val base = manifestUrl.substringBeforeLast('/') + "/"
        val downloaded = HashMap<String, String>()
        val ok = JSONArray()
        val report = StringBuilder()
        for (i in 0 until ps.length()) {
            val p = ps.getJSONObject(i)
            val id = p.optString("id")
            if (!idRe.matches(id)) { report.append("! geçersiz id: $id\n"); continue }
            val file = p.optString("file")
            val url = if (file.startsWith("http")) file else base + file.trimStart('/')
            try {
                downloaded[id] = httpGet(url)
                ok.put(p)
                report.append("✓ $id ${p.optString("version")}\n")
            } catch (e: Exception) {
                report.append("✗ $id: ${e.message}\n")
            }
        }
        if (ok.length() == 0) return "Hiç sağlayıcı indirilemedi:\n$report"
        for ((id, js) in downloaded) {
            val tmp = File(dir, "$id.js.tmp")
            tmp.writeText(js)
            tmp.renameTo(File(dir, "$id.js"))
        }
        index.writeText(ok.toString())
        list = readIndex()
        return report.toString().trim()
    }

    private fun httpGet(url: String): String {
        val req = Request.Builder().url(url).header("Cache-Control", "no-cache").build()
        http.newCall(req).execute().use { r ->
            if (!r.isSuccessful) throw RuntimeException("HTTP ${r.code}")
            return r.body!!.string()
        }
    }
}
