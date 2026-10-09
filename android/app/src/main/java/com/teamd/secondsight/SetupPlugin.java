package com.teamd.secondsight;

import android.Manifest;
import android.content.Intent;
import android.telephony.SmsManager;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Two native calls the web page cannot make itself: open Android's "Install voice data" screen, and send an SOS SMS silently.
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
}
