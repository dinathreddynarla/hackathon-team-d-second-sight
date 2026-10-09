package com.teamd.secondsight;

import android.Manifest;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.provider.Settings;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import android.telephony.SmsManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Native calls the web page cannot make itself: open Android's "Install voice data" screen, send an SOS SMS silently,
// and call the emergency contact.
@CapacitorPlugin(
    name = "Setup",
    permissions = {
        @Permission(alias = "sms", strings = { Manifest.permission.SEND_SMS }),
        @Permission(alias = "phone", strings = { Manifest.permission.CALL_PHONE }),
    }
)
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

    private void send(PluginCall call) {
        String to = call.getString("to");
        String text = call.getString("text");
        if (to == null || text == null) {
            call.reject("to and text are required");
            return;
        }
        try {
            SmsManager.getDefault().sendTextMessage(to, null, text, null, null);
            call.resolve();
        } catch (Exception e) {
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
