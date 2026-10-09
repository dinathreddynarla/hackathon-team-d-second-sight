package com.teamd.secondsight;

import android.content.Context;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private long lastVolumeUp = 0;
    private long volumeDownAt = 0;
    private boolean helpFired = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SetupPlugin.class);
        super.onCreate(savedInstanceState);
        // Android dims and pauses the WebView after the screen timeout; a blind user never touches the screen while walking.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
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
