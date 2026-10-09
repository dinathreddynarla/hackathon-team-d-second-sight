package com.teamd.secondsight;

import android.os.Bundle;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private long lastVolumeUp = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SetupPlugin.class);
        super.onCreate(savedInstanceState);
        // Android dims and pauses the WebView after the screen timeout; a blind user never touches the screen while walking.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    // Volume-up pressed twice within 450 ms fires a "volumeDouble" window event in the page (scan the area once).
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
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
}
