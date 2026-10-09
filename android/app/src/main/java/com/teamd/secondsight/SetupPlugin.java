package com.teamd.secondsight;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
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
}
