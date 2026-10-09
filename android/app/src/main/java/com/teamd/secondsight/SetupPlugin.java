package com.teamd.secondsight;

import android.Manifest;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import android.telephony.SmsManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicInteger;

// Native calls the web page cannot make itself: open Android's "Install voice data" screen, send an SOS SMS silently
// and learn whether it left the phone, and the rest below.
@CapacitorPlugin(name = "Setup", permissions = { @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS }) })
public class SetupPlugin extends Plugin {

    @PluginMethod
    public void openVoiceInstall(PluginCall call) {
        Intent intent = new Intent("android.speech.tts.engine.INSTALL_TTS_DATA");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No text-to-speech engine found");
        }
    }

    @PluginMethod
    public void sendSms(PluginCall call) {
        if (getPermissionState("sms") != PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }
        send(call);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) send(call);
        else call.reject("SMS permission denied");
    }

    private static final String SMS_SENT = "com.teamd.secondsight.SMS_SENT";
    // A message the network has not taken in this long is reported as not sent, so the calls are not kept waiting.
    private static final long SMS_VERDICT_MS = 15000;
    private static final AtomicInteger smsSerial = new AtomicInteger();

    // Handing a message to Android is not sending it: in flight mode or without signal it never leaves. The call
    // is answered with the radio's own verdict: resolved once every part of the message has gone, rejected when a
    // part fails or nothing is heard in time.
    private void send(PluginCall call) {
        String to = call.getString("to");
        String text = call.getString("text");
        if (to == null || text == null) {
            call.reject("to and text are required");
            return;
        }
        Context context = getContext();
        SmsManager sms = SmsManager.getDefault();
        ArrayList<String> parts = sms.divideMessage(text);
        // Its own action per message, so one message's verdict is never taken for another's.
        String action = SMS_SENT + "." + smsSerial.incrementAndGet();
        SentWatch watch = new SentWatch(call, parts.size());
        ContextCompat.registerReceiver(context, watch, new IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED);
        PendingIntent sent = PendingIntent.getBroadcast(
            context,
            0,
            new Intent(action).setPackage(context.getPackageName()),
            PendingIntent.FLAG_IMMUTABLE
        );
        watch.handler.postDelayed(watch, SMS_VERDICT_MS);
        try {
            if (parts.size() <= 1) sms.sendTextMessage(to, null, text, sent, null);
            else sms.sendMultipartTextMessage(to, null, parts, new ArrayList<>(Collections.nCopies(parts.size(), sent)), null);
        } catch (Exception e) {
            watch.finish(false);
        }
    }

    // Waits for the "sent" broadcast of each part of one message, or for the time to run out.
    private final class SentWatch extends BroadcastReceiver implements Runnable {

        final Handler handler = new Handler(Looper.getMainLooper());
        private final PluginCall call;
        private int partsLeft;
        private boolean done;

        SentWatch(PluginCall call, int parts) {
            this.call = call;
            this.partsLeft = Math.max(1, parts);
        }

        @Override
        public synchronized void onReceive(Context context, Intent intent) {
            if (getResultCode() != Activity.RESULT_OK) finish(false);
            else if (--partsLeft <= 0) finish(true);
        }

        // No verdict in time.
        @Override
        public void run() {
            finish(false);
        }

        synchronized void finish(boolean sent) {
            if (done) return;
            done = true;
            handler.removeCallbacks(this);
            try {
                getContext().unregisterReceiver(this);
            } catch (IllegalArgumentException e) {
                /* already unregistered */
            }
            if (sent) call.resolve();
            else call.reject("SMS not sent");
        }
    }

    // The alarm for people nearby plays as media, and the media volume may have been left low or at zero: full
    // while the alarm sounds, then back to where it was.
    private int volumeBeforeAlarm = -1;

    @PluginMethod
    public synchronized void alarmVolume(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        try {
            if (on && volumeBeforeAlarm < 0) {
                volumeBeforeAlarm = audio.getStreamVolume(AudioManager.STREAM_MUSIC);
                audio.setStreamVolume(AudioManager.STREAM_MUSIC, audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0);
            } else if (!on && volumeBeforeAlarm >= 0) {
                audio.setStreamVolume(AudioManager.STREAM_MUSIC, volumeBeforeAlarm, 0);
                volumeBeforeAlarm = -1;
            }
            call.resolve();
        } catch (Exception e) {
            // Do Not Disturb can refuse a volume change.
            call.reject(e.getMessage());
        }
    }

    // Calls straight away with CALL_PHONE granted; without it, opens the dialler with the number ready (one more tap).
    @PluginMethod
    public void call(PluginCall call) {
        String to = call.getString("to");
        if (to == null) {
            call.reject("to is required");
            return;
        }
        boolean direct = getPermissionState("phone") == PermissionState.GRANTED;
        Intent intent = new Intent(direct ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(to)));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    // True once if the app was opened by the accessibility shortcut and the camera should start by itself.
    @PluginMethod
    public void consumeAutostart(PluginCall call) {
        JSObject result = new JSObject();
        result.put("autostart", MainActivity.consumeAutostart());
        call.resolve(result);
    }

    // While watching: the screen must not time out (Android would pause the camera), and nobody needs it bright.
    // Dimming to 5% saves most of the screen's power; off again, the system brightness and timeout come back.
    @PluginMethod
    public void setWatching(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        boolean dim = Boolean.TRUE.equals(call.getBoolean("dim", true));
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowManager.LayoutParams attrs = window.getAttributes();
            if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            attrs.screenBrightness = on && dim ? 0.05f : WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
            window.setAttributes(attrs);
            call.resolve();
        });
    }

    // Apps cannot turn on the accessibility shortcut themselves; this opens the page where the user (or a helper) can.
    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    // Reads printed text in a camera frame with Google's on-device recogniser (bundled in the APK, no internet).
    // Latin script only: English signs, numbers, bus boards in English.
    @PluginMethod
    public void readText(PluginCall call) {
        String data = call.getString("image");
        if (data == null) {
            call.reject("image is required");
            return;
        }
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        if (bitmap == null) {
            call.reject("not an image");
            return;
        }
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer
            .process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener(text -> {
                JSObject result = new JSObject();
                result.put("text", text.getText());
                call.resolve(result);
                recognizer.close();
            })
            .addOnFailureListener(e -> {
                call.reject(e.getMessage());
                recognizer.close();
            });
    }
}
