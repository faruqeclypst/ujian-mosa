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
    private long backPressedTime = 0;
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
        public void notifyWebOverlayActive() {
            Log.d(TAG, "NativeExamBridge.notifyWebOverlayActive: Web CBT overlay aktif, sembunyikan tombol floating native");
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    hideFloatingExamButton();
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
            if (isAlarmPlaying && isLockEnabled && !isFinishing() && !isExiting) {
                playTone();
                alarmHandler.postDelayed(this, 600);
            } else {
                isAlarmPlaying = false;
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
                    // Cek jika halaman yang dimuat adalah web Exam AA CBT yang sudah punya overlay sendiri
                    scheduleWebOverlayCheck();
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

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private static class IconView extends android.view.View {
        private final String iconType;
        private final int iconColor;

        public IconView(Context context, String iconType, int iconColor) {
            super(context);
            this.iconType = iconType;
            this.iconColor = iconColor;
        }

        @Override
        protected void onDraw(android.graphics.Canvas canvas) {
            super.onDraw(canvas);
            float w = getWidth();
            float h = getHeight();
            if (w == 0 || h == 0) return;

            android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
            paint.setColor(iconColor);
            paint.setStrokeCap(android.graphics.Paint.Cap.ROUND);
            paint.setStrokeJoin(android.graphics.Paint.Join.ROUND);

            float scale = Math.min(w, h) / 24f;
            paint.setStrokeWidth(2.2f * scale);

            if ("refresh".equals(iconType)) {
                paint.setStyle(android.graphics.Paint.Style.STROKE);
                android.graphics.RectF rect = new android.graphics.RectF(4f * scale, 4f * scale, 20f * scale, 20f * scale);
                canvas.drawArc(rect, 40, 100, false, paint);
                canvas.drawArc(rect, 220, 100, false, paint);

                paint.setStyle(android.graphics.Paint.Style.FILL);
                android.graphics.Path p1 = new android.graphics.Path();
                p1.moveTo(21f * scale, 9f * scale);
                p1.lineTo(21f * scale, 4f * scale);
                p1.lineTo(16f * scale, 4f * scale);
                p1.close();
                canvas.drawPath(p1, paint);

                android.graphics.Path p2 = new android.graphics.Path();
                p2.moveTo(3f * scale, 15f * scale);
                p2.lineTo(3f * scale, 20f * scale);
                p2.lineTo(8f * scale, 20f * scale);
                p2.close();
                canvas.drawPath(p2, paint);
            } else if ("logout".equals(iconType)) {
                paint.setStyle(android.graphics.Paint.Style.STROKE);
                android.graphics.Path door = new android.graphics.Path();
                door.moveTo(9f * scale, 21f * scale);
                door.lineTo(5f * scale, 21f * scale);
                door.lineTo(5f * scale, 3f * scale);
                door.lineTo(9f * scale, 3f * scale);
                canvas.drawPath(door, paint);

                canvas.drawLine(9f * scale, 12f * scale, 21f * scale, 12f * scale, paint);
                android.graphics.Path arrow = new android.graphics.Path();
                arrow.moveTo(16f * scale, 7f * scale);
                arrow.lineTo(21f * scale, 12f * scale);
                arrow.lineTo(16f * scale, 17f * scale);
                canvas.drawPath(arrow, paint);
            } else if ("dots".equals(iconType)) {
                paint.setStyle(android.graphics.Paint.Style.FILL);
                float r = 2.0f * scale;
                canvas.drawCircle(5f * scale, 12f * scale, r, paint);
                canvas.drawCircle(12f * scale, 12f * scale, r, paint);
                canvas.drawCircle(19f * scale, 12f * scale, r, paint);
            } else if ("close".equals(iconType)) {
                paint.setStyle(android.graphics.Paint.Style.STROKE);
                canvas.drawLine(6f * scale, 6f * scale, 18f * scale, 18f * scale, paint);
                canvas.drawLine(18f * scale, 6f * scale, 6f * scale, 18f * scale, paint);
            } else if ("shield".equals(iconType)) {
                paint.setStyle(android.graphics.Paint.Style.STROKE);
                android.graphics.Path shield = new android.graphics.Path();
                shield.moveTo(12f * scale, 22f * scale);
                shield.cubicTo(12f * scale, 22f * scale, 20f * scale, 18f * scale, 20f * scale, 12f * scale);
                shield.lineTo(20f * scale, 5f * scale);
                shield.lineTo(12f * scale, 2f * scale);
                shield.lineTo(4f * scale, 5f * scale);
                shield.lineTo(4f * scale, 12f * scale);
                shield.cubicTo(4f * scale, 18f * scale, 12f * scale, 22f * scale, 12f * scale, 22f * scale);
                canvas.drawPath(shield, paint);

                canvas.drawLine(12f * scale, 7f * scale, 12f * scale, 13f * scale, paint);
                paint.setStyle(android.graphics.Paint.Style.FILL);
                canvas.drawCircle(12f * scale, 16.5f * scale, 1.4f * scale, paint);
            }
        }
    }

    private void showFloatingExamButton() {
        if (floatingExamButton != null) {
            hideFloatingExamButton();
        }

        final int fabSize = dpToPx(48);
        final int subFabSize = dpToPx(40);
        final int iconSizeSub = dpToPx(18);
        final int iconSizeMain = dpToPx(20);
        final int spacing = dpToPx(10);

        final android.widget.LinearLayout container = new android.widget.LinearLayout(this);
        container.setOrientation(android.widget.LinearLayout.VERTICAL);
        container.setGravity(android.view.Gravity.CENTER_HORIZONTAL);
        container.setClipChildren(false);
        container.setClipToPadding(false);

        // Sub-Actions Layout (Refresh & Exit yang muncul ke atas saat dibuka)
        final android.widget.LinearLayout actionsLayout = new android.widget.LinearLayout(this);
        actionsLayout.setOrientation(android.widget.LinearLayout.VERTICAL);
        actionsLayout.setGravity(android.view.Gravity.CENTER_HORIZONTAL);
        actionsLayout.setVisibility(View.GONE);
        actionsLayout.setClipChildren(false);
        actionsLayout.setClipToPadding(false);

        // 1. Sub-Button Refresh (Emerald Circle)
        final android.widget.FrameLayout btnRefresh = new android.widget.FrameLayout(this);
        android.graphics.drawable.GradientDrawable bgRefresh = new android.graphics.drawable.GradientDrawable();
        bgRefresh.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        bgRefresh.setColor(android.graphics.Color.parseColor("#10B981")); // Emerald 500
        bgRefresh.setStroke(dpToPx(1), android.graphics.Color.parseColor("#34D399")); // Emerald 400
        btnRefresh.setBackground(bgRefresh);
        if (android.os.Build.VERSION.SDK_INT >= 21) {
            btnRefresh.setElevation(dpToPx(6));
        }

        IconView iconRefresh = new IconView(this, "refresh", android.graphics.Color.WHITE);
        android.widget.FrameLayout.LayoutParams iconRefreshParams = new android.widget.FrameLayout.LayoutParams(
            iconSizeSub, iconSizeSub, android.view.Gravity.CENTER
        );
        btnRefresh.addView(iconRefresh, iconRefreshParams);

        android.widget.LinearLayout.LayoutParams refreshParams = new android.widget.LinearLayout.LayoutParams(subFabSize, subFabSize);
        refreshParams.bottomMargin = spacing;
        actionsLayout.addView(btnRefresh, refreshParams);

        // 2. Sub-Button Exit (Rose Circle)
        final android.widget.FrameLayout btnExit = new android.widget.FrameLayout(this);
        android.graphics.drawable.GradientDrawable bgExit = new android.graphics.drawable.GradientDrawable();
        bgExit.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        bgExit.setColor(android.graphics.Color.parseColor("#EF4444")); // Rose 500
        bgExit.setStroke(dpToPx(1), android.graphics.Color.parseColor("#F87171")); // Rose 400
        btnExit.setBackground(bgExit);
        if (android.os.Build.VERSION.SDK_INT >= 21) {
            btnExit.setElevation(dpToPx(6));
        }

        IconView iconExit = new IconView(this, "logout", android.graphics.Color.WHITE);
        android.widget.FrameLayout.LayoutParams iconExitParams = new android.widget.FrameLayout.LayoutParams(
            iconSizeSub, iconSizeSub, android.view.Gravity.CENTER
        );
        btnExit.addView(iconExit, iconExitParams);

        android.widget.LinearLayout.LayoutParams exitParams = new android.widget.LinearLayout.LayoutParams(subFabSize, subFabSize);
        exitParams.bottomMargin = spacing;
        actionsLayout.addView(btnExit, exitParams);

        // 3. Main Toggle Button (Emerald Closed, Slate Open)
        final android.widget.FrameLayout btnToggle = new android.widget.FrameLayout(this);
        final android.graphics.drawable.GradientDrawable bgToggleClosed = new android.graphics.drawable.GradientDrawable();
        bgToggleClosed.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        bgToggleClosed.setColor(android.graphics.Color.parseColor("#10B981")); // Emerald 500
        bgToggleClosed.setStroke(dpToPx(1), android.graphics.Color.parseColor("#34D399")); // Emerald 400

        final android.graphics.drawable.GradientDrawable bgToggleOpen = new android.graphics.drawable.GradientDrawable();
        bgToggleOpen.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        bgToggleOpen.setColor(android.graphics.Color.parseColor("#0F172A")); // Slate 900
        bgToggleOpen.setStroke(dpToPx(1), android.graphics.Color.parseColor("#334155")); // Slate 700

        btnToggle.setBackground(bgToggleClosed);
        if (android.os.Build.VERSION.SDK_INT >= 21) {
            btnToggle.setElevation(dpToPx(8));
        }

        final IconView iconDots = new IconView(this, "dots", android.graphics.Color.WHITE);
        final IconView iconClose = new IconView(this, "close", android.graphics.Color.WHITE);
        iconClose.setVisibility(View.GONE);

        android.widget.FrameLayout.LayoutParams toggleIconParams = new android.widget.FrameLayout.LayoutParams(
            iconSizeMain, iconSizeMain, android.view.Gravity.CENTER
        );
        btnToggle.addView(iconDots, toggleIconParams);
        btnToggle.addView(iconClose, toggleIconParams);

        container.addView(actionsLayout);
        container.addView(btnToggle, new android.widget.LinearLayout.LayoutParams(fabSize, fabSize));

        // Letakkan di kanan bawah (identik dengan CapacitorOverlay Exam AA Utama)
        android.widget.FrameLayout.LayoutParams params = new android.widget.FrameLayout.LayoutParams(
            android.widget.FrameLayout.LayoutParams.WRAP_CONTENT,
            android.widget.FrameLayout.LayoutParams.WRAP_CONTENT
        );
        params.gravity = android.view.Gravity.BOTTOM | android.view.Gravity.END;
        params.bottomMargin = dpToPx(88);
        params.rightMargin = dpToPx(20);

        final boolean[] isMenuOpen = new boolean[]{false};
        final Runnable updateToggleState = new Runnable() {
            @Override
            public void run() {
                if (isMenuOpen[0]) {
                    actionsLayout.setVisibility(View.VISIBLE);
                    btnToggle.setBackground(bgToggleOpen);
                    iconDots.setVisibility(View.GONE);
                    iconClose.setVisibility(View.VISIBLE);
                } else {
                    actionsLayout.setVisibility(View.GONE);
                    btnToggle.setBackground(bgToggleClosed);
                    iconDots.setVisibility(View.VISIBLE);
                    iconClose.setVisibility(View.GONE);
                }
            }
        };

        btnRefresh.setOnClickListener(new android.view.View.OnClickListener() {
            @Override
            public void onClick(android.view.View v) {
                isMenuOpen[0] = false;
                updateToggleState.run();
                showExamConfirmDialog("refresh");
            }
        });

        btnExit.setOnClickListener(new android.view.View.OnClickListener() {
            @Override
            public void onClick(android.view.View v) {
                isMenuOpen[0] = false;
                updateToggleState.run();
                showExamConfirmDialog("exit");
            }
        });

        btnToggle.setOnTouchListener(new android.view.View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;
            private boolean isClick = false;

            @Override
            public boolean onTouch(android.view.View v, android.view.MotionEvent event) {
                switch (event.getAction()) {
                    case android.view.MotionEvent.ACTION_DOWN:
                        initialX = (int) container.getX();
                        initialY = (int) container.getY();
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        isClick = true;
                        return true;

                    case android.view.MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - initialTouchX;
                        float dy = event.getRawY() - initialTouchY;
                        if (Math.abs(dx) > dpToPx(8) || Math.abs(dy) > dpToPx(8)) {
                            isClick = false;
                            container.setX(initialX + dx);
                            container.setY(initialY + dy);
                        }
                        return true;

                    case android.view.MotionEvent.ACTION_UP:
                        if (isClick) {
                            isMenuOpen[0] = !isMenuOpen[0];
                            updateToggleState.run();
                        }
                        return true;
                }
                return false;
            }
        });

        floatingExamButton = container;
        addContentView(floatingExamButton, params);
    }

    public void hideFloatingExamButton() {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (floatingExamButton != null) {
                    try {
                        if (floatingExamButton.getParent() instanceof android.view.ViewGroup) {
                            ((android.view.ViewGroup) floatingExamButton.getParent()).removeView(floatingExamButton);
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "hideFloatingExamButton error", e);
                    }
                    floatingExamButton = null;
                }
            }
        });
    }

    public void checkAndHideNativeFloatingIfWebHasOverlay() {
        if (floatingExamButton == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (floatingExamButton == null) return;
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "(function() { return !!(window.__EXAM_AA_CBT__ || document.querySelector('[data-capacitor-overlay]') || document.getElementById('exam-aa-web-fab')); })()",
                        new android.webkit.ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                if ("true".equalsIgnoreCase(value)) {
                                    Log.d(TAG, "Deteksi web CBT overlay terpasang, menyembunyikan floating button native");
                                    hideFloatingExamButton();
                                }
                            }
                        }
                    );
                }
            }
        });
    }

    private void scheduleWebOverlayCheck() {
        long[] delays = new long[]{300, 800, 1500, 3000};
        for (final long delay : delays) {
            handler.postDelayed(new Runnable() {
                @Override
                public void run() {
                    checkAndHideNativeFloatingIfWebHasOverlay();
                }
            }, delay);
        }
    }

    private void showExamConfirmDialog(final String type) {
        final boolean isRefresh = "refresh".equals(type);
        isMenuDialogOpen = true;

        final android.app.Dialog dialog = new android.app.Dialog(this);
        dialog.requestWindowFeature(android.view.Window.FEATURE_NO_TITLE);

        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(android.graphics.Color.TRANSPARENT));
            dialog.getWindow().setDimAmount(0.6f);
        }

        final int pad24 = dpToPx(24);
        final int pad16 = dpToPx(16);
        final int pad12 = dpToPx(12);

        android.widget.LinearLayout card = new android.widget.LinearLayout(this);
        card.setOrientation(android.widget.LinearLayout.VERTICAL);
        card.setGravity(android.view.Gravity.CENTER_HORIZONTAL);
        card.setPadding(pad24, pad24, pad24, pad24);

        android.graphics.drawable.GradientDrawable cardBg = new android.graphics.drawable.GradientDrawable();
        cardBg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        cardBg.setColor(android.graphics.Color.parseColor("#0F172A")); // Slate 900
        cardBg.setStroke(dpToPx(1), android.graphics.Color.parseColor("#1E293B")); // Slate 800
        cardBg.setCornerRadius(dpToPx(20));
        card.setBackground(cardBg);

        // Icon Box (w-14 h-14 = 56dp, rounded-2xl = 16dp)
        final int iconBoxSize = dpToPx(56);
        android.widget.FrameLayout iconBox = new android.widget.FrameLayout(this);

        android.graphics.drawable.GradientDrawable iconBoxBg = new android.graphics.drawable.GradientDrawable();
        iconBoxBg.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        iconBoxBg.setColor(android.graphics.Color.parseColor("#1E293B")); // Slate 800
        iconBoxBg.setCornerRadius(dpToPx(16));
        iconBox.setBackground(iconBoxBg);

        IconView modalIcon = new IconView(
            this,
            isRefresh ? "refresh" : "shield",
            isRefresh ? android.graphics.Color.parseColor("#3B82F6") : android.graphics.Color.parseColor("#EF4444")
        );
        android.widget.FrameLayout.LayoutParams modalIconParams = new android.widget.FrameLayout.LayoutParams(
            dpToPx(24), dpToPx(24), android.view.Gravity.CENTER
        );
        iconBox.addView(modalIcon, modalIconParams);

        android.widget.LinearLayout.LayoutParams iconBoxParams = new android.widget.LinearLayout.LayoutParams(iconBoxSize, iconBoxSize);
        iconBoxParams.bottomMargin = pad16;
        card.addView(iconBox, iconBoxParams);

        // Title
        android.widget.TextView tvTitle = new android.widget.TextView(this);
        tvTitle.setText(isRefresh ? "Muat Ulang Halaman?" : "Keluar Dari Aplikasi?");
        tvTitle.setTextColor(android.graphics.Color.WHITE);
        tvTitle.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 17);
        tvTitle.setTypeface(null, android.graphics.Typeface.BOLD);
        tvTitle.setGravity(android.view.Gravity.CENTER);

        android.widget.LinearLayout.LayoutParams titleParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.bottomMargin = dpToPx(6);
        card.addView(tvTitle, titleParams);

        // Subtitle / Description
        android.widget.TextView tvDesc = new android.widget.TextView(this);
        tvDesc.setText(isRefresh 
            ? "Seluruh progres jawaban yang belum tersimpan mungkin akan hilang."
            : "Apakah Anda yakin ingin keluar dari aplikasi ujian?");
        tvDesc.setTextColor(android.graphics.Color.parseColor("#94A3B8")); // Slate 400
        tvDesc.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 12);
        tvDesc.setGravity(android.view.Gravity.CENTER);
        tvDesc.setLineSpacing(0, 1.25f);

        android.widget.LinearLayout.LayoutParams descParams = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        );
        descParams.bottomMargin = dpToPx(20);
        card.addView(tvDesc, descParams);

        // Button Grid (Horizontal 2 Columns)
        android.widget.LinearLayout btnRow = new android.widget.LinearLayout(this);
        btnRow.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        btnRow.setGravity(android.view.Gravity.CENTER);

        // Button "Tidak"
        final android.widget.TextView btnCancel = new android.widget.TextView(this);
        btnCancel.setText("Tidak");
        btnCancel.setTextColor(android.graphics.Color.parseColor("#E2E8F0")); // Slate 200
        btnCancel.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14);
        btnCancel.setTypeface(null, android.graphics.Typeface.BOLD);
        btnCancel.setGravity(android.view.Gravity.CENTER);
        btnCancel.setPadding(0, pad12, 0, pad12);

        android.graphics.drawable.GradientDrawable bgCancel = new android.graphics.drawable.GradientDrawable();
        bgCancel.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        bgCancel.setColor(android.graphics.Color.parseColor("#1E293B")); // Slate 800
        bgCancel.setCornerRadius(dpToPx(12));
        btnCancel.setBackground(bgCancel);

        btnCancel.setOnClickListener(new android.view.View.OnClickListener() {
            @Override
            public void onClick(android.view.View v) {
                dialog.dismiss();
            }
        });

        // Button "Ya"
        final android.widget.TextView btnConfirm = new android.widget.TextView(this);
        btnConfirm.setText("Ya");
        btnConfirm.setTextColor(android.graphics.Color.WHITE);
        btnConfirm.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, 14);
        btnConfirm.setTypeface(null, android.graphics.Typeface.BOLD);
        btnConfirm.setGravity(android.view.Gravity.CENTER);
        btnConfirm.setPadding(0, pad12, 0, pad12);

        android.graphics.drawable.GradientDrawable bgConfirm = new android.graphics.drawable.GradientDrawable();
        bgConfirm.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
        bgConfirm.setColor(isRefresh 
            ? android.graphics.Color.parseColor("#2563EB")  // Blue 600
            : android.graphics.Color.parseColor("#E11D48")  // Rose 600
        );
        bgConfirm.setCornerRadius(dpToPx(12));
        btnConfirm.setBackground(bgConfirm);

        btnConfirm.setOnClickListener(new android.view.View.OnClickListener() {
            @Override
            public void onClick(android.view.View v) {
                dialog.dismiss();
                if (isRefresh) {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        getBridge().getWebView().reload();
                        android.widget.Toast.makeText(MainActivity.this, "Memuat ulang halaman...", android.widget.Toast.LENGTH_SHORT).show();
                    }
                } else {
                    exitAppInternal();
                }
            }
        });

        android.widget.LinearLayout.LayoutParams cancelParams = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        cancelParams.rightMargin = dpToPx(6);

        android.widget.LinearLayout.LayoutParams confirmParams = new android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
        confirmParams.leftMargin = dpToPx(6);

        btnRow.addView(btnCancel, cancelParams);
        btnRow.addView(btnConfirm, confirmParams);

        card.addView(btnRow, new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        dialog.setContentView(card, new android.view.ViewGroup.LayoutParams(
            dpToPx(300),
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT
        ));

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
        desc.setText("Demi keamanan ujian, aplikasi ini wajib menggunakan mode 'Sematkan Layar'.\n\nSilakan klik tombol di bawah untuk mengaktifkan kuncian.\n\nUntuk keluar ujian, gunakan tombol menu di pojok kanan bawah.");
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
                if (!isExiting && isLockEnabled) {
                    sendBroadcast(new android.content.Intent(android.content.Intent.ACTION_CLOSE_SYSTEM_DIALOGS));
                }
            } catch (Exception e) {}

            if (isLockEnabled && !isExiting && !isMenuDialogOpen) {
                // Beri tahu WebView bahwa fokus jendela hilang (CBTPage menangani countdown 5s & cek layar mati)
                Log.d(TAG, "onWindowFocusChanged(false): Fokus jendela hilang saat ujian");
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
        if (!isLockEnabled || isFinishing() || isExiting) return;
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
                toneGenerator.release();
                toneGenerator = null;
            }
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) {
                v.cancel();
            }
        } catch (Exception e) {}
    }

    private void playTone() {
        if (!isLockEnabled || isFinishing() || isExiting) return;
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
                        android.widget.Toast.makeText(this, "Gunakan tombol menu di pojok kanan bawah untuk keluar ujian", android.widget.Toast.LENGTH_SHORT).show();
                        return;
                    }
                    getBridge().getWebView().goBack();
                    return;
                }
            }
            android.widget.Toast.makeText(this, "Tombol Kembali dinonaktifkan demi keamanan ujian", android.widget.Toast.LENGTH_SHORT).show();
            return;
        }

        // 2. Jika di luar mode ujian (launcher / portal / login)
        if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
            getBridge().getWebView().goBack();
            return;
        }

        // Di luar ujian: konfirmasi keluar dengan menekan kembali sekali lagi (double back to exit)
        if (System.currentTimeMillis() - backPressedTime < 2000) {
            exitAppInternal();
        } else {
            backPressedTime = System.currentTimeMillis();
            android.widget.Toast.makeText(this, "Tekan sekali lagi untuk keluar aplikasi", android.widget.Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void finish() {
        isExiting = true;
        isLockEnabled = false;
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
