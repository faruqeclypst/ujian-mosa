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
        
        // 2. Layar Penuh Otomatis
        makeFullScreen();

        // Ambil status awal lock task
        try {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            lastLockState = am.getLockTaskModeState();
        } catch (Exception e) {}
        
        // 3. Keamanan: Anti Screenshot & Record, dan Sembunyikan Overlay (Android 12+)
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            getWindow().setHideOverlayWindows(true);
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
                checkLockTaskOnly();
                startRepeatingCheck();
            }
        });
    }

    public void disableLockForUpdateInternal() {
        isExiting = true;
        isLockEnabled = false;
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
                    }, 500);
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
        if (isLockEnabled) {
            checkLockTaskOnly();
        }
    }

    private void startRepeatingCheck() {
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (isLockEnabled && !isExiting) {
                    checkLockTaskOnly();
                    handler.postDelayed(this, 1000);
                }
            }
        }, 1000);
    }

    private void checkLockTaskOnly() {
        if (!isLockEnabled || isFinishing() || isExiting) return;
        try {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            int lockState = am.getLockTaskModeState();
            
            if (lockState == ActivityManager.LOCK_TASK_MODE_NONE) {
                blockingLayout.setVisibility(View.VISIBLE);
                
                // HANYA BERDERING jika sebelumnya pernah terkunci (Pinning aktif)
                // Ini artinya siswa melepas kuncian secara paksa
                if (lastLockState != -1 && lastLockState != ActivityManager.LOCK_TASK_MODE_NONE) {
                    playRingtone();
                }
            } else {
                blockingLayout.setVisibility(View.GONE);
                
                // Hanya stopRingtone otomatis jika sebelumnya memang dipicu oleh unpinning
                if (lastLockState == ActivityManager.LOCK_TASK_MODE_NONE) {
                    stopRingtone();
                }
            }
            lastLockState = lockState;
        } catch (Exception e) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (isFinishing()) return;
        
        if (hasFocus) {
            makeFullScreen();
        } else {
            try {
                if (!isExiting) {
                    sendBroadcast(new android.content.Intent(android.content.Intent.ACTION_CLOSE_SYSTEM_DIALOGS));
                }
            } catch (Exception e) {}
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
        if (isFinishing()) return;
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onBackPressed() {
        // Biarkan kosong
    }

    @Override
    public void finish() {
        isExiting = true;
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
        try {
            handler.removeCallbacksAndMessages(null);
            alarmHandler.removeCallbacksAndMessages(null);
        } catch (Exception e) {}
        super.onDestroy();
    }
}
