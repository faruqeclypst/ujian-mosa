package com.alfaruqasri.ujian;

import android.util.Log;
import android.content.Context;
import android.os.PowerManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CheatAlert")
public class CheatAlert extends Plugin {
    private static final String TAG = "CheatAlert";

    public CheatAlert() {}

    private MainActivity getMainActivity() {
        if (MainActivity.instance != null) {
            return MainActivity.instance;
        }
        if (getActivity() instanceof MainActivity) {
            return (MainActivity) getActivity();
        }
        return null;
    }

    @PluginMethod
    public void getScreenState(PluginCall call) {
        JSObject ret = new JSObject();
        boolean isInteractive = true;
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                isInteractive = pm.isInteractive();
            }
        } catch (Exception e) {}

        long now = System.currentTimeMillis();
        boolean wasScreenOffRecently = (MainActivity.isScreenOff || (now - MainActivity.lastScreenOffTime < 3000));
        ret.put("isScreenOn", isInteractive);
        ret.put("wasScreenOffRecently", wasScreenOffRecently);
        call.resolve(ret);
    }

    @PluginMethod
    public void enableLockMode(PluginCall call) {
        Log.d(TAG, "enableLockMode called from JS");
        MainActivity act = getMainActivity();
        if (act != null) {
            act.enableLockModeInternal();
        }
        call.resolve();
    }

    @PluginMethod
    public void disableLockForUpdate(PluginCall call) {
        Log.d(TAG, "disableLockForUpdate called from JS");
        MainActivity act = getMainActivity();
        if (act != null) {
            act.disableLockForUpdateInternal();
        }
        call.resolve();
    }

    @PluginMethod
    public void startAlarm(PluginCall call) {
        Log.d(TAG, "startAlarm called from JS");
        MainActivity act = getMainActivity();
        if (act != null) {
            act.playRingtone();
        }
        call.resolve();
    }

    @PluginMethod
    public void stopAlarm(PluginCall call) {
        Log.d(TAG, "stopAlarm called from JS");
        MainActivity act = getMainActivity();
        if (act != null) {
            act.stopRingtone();
        }
        call.resolve();
    }

    @PluginMethod
    public void openUrlAndExit(PluginCall call) {
        final String url = call.getString("url");
        Log.d(TAG, "openUrlAndExit called with url: " + url);
        if (url == null || url.isEmpty()) {
            call.reject("URL is empty");
            return;
        }
        MainActivity act = getMainActivity();
        if (act != null) {
            act.openUrlAndExitInternal(url);
        }
        call.resolve();
    }

    @PluginMethod
    public void exitApp(PluginCall call) {
        Log.d(TAG, "exitApp called from JS");
        MainActivity act = getMainActivity();
        if (act != null) {
            act.exitAppInternal();
        }
        call.resolve();
    }

    @PluginMethod
    public void setStatusBarTheme(PluginCall call) {
        final String theme = call.getString("theme", "light");
        final String color = call.getString("color", null);
        Log.d(TAG, "setStatusBarTheme called from JS: theme=" + theme + ", color=" + color);
        MainActivity act = getMainActivity();
        if (act != null) {
            act.setThemeModeInternal(theme, color);
        }
        call.resolve();
    }
}
