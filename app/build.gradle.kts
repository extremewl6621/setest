plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "app.yerel.iptv"
    compileSdk = 34

    defaultConfig {
        applicationId = "app.yerel.iptv"
        minSdk = 21
        targetSdk = 33   // 33: foreground-service tip zorunluluğu yok (APK yan yükleme için yeterli)
        versionCode = 1
        versionName = "0.1.0"
    }
    buildTypes { release { isMinifyEnabled = false } }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    // providers-repo/ (manifest.json + providers/*.js) APK içine varsayılan sağlayıcı olarak gömülür
    sourceSets["main"].assets.srcDirs("src/main/assets", "../providers-repo")
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    implementation("app.cash.quickjs:quickjs-android:0.9.2")
}
