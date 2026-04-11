package com.alfaruqasri.ujian;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private android.media.ToneGenerator toneGenerator;
    private int lastLockState = -1;
    private android.widget.LinearLayout blockingLayout;
    private android.os.Handler handler = new android.os.Handler();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. Layar Penuh Otomatis
        makeFullScreen();

        // Ambil status awal agar tidak langsung berdering saat buka
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        lastLockState = am.getLockTaskModeState();
        
        // 2. Keamanan: Anti Screenshot & Record
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        
        // 3. Inisialisasi Layar Blokir (Layout)
        createBlockingLayout();
        
        // 4. Mulai Pengecekan Status Saja
        startRepeatingCheck();

        // 5. Register Plugin untuk JS
        registerPlugin(CheatAlert.class);
    }

    @com.getcapacitor.annotation.CapacitorPlugin(name = "CheatAlert")
    public class CheatAlert extends com.getcapacitor.Plugin {
        @com.getcapacitor.PluginMethod
        public void startAlarm(com.getcapacitor.PluginCall call) {
            playRingtone();
            call.resolve();
        }

        @com.getcapacitor.PluginMethod
        public void stopAlarm(com.getcapacitor.PluginCall call) {
            stopRingtone();
            call.resolve();
        }
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
                startLockTask();
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
        checkLockTaskOnly();
    }

    private void startRepeatingCheck() {
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                checkLockTaskOnly();
                handler.postDelayed(this, 1000);
            }
        }, 1000);
    }

    private void checkLockTaskOnly() {
        if (isFinishing()) return; // Jangan cek jika sedang menutup
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
                // Ini agar tidak mematikan alarm yang dipicu manual via JS (CheatAlert)
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
                // Jangan kirim broadcast jika sedang menutup
                sendBroadcast(new android.content.Intent(android.content.Intent.ACTION_CLOSE_SYSTEM_DIALOGS));
            } catch (Exception e) {}
        }
    }

    private void playRingtone() {
        try {
            // Booster Volume Alarm
            android.media.AudioManager am = (android.media.AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                int max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_ALARM);
                am.setStreamVolume(android.media.AudioManager.STREAM_ALARM, max, 0);
            }

            if (toneGenerator == null) {
                toneGenerator = new android.media.ToneGenerator(android.media.AudioManager.STREAM_ALARM, 100);
            }
            // TONE_SUP_ERROR menghasilkan suara "tit-tit-tit" yang khas error/alarm
            toneGenerator.startTone(android.media.ToneGenerator.TONE_SUP_ERROR, 800);

            // Vibrasi darurat
            android.os.Vibrator v = (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    v.vibrate(android.os.VibrationEffect.createOneShot(800, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    v.vibrate(800);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void stopRingtone() {
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

    // 4. Blokir Tombol Back
    @Override
    public void onBackPressed() {
        // Biarkan kosong
    }

    // 5. Pastikan Unpin sebelum keluar (Cegah Crash)
    @Override
    public void finish() {
        try {
            handler.removeCallbacksAndMessages(null);
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
        } catch (Exception e) {}
        super.onDestroy();
    }
}
