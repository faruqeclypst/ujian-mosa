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
    public boolean isLockEnabled = false;
    private boolean isMenuDialogOpen = false;
    private Runnable fallbackEnableLockRunnable;
    private int currentThemeColor = android.graphics.Color.WHITE;
    private int currentNavColor = android.graphics.Color.WHITE;
    private boolean isCurrentDark = false;
    private java.util.concurrent.ScheduledExecutorService lockCheckExecutor;
    private android.view.View floatingExamButton;
    private String customExamPin = "1234";
    private String customLauncherUrl = null;

    public class NativeExamBridge {
        @android.webkit.JavascriptInterface
        public void startExam(final String url, final String pin) {
            Log.d(TAG, "NativeExamBridge.startExam: url=" + url + ", pin=" + pin);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    startCustomExamInternal(url, pin);
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void unlockScreen() {
            Log.d(TAG, "NativeExamBridge.unlockScreen");
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    unlockScreenInternal();
                }
            });
        }

        @android.webkit.JavascriptInterface
        public void exitApp() {
            Log.d(TAG, "NativeExamBridge.exitApp");
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    exitAppInternal();
                }
            });
        }

        @android.webkit.JavascriptInterface
        public boolean isNative() {
            return true;
        }
    }

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

        // Daftarkan NativeExamBridge langsung pada WebView agar HTML lokal dapat memanggil fungsi kuncian native
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().addJavascriptInterface(new NativeExamBridge(), "AndroidExam");
                Log.d(TAG, "AndroidExam JavascriptInterface registered successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to register AndroidExam JavascriptInterface", e);
        }

        // Cegah tombol back keluar dari aplikasi (AndroidX Dispatcher)
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBackAction();
            }
        });

        // Pastikan web content berada di bawah notch kamera
        getWindow().getDecorView().post(new Runnable() {
            @Override
            public void run() {
                applyNotchToWebView();
            }
        });
        
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
        
        // 3. Keamanan: Anti Screenshot & Record (FLAG_SECURE) & Blokir Floating Overlay (Android 12+)
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            try {
                getWindow().setHideOverlayWindows(true);
            } catch (Exception e) {
                Log.e(TAG, "Gagal setHideOverlayWindows", e);
            }
        }
        
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
        isExiting = false;
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
                try {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        getWindow().setHideOverlayWindows(true);
                    }
                } catch (Exception e) {}
                handler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        checkLockTaskOnly();
                        startRepeatingCheck();
                    }
                }, 800);
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

                    try {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                            getWindow().setHideOverlayWindows(false);
                        }
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

    public void startCustomExamInternal(final String url, final String pin) {
        this.customExamPin = (pin != null && !pin.trim().isEmpty()) ? pin.trim() : "1234";
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    Log.d(TAG, "startCustomExamInternal: URL=" + url + ", PIN=" + customExamPin);
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        customLauncherUrl = getBridge().getWebView().getUrl();
                    }
                    applyNotchToWebView();
                    showFloatingExamButton();
                    enableLockModeInternal();
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().loadUrl(url);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "startCustomExamInternal failed", e);
                }
            }
        });
    }

    public void unlockScreenInternal() {
        isLockEnabled = false;
        stopRepeatingCheck();
        if (fallbackEnableLockRunnable != null) {
            handler.removeCallbacks(fallbackEnableLockRunnable);
        }
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
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

    public void stopCustomExamInternal() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    hideFloatingExamButton();
                    unlockScreenInternal();
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        if (customLauncherUrl != null && !customLauncherUrl.isEmpty()) {
                            getBridge().getWebView().loadUrl(customLauncherUrl);
                        } else {
                            getBridge().getWebView().loadUrl("https://localhost");
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "stopCustomExamInternal failed", e);
                }
            }
        });
    }

    private void showFloatingExamButton() {
        if (floatingExamButton != null) {
            hideFloatingExamButton();
        }

        final android.widget.TextView btn = new android.widget.TextView(this);
        btn.setText("🔒 MENU");
        btn.setTextColor(android.graphics.Color.WHITE);
        btn.setTextSize(13);
        btn.setTypeface(null, android.graphics.Typeface.BOLD);
        btn.setGravity(android.view.Gravity.CENTER);
        btn.setPadding(32, 18, 32, 18);

        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        bg.setColor(android.graphics.Color.parseColor("#1E293B")); // Slate 800
        bg.setStroke(3, android.graphics.Color.parseColor("#3B82F6")); // Blue 500 border
        bg.setCornerRadius(50f);
        btn.setBackground(bg);

        if (android.os.Build.VERSION.SDK_INT >= 21) {
            btn.setElevation(25f);
        }

        android.widget.FrameLayout.LayoutParams params = new android.widget.FrameLayout.LayoutParams(
            android.widget.FrameLayout.LayoutParams.WRAP_CONTENT,
            android.widget.FrameLayout.LayoutParams.WRAP_CONTENT
        );
        params.gravity = android.view.Gravity.TOP | android.view.Gravity.END;
        params.topMargin = getTopCutoutHeight() + 20;
        params.rightMargin = 40;

        btn.setOnTouchListener(new android.view.View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isClick = false;

            @Override
            public boolean onTouch(android.view.View v, android.view.MotionEvent event) {
                switch (event.getAction()) {
                    case android.view.MotionEvent.ACTION_DOWN:
                        initialX = (int) v.getX();
                        initialY = (int) v.getY();
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        isClick = true;
                        return true;

                    case android.view.MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - initialTouchX;
                        float dy = event.getRawY() - initialTouchY;
                        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                            isClick = false;
                            v.setX(initialX + dx);
                            v.setY(initialY + dy);
                        }
                        return true;

                    case android.view.MotionEvent.ACTION_UP:
                        if (isClick) {
                            showExamMenuDialog();
                        }
                        return true;
                }
                return false;
            }
        });

        floatingExamButton = btn;
        addContentView(floatingExamButton, params);
    }

    private void hideFloatingExamButton() {
        if (floatingExamButton != null) {
            try {
                if (floatingExamButton.getParent() instanceof android.view.ViewGroup) {
                    ((android.view.ViewGroup) floatingExamButton.getParent()).removeView(floatingExamButton);
                }
            } catch (Exception e) {}
            floatingExamButton = null;
        }
    }

    private void showExamMenuDialog() {
        isMenuDialogOpen = true;
        android.app.AlertDialog.Builder builder = new android.app.AlertDialog.Builder(this);
        builder.setTitle("Menu Pengawas Ujian");

        android.widget.LinearLayout layout = new android.widget.LinearLayout(this);
        layout.setOrientation(android.widget.LinearLayout.VERTICAL);
        layout.setPadding(60, 30, 60, 30);

        final android.widget.EditText inputPin = new android.widget.EditText(this);
        inputPin.setHint("Masukkan PIN Pengawas");
        inputPin.setInputType(android.text.InputType.TYPE_CLASS_NUMBER | android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD);
        inputPin.setGravity(android.view.Gravity.CENTER);
        inputPin.setTextSize(18);
        layout.addView(inputPin);

        builder.setView(layout);

        builder.setNeutralButton("Muat Ulang Halaman", new android.content.DialogInterface.OnClickListener() {
            @Override
            public void onClick(android.content.DialogInterface dialog, int which) {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().reload();
                }
            }
        });

        builder.setNegativeButton("Kembali ke Menu", new android.content.DialogInterface.OnClickListener() {
            @Override
            public void onClick(android.content.DialogInterface dialog, int which) {
                String typed = inputPin.getText().toString().trim();
                if (typed.equals(customExamPin)) {
                    stopCustomExamInternal();
                } else {
                    android.widget.Toast.makeText(MainActivity.this, "PIN Salah! Akses ditolak.", android.widget.Toast.LENGTH_SHORT).show();
                }
            }
        });

        builder.setPositiveButton("Keluar Aplikasi", new android.content.DialogInterface.OnClickListener() {
            @Override
            public void onClick(android.content.DialogInterface dialog, int which) {
                String typed = inputPin.getText().toString().trim();
                if (typed.equals(customExamPin)) {
                    exitAppInternal();
                } else {
                    android.widget.Toast.makeText(MainActivity.this, "PIN Salah! Akses ditolak.", android.widget.Toast.LENGTH_SHORT).show();
                }
            }
        });

        android.app.AlertDialog dialog = builder.create();
        dialog.setOnDismissListener(new android.content.DialogInterface.OnDismissListener() {
            @Override
            public void onDismiss(android.content.DialogInterface d) {
                isMenuDialogOpen = false;
            }
        });
        dialog.show();
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
        desc.setText("Demi keamanan ujian, aplikasi ini wajib menggunakan mode 'Sematkan Layar'.\n\nSilakan klik tombol di bawah untuk mengaktifkan kuncian.\n\nUntuk keluar ujian, gunakan tombol '🔒 MENU' dan masukkan PIN pengawas.");
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
        applyNotchToWebView();
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
                // Beri tahu WebView bahwa fokus jendela telah kembali
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            if (getBridge() != null && getBridge().getWebView() != null) {
                                getBridge().getWebView().evaluateJavascript(
                                    "window.dispatchEvent(new CustomEvent('appWindowFocus'));" +
                                    "window.dispatchEvent(new Event('focus'));",
                                    null
                                );
                            }
                        } catch (Exception e) {}
                    }
                });
            }
        } else {
            try {
                if (!isExiting) {
                    sendBroadcast(new android.content.Intent(android.content.Intent.ACTION_CLOSE_SYSTEM_DIALOGS));
                }
            } catch (Exception e) {}

            if (isLockEnabled && !isExiting && !isMenuDialogOpen) {
                // Deteksi floating apps atau overlay yang menutupi ujian: segera picu blur & alarm jika kehilangan fokus
                Log.w(TAG, "onWindowFocusChanged(false): Fokus jendela hilang saat ujian!");
                playRingtone();
                if (blockingLayout != null) {
                    blockingLayout.setVisibility(View.VISIBLE);
                }
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            if (getBridge() != null && getBridge().getWebView() != null) {
                                getBridge().getWebView().evaluateJavascript(
                                    "window.dispatchEvent(new CustomEvent('appWindowBlur'));" +
                                    "window.dispatchEvent(new Event('blur'));",
                                    null
                                );
                            }
                        } catch (Exception e) {}
                    }
                });
            }
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (isLockEnabled && !isExiting && !isMenuDialogOpen) {
            Log.w(TAG, "onUserLeaveHint: Siswa mencoba menekan tombol Home atau Recent Apps!");
            playRingtone();
            try {
                if (blockingLayout != null) {
                    blockingLayout.setVisibility(View.VISIBLE);
                }
            } catch (Exception e) {}
            try {
                android.content.Intent intent = new android.content.Intent(this, MainActivity.class);
                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK | android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(intent);
            } catch (Exception e) {}
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (isLockEnabled && !isExiting && !isMenuDialogOpen) {
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && pm.isInteractive() && !isScreenOff) {
                Log.w(TAG, "onPause: Aplikasi beralih atau diminimize saat ujian!");
                playRingtone();
                if (blockingLayout != null) {
                    blockingLayout.setVisibility(View.VISIBLE);
                }
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

    public int getTopCutoutHeight() {
        int top = 0;
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                android.view.WindowInsets insets = getWindow().getDecorView().getRootWindowInsets();
                if (insets != null) {
                    android.view.DisplayCutout cutout = insets.getDisplayCutout();
                    if (cutout != null) {
                        top = cutout.getSafeInsetTop();
                    }
                }
            }
            if (top == 0) {
                int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
                if (resourceId > 0) {
                    top = getResources().getDimensionPixelSize(resourceId);
                }
            }
        } catch (Exception e) {}
        return top;
    }

    public void applyNotchToWebView() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (getBridge() == null || getBridge().getWebView() == null) return;
                    View webView = getBridge().getWebView();
                    int top = getTopCutoutHeight();
                    if (top > 0) {
                        android.view.ViewGroup.LayoutParams lp = webView.getLayoutParams();
                        if (lp instanceof android.view.ViewGroup.MarginLayoutParams) {
                            android.view.ViewGroup.MarginLayoutParams mlp = (android.view.ViewGroup.MarginLayoutParams) lp;
                            if (mlp.topMargin != top) {
                                mlp.topMargin = top;
                                webView.setLayoutParams(mlp);
                                Log.d(TAG, "Applied top margin " + top + "px to WebView to stay below camera notch");
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "applyNotchToWebView error", e);
                }
            }
        });
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        applyNotchToWebView();
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
            applyNotchToWebView();
        } catch (Exception e) {}
    }

    @Override
    public boolean onKeyDown(int keyCode, android.view.KeyEvent event) {
        if (keyCode == android.view.KeyEvent.KEYCODE_BACK) {
            handleBackAction();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        handleBackAction();
    }

    public void handleBackAction() {
        Log.d(TAG, "handleBackAction called. isLockEnabled=" + isLockEnabled);
        
        // 1. Jika dalam mode kuncian ujian aktif
        if (isLockEnabled) {
            if (getBridge() != null && getBridge().getWebView() != null) {
                android.webkit.WebBackForwardList history = getBridge().getWebView().copyBackForwardList();
                int currentIndex = history.getCurrentIndex();
                if (currentIndex > 0) {
                    String prevUrl = history.getItemAtIndex(currentIndex - 1).getUrl();
                    // Cegah mundur ke launcher lokal jika sedang ujian
                    if (prevUrl != null && (prevUrl.contains("localhost") || prevUrl.equals(customLauncherUrl))) {
                        Log.d(TAG, "Mencegah back ke launcher ujian saat mode terkunci aktif");
                        android.widget.Toast.makeText(this, "Gunakan tombol MENU pengawas untuk keluar ujian", android.widget.Toast.LENGTH_SHORT).show();
                        return;
                    }
                    getBridge().getWebView().goBack();
                    return;
                }
            }
            android.widget.Toast.makeText(this, "Tombol Kembali dinonaktifkan demi keamanan ujian", android.widget.Toast.LENGTH_SHORT).show();
            return;
        }

        // 2. Jika di luar mode ujian (launcher)
        if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
            return;
        }

        // DILARANG KERAS panggil super.onBackPressed() atau finish() agar aplikasi tidak pernah tertutup via tombol back!
        android.widget.Toast.makeText(this, "Tombol Kembali dinonaktifkan demi keamanan ujian", android.widget.Toast.LENGTH_SHORT).show();
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
            if (floatingExamButton != null) {
                hideFloatingExamButton();
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
