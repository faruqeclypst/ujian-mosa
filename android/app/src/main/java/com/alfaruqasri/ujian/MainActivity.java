package com.alfaruqasri.ujian;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    public static MainActivity instance;

    private android.media.ToneGenerator toneGenerator;
    private int lastLockState = -1;
    private android.widget.LinearLayout blockingLayout;
    private android.os.Handler handler = new android.os.Handler();
    private android.os.Handler alarmHandler = new android.os.Handler();
    private boolean isAlarmPlaying = false;
    private boolean isExiting = false;
    private boolean isLockEnabled = false;
    private Runnable fallbackEnableLockRunnable;
    private int currentThemeColor = android.graphics.Color.WHITE;
    private int currentNavColor = android.graphics.Color.WHITE;
    private boolean isCurrentDark = false;
    private java.util.concurrent.ScheduledExecutorService lockCheckExecutor;

    public static volatile boolean isScreenOff = false;
    public static volatile long lastScreenOffTime = 0;
    public static volatile long lastScreenOnTime = 0;
    private android.content.BroadcastReceiver screenReceiver;

    private Runnable alarmRunnable = new Runnable() {
        @Override
        public void run() {
            if (isAlarmPlaying) {
                playTone();
                alarmHandler.postDelayed(this, 600);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 1. Daftarkan Plugin SEBELUM super.onCreate agar Capacitor BridgeBuilder dapat memuatnya
        registerPlugin(CheatAlert.class);
        super.onCreate(savedInstanceState);
        instance = this;
        
        // Jaga agar layar tidak mati otomatis saat ujian berlangsung
        try {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (Exception e) {}

        // Deteksi event layar mati / nyala agar tidak memicu alarm palsu
        try {
            android.content.IntentFilter filter = new android.content.IntentFilter();
            filter.addAction(android.content.Intent.ACTION_SCREEN_OFF);
            filter.addAction(android.content.Intent.ACTION_SCREEN_ON);
            filter.addAction(android.content.Intent.ACTION_USER_PRESENT);
            screenReceiver = new android.content.BroadcastReceiver() {
                @Override
                public void onReceive(Context context, android.content.Intent intent) {
                    String action = (intent != null) ? intent.getAction() : null;
                    if (android.content.Intent.ACTION_SCREEN_OFF.equals(action)) {
                        isScreenOff = true;
                        lastScreenOffTime = System.currentTimeMillis();
                        Log.d(TAG, "Screen OFF event detected");
                    } else if (android.content.Intent.ACTION_SCREEN_ON.equals(action) || 
                               android.content.Intent.ACTION_USER_PRESENT.equals(action)) {
                        isScreenOff = false;
                        lastScreenOnTime = System.currentTimeMillis();
                        Log.d(TAG, "Screen ON event detected");
                    }
                }
            };
            registerReceiver(screenReceiver, filter);
        } catch (Exception e) {
            Log.e(TAG, "Failed to register screenReceiver", e);
        }

        // Notch / Display Cutout: Cegah header tertutup notch / punch-hole kamera HP
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
            getWindow().setAttributes(lp);
        }

        // Inisialisasi tema notch / status bar berdasarkan cache atau preferensi sistem
        try {
            android.content.SharedPreferences prefs = getSharedPreferences("app_theme_prefs", Context.MODE_PRIVATE);
            String lastTheme = prefs.getString("last_theme", null);
            if (lastTheme != null) {
                setThemeModeInternal(lastTheme, null);
            } else {
                int nightMode = getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
                boolean isSystemDark = nightMode == android.content.res.Configuration.UI_MODE_NIGHT_YES;
                setThemeModeInternal(isSystemDark ? "dark" : "light", null);
            }
        } catch (Exception e) {}
        
        // 2. Layar Penuh Otomatis
        makeFullScreen();
        
        // 3. Keamanan: Anti Screenshot & Record (FLAG_SECURE)
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        // CATATAN PENTING: setHideOverlayWindows sengaja TIDAK diaktifkan karena terbukti memblokir
        // overlay suggestion bar dan predictive text pada keyboard Android (Gboard / Samsung / SwiftKey)
        // yang menyebabkan lag dan delay parah saat mengetik.
        
        // 4. Inisialisasi Layar Blokir (Layout)
        createBlockingLayout();
        
        // 5. Safety Fallback: Tunggu respon dari React (AppVersionGuard).
        // Jika dalam 2.5 detik tidak ada sinyal dari JS (misal offline atau JS crash),
        // otomatis aktifkan kuncian ujian demi keamanan.
        fallbackEnableLockRunnable = new Runnable() {
            @Override
            public void run() {
                if (!isLockEnabled && !isExiting) {
                    Log.d(TAG, "Fallback timeout (2.5s): Mengaktifkan kuncian ujian secara otomatis");
                    enableLockModeInternal();
                }
            }
        };
        handler.postDelayed(fallbackEnableLockRunnable, 2500);
    }

    public void setThemeModeInternal(final String theme, final String colorHex) {
        isCurrentDark = "dark".equalsIgnoreCase(theme);
        int parsedColor;
        try {
            if (colorHex != null && !colorHex.isEmpty()) {
                parsedColor = android.graphics.Color.parseColor(colorHex);
            } else {
                parsedColor = isCurrentDark ? android.graphics.Color.parseColor("#0f172a") : android.graphics.Color.WHITE;
            }
        } catch (Exception e) {
            parsedColor = isCurrentDark ? android.graphics.Color.parseColor("#0f172a") : android.graphics.Color.WHITE;
        }
        currentThemeColor = parsedColor;
        currentNavColor = isCurrentDark ? android.graphics.Color.parseColor("#020617") : android.graphics.Color.WHITE;

        try {
            android.content.SharedPreferences prefs = getSharedPreferences("app_theme_prefs", Context.MODE_PRIVATE);
            prefs.edit().putString("last_theme", isCurrentDark ? "dark" : "light").apply();
        } catch (Exception e) {}

        applyThemeColors();
    }

    public void applyThemeColors() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    // Update Window & DecorView background (digunakan oleh letterbox notch)
                    getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(currentThemeColor));
                    getWindow().getDecorView().setBackgroundColor(currentThemeColor);

                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                        getWindow().setStatusBarColor(currentThemeColor);
                        getWindow().setNavigationBarColor(currentNavColor);
                    }

                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                        androidx.core.view.WindowInsetsControllerCompat controller = 
                            androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                        if (controller != null) {
                            controller.setAppearanceLightStatusBars(!isCurrentDark);
                            controller.setAppearanceLightNavigationBars(!isCurrentDark);
                        }
                    } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                        View decorView = getWindow().getDecorView();
                        int flags = decorView.getSystemUiVisibility();
                        if (!isCurrentDark) {
                            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        } else {
                            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                        }
                        decorView.setSystemUiVisibility(flags);
                    }

                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().setBackgroundColor(currentThemeColor);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Gagal sinkronisasi warna notch / status bar", e);
                }
            }
        });
    }

    public void enableLockModeInternal() {
        if (isExiting) return;
        isLockEnabled = true;
        if (fallbackEnableLockRunnable != null) {
            handler.removeCallbacks(fallbackEnableLockRunnable);
        }
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Log.d(TAG, "enableLockModeInternal: Kuncian diaktifkan");
                try {
                    ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                    if (am != null && am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE) {
                        startLockTask();
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Auto startLockTask failed: " + e.getMessage());
                }
                checkLockTaskOnly();
                startRepeatingCheck();
            }
        });
    }

    public void disableLockForUpdateInternal() {
        isExiting = true;
        isLockEnabled = false;
        stopRepeatingCheck();
        if (fallbackEnableLockRunnable != null) {
            handler.removeCallbacks(fallbackEnableLockRunnable);
        }
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "disableLockForUpdateInternal: Melepas kuncian untuk update");
                    handler.removeCallbacksAndMessages(null);
                    alarmHandler.removeCallbacksAndMessages(null);
                    isAlarmPlaying = false;
                    stopRingtone();

                    if (blockingLayout != null) {
                        blockingLayout.setVisibility(View.GONE);
                    }

                    try {
                        stopLockTask();
                    } catch (Exception e) {}
                } catch (Exception e) {}
            }
        });
    }

    public void openUrlAndExitInternal(final String url) {
        isExiting = true;
        isLockEnabled = false;
        if (fallbackEnableLockRunnable != null) {
            handler.removeCallbacks(fallbackEnableLockRunnable);
        }
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "openUrlAndExitInternal: Membuka browser: " + url);
                    handler.removeCallbacksAndMessages(null);
                    alarmHandler.removeCallbacksAndMessages(null);
                    isAlarmPlaying = false;
                    stopRingtone();

                    if (blockingLayout != null) {
                        blockingLayout.setVisibility(View.GONE);
                    }

                    try {
                        stopLockTask();
                    } catch (Exception e) {}

                    // Jeda 350ms agar OS Android selesai memproses stopLockTask sebelum meluncurkan browser
                    new android.os.Handler().postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            try {
                                android.content.Intent intent = new android.content.Intent(
                                    android.content.Intent.ACTION_VIEW, 
                                    android.net.Uri.parse(url)
                                );
                                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                            } catch (Exception e) {
                                Log.e(TAG, "Gagal meluncurkan intent ACTION_VIEW", e);
                            }

                            // Tutup aplikasi setelah browser dipanggil
                            new android.os.Handler().postDelayed(new Runnable() {
                                @Override
                                public void run() {
                                    try {
                                        if (android.os.Build.VERSION.SDK_INT >= 21) {
                                            finishAndRemoveTask();
                                        } else {
                                            finish();
                                        }
                                    } catch (Exception e) {}

                                    new android.os.Handler().postDelayed(new Runnable() {
                                        @Override
                                        public void run() {
                                            System.exit(0);
                                        }
                                    }, 500);
                                }
                            }, 1200);
                        }
                    }, 350);
                } catch (Exception e) {}
            }
        });
    }

    public void exitAppInternal() {
        isExiting = true;
        isLockEnabled = false;
        stopRepeatingCheck();
        if (fallbackEnableLockRunnable != null) {
            handler.removeCallbacks(fallbackEnableLockRunnable);
        }
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "exitAppInternal: Menutup aplikasi secara bersih");
                    handler.removeCallbacksAndMessages(null);
                    alarmHandler.removeCallbacksAndMessages(null);
                    isAlarmPlaying = false;
                    stopRingtone();

                    if (blockingLayout != null) {
                        blockingLayout.setVisibility(View.GONE);
                    }

                    try {
                        stopLockTask();
                    } catch (Exception e) {}

                    if (android.os.Build.VERSION.SDK_INT >= 21) {
                        finishAndRemoveTask();
                    } else {
                        finish();
                    }

                    new android.os.Handler().postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            System.exit(0);
                        }
                    }, 150);
                } catch (Exception e) {}
            }
        });
    }

    private void createBlockingLayout() {
        blockingLayout = new android.widget.LinearLayout(this);
        blockingLayout.setOrientation(android.widget.LinearLayout.VERTICAL);
        blockingLayout.setGravity(android.view.Gravity.CENTER);
        blockingLayout.setBackgroundColor(android.graphics.Color.parseColor("#E11D48")); // Rose 600
        blockingLayout.setPadding(80, 80, 80, 80);
        blockingLayout.setZ(999999f); 
        blockingLayout.setVisibility(View.GONE);

        android.widget.TextView title = new android.widget.TextView(this);
        title.setText("AKSES DIBLOKIR");
        title.setTextColor(android.graphics.Color.WHITE);
        title.setTextSize(28);
        title.setGravity(android.view.Gravity.CENTER);
        title.setTypeface(null, android.graphics.Typeface.BOLD);
        title.setPadding(0, 0, 0, 40);

        android.widget.TextView desc = new android.widget.TextView(this);
        desc.setText("Demi keamanan ujian, aplikasi ini harus menggunakan mode 'Sematkan Layar'.\n\nSilakan klik tombol di bawah untuk mengaktifkan kuncian.\n\nJika ingin keluar, silakan klik tombol melayang 'CBT' > Icon Keluar > Masukkan password 'quit'.");
        desc.setTextColor(android.graphics.Color.WHITE);
        desc.setTextSize(16);
        desc.setGravity(android.view.Gravity.CENTER);
        desc.setPadding(0, 0, 0, 80);

        android.widget.Button btn = new android.widget.Button(this);
        btn.setText("AKTIFKAN MODE KUNCI");
        btn.setBackgroundColor(android.graphics.Color.WHITE);
        btn.setTextColor(android.graphics.Color.parseColor("#E11D48"));
        btn.setPadding(40, 20, 40, 20);
        btn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    startLockTask();
                    handler.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            checkLockTaskOnly();
                        }
                    }, 400);
                } catch (Exception e) {}
            }
        });

        blockingLayout.addView(title);
        blockingLayout.addView(desc);
        blockingLayout.addView(btn);
        
        addContentView(blockingLayout, new android.view.ViewGroup.LayoutParams(
            android.view.ViewGroup.LayoutParams.MATCH_PARENT, 
            android.view.ViewGroup.LayoutParams.MATCH_PARENT));
    }

    @Override
    public void onResume() {
        super.onResume();
        makeFullScreen();
        applyThemeColors();
        if (isLockEnabled) {
            checkLockTaskOnly();
        }
    }

    private void startRepeatingCheck() {
        stopRepeatingCheck();
        lockCheckExecutor = java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
        lockCheckExecutor.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                if (isLockEnabled && !isExiting) {
                    checkLockTaskOnly();
                }
            }
        }, 1, 1, java.util.concurrent.TimeUnit.SECONDS);
    }

    private void stopRepeatingCheck() {
        if (lockCheckExecutor != null) {
            try {
                lockCheckExecutor.shutdownNow();
            } catch (Exception e) {}
            lockCheckExecutor = null;
        }
    }

    private void checkLockTaskOnly() {
        if (!isLockEnabled || isFinishing() || isExiting) return;
        try {
            // 1. Cek apakah layar sedang mati/sleep. Jika mati, abaikan dan jangan bunyikan alarm!
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                return;
            }

            // 2. Beri jeda toleransi 2.5 detik setelah layar dinyalakan kembali agar status kuncian stabil
            if (System.currentTimeMillis() - lastScreenOnTime < 2500) {
                return;
            }

            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            final int lockState = (am != null) ? am.getLockTaskModeState() : ActivityManager.LOCK_TASK_MODE_NONE;
            final int previousState = lastLockState;

            // Jika aplikasi sudah dalam keadaan terkunci (Pinned) dan status tidak berubah,
            // langsung abaikan agar tidak membebani UI thread saat siswa sedang mengetik ujian.
            if (previousState == lockState && lockState != ActivityManager.LOCK_TASK_MODE_NONE) {
                return;
            }

            lastLockState = lockState;
            final boolean stateChanged = (lockState != previousState);

            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (isFinishing() || isExiting) return;
                    if (lockState == ActivityManager.LOCK_TASK_MODE_NONE) {
                        if (blockingLayout != null && blockingLayout.getVisibility() != View.VISIBLE) {
                            blockingLayout.setVisibility(View.VISIBLE);
                        }
                        // Alarm HANYA berdering jika sebelumnya pernah terkunci (siswa melepas kuncian paksa)
                        if (stateChanged && previousState != -1 && previousState != ActivityManager.LOCK_TASK_MODE_NONE) {
                            playRingtone();
                        }
                    } else {
                        if (blockingLayout != null && blockingLayout.getVisibility() != View.GONE) {
                            blockingLayout.setVisibility(View.GONE);
                        }
                        if (previousState == ActivityManager.LOCK_TASK_MODE_NONE) {
                            stopRingtone();
                        }
                    }
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "checkLockTaskOnly error", e);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (isFinishing() || isExiting) return;
        
        if (hasFocus) {
            getWindow().getDecorView().postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (!isFinishing() && !isExiting) {
                        makeFullScreen();
                    }
                }
            }, 500);
            if (isLockEnabled) {
                checkLockTaskOnly();
            }
        }
    }

    public void playRingtone() {
        if (isAlarmPlaying) return; 
        isAlarmPlaying = true;
        alarmHandler.post(alarmRunnable);
    }

    public void stopRingtone() {
        isAlarmPlaying = false;
        alarmHandler.removeCallbacks(alarmRunnable);
        try {
            if (toneGenerator != null) {
                toneGenerator.stopTone();
            }
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.cancel();
            }
        } catch (Exception e) {}
    }

    private void playTone() {
        try {
            android.media.AudioManager am = (android.media.AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                int max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);
                am.setStreamVolume(android.media.AudioManager.STREAM_ALARM, max, 0);
            }

            if (toneGenerator == null) {
                toneGenerator = new android.media.ToneGenerator(android.media.AudioManager.STREAM_ALARM, 100);
            }
            toneGenerator.startTone(android.media.ToneGenerator.TONE_SUP_ERROR, 400);

            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    v.vibrate(android.os.VibrationEffect.createOneShot(400, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(400);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void makeFullScreen() {
        if (isFinishing() || isExiting) return;
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                if (lp.layoutInDisplayCutoutMode != WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER) {
                    lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
                    getWindow().setAttributes(lp);
                }
            }

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                androidx.core.view.WindowInsetsControllerCompat controller = 
                    androidx.core.view.WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                if (controller != null) {
                    controller.hide(androidx.core.view.WindowInsetsCompat.Type.systemBars());
                    controller.setSystemBarsBehavior(
                        androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                }
            } else {
                View decorView = getWindow().getDecorView();
                int flags = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN;
                if (decorView.getSystemUiVisibility() != flags) {
                    decorView.setSystemUiVisibility(flags);
                }
            }
        } catch (Exception e) {}
    }

    @Override
    public void onBackPressed() {
        // Biarkan kosong
    }

    @Override
    public void finish() {
        isExiting = true;
        stopRepeatingCheck();
        try {
            handler.removeCallbacksAndMessages(null);
            alarmHandler.removeCallbacksAndMessages(null);
            isAlarmPlaying = false;
            stopRingtone();
            
            if (blockingLayout != null) {
                blockingLayout.setVisibility(View.GONE);
            }
            
            stopLockTask();
        } catch (Exception e) {}
        
        if (android.os.Build.VERSION.SDK_INT >= 21) {
            super.finishAndRemoveTask();
        } else {
            super.finish();
        }
    }

    @Override
    public void onDestroy() {
        stopRepeatingCheck();
        try {
            if (screenReceiver != null) {
                unregisterReceiver(screenReceiver);
                screenReceiver = null;
            }
        } catch (Exception e) {}
        try {
            handler.removeCallbacksAndMessages(null);
            alarmHandler.removeCallbacksAndMessages(null);
        } catch (Exception e) {}
        super.onDestroy();
    }
}
