package app.yerel.iptv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import okhttp3.Dispatcher
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class ServerService : Service() {

    companion object {
        @Volatile var server: LocalServer? = null
        @Volatile var store: ProviderStore? = null
        @Volatile var lastError: String = ""
        const val ACTION_STOP = "app.yerel.iptv.STOP"
        val running: Boolean get() = server?.isAlive == true

        fun start(ctx: Context) {
            val i = Intent(ctx, ServerService::class.java)
            if (Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i) else ctx.startService(i)
        }
        fun stop(ctx: Context) { ctx.stopService(Intent(ctx, ServerService::class.java)) }

        /** Sağlayıcı deposunu (sunucu kapalıyken de) ortak kullanmak için. */
        @Synchronized fun ensureStore(ctx: Context): ProviderStore {
            store?.let { return it }
            val s = ProviderStore(ctx.applicationContext, buildHttp())
            store = s
            return s
        }

        fun buildHttp(): OkHttpClient {
            val d = Dispatcher().apply { maxRequests = 128; maxRequestsPerHost = 32 }
            return OkHttpClient.Builder()
                .dispatcher(d)
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .followRedirects(true).followSslRedirects(true)
                .build()
        }
    }

    private var wake: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
        startForeground(1, notification())
        if (!running) {
            try {
                val prefs = Prefs(this)
                val http = buildHttp()
                val st = ensureStore(this)
                val srv = LocalServer(st, JsRuntime(http), http, if (prefs.lan) "0.0.0.0" else "127.0.0.1", prefs.port)
                srv.start(NanoHTTPDTimeout, false)
                server = srv
                lastError = ""
                wake = (getSystemService(Context.POWER_SERVICE) as PowerManager)
                    .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "yerel:server").apply { acquire() }
            } catch (e: Exception) {
                lastError = e.message ?: e.toString()
                stopSelf()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        server?.stop(); server = null
        wake?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }

    private fun notification(): Notification {
        val chId = "yerel_server"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26)
            nm.createNotificationChannel(NotificationChannel(chId, "Yerel IPTV", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java),
            if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0)
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, chId) else Notification.Builder(this)
        return b.setContentTitle("Yerel IPTV çalışıyor")
            .setContentText("http://127.0.0.1:${Prefs(this).port}")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(open).setOngoing(true).build()
    }
}

/** NanoHTTPD soket okuma zaman aşımı (ms): uzun segmentler için yüksek tutulur. */
const val NanoHTTPDTimeout = 60_000
