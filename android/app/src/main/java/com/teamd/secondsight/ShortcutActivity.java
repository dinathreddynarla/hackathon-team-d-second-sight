package com.teamd.secondsight;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

// Target of Android's accessibility shortcut (hold both volume keys, the accessibility button, or a gesture).
// It has no screen of its own: it opens Second Sight with the camera already starting, then gets out of the way.
public class ShortcutActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent open = new Intent(this, MainActivity.class);
        open.putExtra(MainActivity.EXTRA_AUTOSTART, true);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(open);
        finish();
    }
}
