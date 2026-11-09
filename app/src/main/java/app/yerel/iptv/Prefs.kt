package app.yerel.iptv

import android.content.Context

class Prefs(ctx: Context) {
    private val sp = ctx.getSharedPreferences("yerel", Context.MODE_PRIVATE)

    /** Boşsa APK içindeki gömülü sağlayıcılar kullanılır. Örn: https://raw.githubusercontent.com/KULLANICI/REPO/main/manifest.json */
    var manifestUrl: String
        get() = sp.getString("manifest", "") ?: ""
        set(v) = sp.edit().putString("manifest", v.trim()).apply()

    var port: Int
        get() = sp.getInt("port", 8080)
        set(v) = sp.edit().putInt("port", v).apply()

    /** true: aynı Wi-Fi'deki diğer cihazlar da bağlanabilir (0.0.0.0). false: yalnızca bu cihaz (127.0.0.1). */
    var lan: Boolean
        get() = sp.getBoolean("lan", false)
        set(v) = sp.edit().putBoolean("lan", v).apply()

    var autostart: Boolean
        get() = sp.getBoolean("autostart", true)
        set(v) = sp.edit().putBoolean("autostart", v).apply()
}
