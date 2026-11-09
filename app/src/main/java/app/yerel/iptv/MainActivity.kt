package app.yerel.iptv

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.net.NetworkInterface

class MainActivity : Activity() {
    private lateinit var prefs: Prefs
    private lateinit var status: TextView
    private lateinit var toggle: Button
    private lateinit var lanBtn: Button
    private lateinit var info: TextView
    private lateinit var manifestEdit: EditText
    private val ui = Handler(Looper.getMainLooper())

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        prefs = Prefs(this)
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf("android.permission.POST_NOTIFICATIONS"), 1)

        val root = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(48, 36, 48, 36); setBackgroundColor(Color.parseColor("#1A1A2E")) }
        fun tv(t: String, size: Float = 16f, color: String = "#EEEEEE") = TextView(this).apply { text = t; textSize = size; setTextColor(Color.parseColor(color)); setPadding(0, 8, 0, 8) }
        fun btn(t: String, f: () -> Unit) = Button(this).apply { text = t; isFocusable = true; setOnClickListener { f() } }

        root.addView(tv("Yerel IPTV", 28f, "#E94560"))
        status = tv("", 18f); root.addView(status)
        toggle = btn("Sunucuyu Başlat") { toggleServer() }; root.addView(toggle)
        lanBtn = btn("") { prefs.lan = !prefs.lan; if (ServerService.running) { ServerService.stop(this); ui.postDelayed({ ServerService.start(this); refresh() }, 600) }; refresh() }
        root.addView(lanBtn)

        root.addView(tv("Manifest URL (boşsa APK içindeki sağlayıcılar):", 14f, "#AAAAAA"))
        manifestEdit = EditText(this).apply {
            setText(prefs.manifestUrl); setTextColor(Color.WHITE); setHintTextColor(Color.GRAY)
            hint = "https://raw.githubusercontent.com/KULLANICI/REPO/main/manifest.json"
            inputType = InputType.TYPE_TEXT_VARIATION_URI; textSize = 14f
        }
        root.addView(manifestEdit)
        root.addView(btn("Sağlayıcıları Güncelle") { updateProviders() })

        info = tv("", 14f, "#CCCCCC"); root.addView(info)
        setContentView(ScrollView(this).apply { addView(root); isFillViewport = true })
        ServerService.ensureStore(this)
    }

    override fun onResume() { super.onResume(); refresh() }

    private fun toggleServer() {
        if (ServerService.running) ServerService.stop(this) else ServerService.start(this)
        ui.postDelayed({ refresh() }, 800)
    }

    private fun updateProviders() {
        prefs.manifestUrl = manifestEdit.text.toString()
        info.text = "Güncelleniyor..."
        Thread {
            val msg = try { ServerService.ensureStore(this).update(prefs.manifestUrl) } catch (e: Exception) { "Hata: ${e.message}" }
            ui.post { refresh(); info.text = msg + "\n\n" + info.text }
        }.start()
    }

    private fun lanIp(): String? = try {
        NetworkInterface.getNetworkInterfaces().toList().flatMap { it.inetAddresses.toList() }
            .firstOrNull { !it.isLoopbackAddress && it.hostAddress?.contains(':') == false }?.hostAddress
    } catch (e: Exception) { null }

    private fun refresh() {
        val run = ServerService.running
        val host = if (prefs.lan) (lanIp() ?: "127.0.0.1") else "127.0.0.1"
        val base = "http://$host:${prefs.port}"
        status.text = if (run) "● Çalışıyor: $base" else "○ Durdu" + (ServerService.lastError.takeIf { it.isNotEmpty() }?.let { "\nHata: $it" } ?: "")
        toggle.text = if (run) "Sunucuyu Durdur" else "Sunucuyu Başlat"
        lanBtn.text = if (prefs.lan) "Erişim: Aynı Wi-Fi'deki cihazlar (açık) — kapat" else "Erişim: Yalnızca bu cihaz — Wi-Fi'ye aç"
        val sb = StringBuilder("Sağlayıcılar ve M3U linkleri:\n")
        for (p in ServerService.ensureStore(this).all()) {
            sb.append("\n• ${p.name} (${p.id}) v${p.version}\n  $base/${p.id}/stream?film=SLUG")
        }
        sb.append("\n\nM3U üretici: $base/<id>/playlist.m3u?slugs=slug1,slug2")
        info.text = sb.toString()
    }
}
