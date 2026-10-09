package com.teamd.secondsight;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    public static final String EXTRA_AUTOSTART = "autostart";
    // Set when opened by the accessibility shortcut; the page reads it once through SetupPlugin.consumeAutostart().
    private static boolean pendingAutostart = false;

    static synchronized boolean consumeAutostart() {
        boolean was = pendingAutostart;
        pendingAutostart = false;
        return was;
    }

    private long lastVolumeUp = 0;
    private long volumeDownAt = 0;
    private boolean helpFired = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SetupPlugin.class);
        super.onCreate(savedInstanceState);
        // Screen-on is set only while watching (SetupPlugin.setWatching), so an idle app does not drain the battery.
        handleAutostart(getIntent(), false);
    }

    // Already open: the shortcut tells the running page directly.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAutostart(intent, true);
    }

    // Opened by the shortcut: show over the lock screen and wake the display, so the user never has to unlock first.
    private void handleAutostart(Intent intent, boolean pageLoaded) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_AUTOSTART, false)) return;
        intent.removeExtra(EXTRA_AUTOSTART);
        setShowWhenLocked(true);
        setTurnScreenOn(true);
        // Always keep the request until the page collects it: Android can deliver the shortcut as a new intent before
        // the page has loaded, and an event fired then is lost. The event only tells an already-loaded page to collect.
        synchronized (MainActivity.class) {
            pendingAutostart = true;
        }
        if (pageLoaded) getBridge().triggerWindowJSEvent("autostart");
    }

    // Volume-up pressed twice within 450 ms fires "volumeDouble" (scan the area once).
    // Volume-down HELD for 2 s fires "volumeDownHold" (ask for help). A short press still lowers the volume, on release,
    // so the gesture never makes the app quieter and ordinary volume use never asks for help.
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            long now = SystemClock.uptimeMillis();
            if (event.getRepeatCount() == 0) {
                volumeDownAt = now;
                helpFired = false;
            } else if (!helpFired && now - volumeDownAt >= 2000) {
                helpFired = true;
                getBridge().triggerWindowJSEvent("volumeDownHold");
            }
            return true;
        }
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            long now = SystemClock.uptimeMillis();
            if (now - lastVolumeUp < 450) {
                lastVolumeUp = 0;
                getBridge().triggerWindowJSEvent("volumeDouble");
                return true;
            }
            lastVolumeUp = now;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (!helpFired) {
                AudioManager audio = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                audio.adjustSuggestedStreamVolume(AudioManager.ADJUST_LOWER, AudioManager.USE_DEFAULT_STREAM_TYPE, AudioManager.FLAG_SHOW_UI);
            }
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }
}
