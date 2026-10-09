package com.teamd.secondsight;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.CallLog;
import android.telephony.PhoneStateListener;
import android.telephony.TelephonyCallback;
import android.telephony.TelephonyManager;
import androidx.annotation.RequiresApi;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Places one phone call and reports how it ended, so the page can decide whether to try the next emergency contact.
// Android tells an app when a call starts and ends, but not whether an outgoing call was answered. That is read
// afterwards from the call log: an answered call has a duration above zero.
@CapacitorPlugin(
    name = "EmergencyCall",
    permissions = {
        @Permission(alias = "phone", strings = { Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE }),
        @Permission(alias = "callLog", strings = { Manifest.permission.READ_CALL_LOG })
    }
)
public class EmergencyCallPlugin extends Plugin {

    // No SIM or flight mode: the phone never goes off hook.
    private static final long START_TIMEOUT_MS = 10_000;
    // Android refuses to open the call screen for an app that is not in front, which is the case just after a call.
    private static final long FOREGROUND_WAIT_MS = 6_000;
    // The call log is written a moment after the call ends.
    private static final long LOG_SETTLE_MS = 1_500;
    // Without call-log permission there is only the length of the call to go on. Unanswered calls are cut by the
    // network well before this.
    private static final long ANSWERED_WITHOUT_LOG_MS = 60_000;

    private final Handler main = new Handler(Looper.getMainLooper());
    private PluginCall active; // one call at a time
    private boolean offHook;
    private long offHookAt;
    private long placedAt;
    private Object stateListener; // a TelephonyCallback from Android 12, a PhoneStateListener before
    private boolean speakerTurnedOn;
    private boolean ended;
    // If the end of the call is never reported, this notices. Without it the plugin would refuse every later call.
    private final Runnable idleWatch = this::checkIdle;
    private final Runnable startTimeout = () -> finish(false, false, 0);

    @PluginMethod
    public void call(PluginCall call) {
        String number = call.getString("number");
        if (number == null || number.trim().isEmpty()) {
            call.reject("number is required");
            return;
        }
        if (getPermissionState("phone") != PermissionState.GRANTED) {
            requestPermissionForAlias("phone", call, "phonePermissionCallback");
            return;
        }
        main.post(() -> begin(call));
    }

    @PermissionCallback
    private void phonePermissionCallback(PluginCall call) {
        if (getPermissionState("phone") == PermissionState.GRANTED) main.post(() -> begin(call));
        else resolve(call, false, false, 0);
    }

    private void begin(PluginCall call) {
        if (active != null) {
            call.reject("a call is already in progress");
            return;
        }
        active = call;
        offHook = false;
        ended = false;
        waitForForeground(SystemClock.elapsedRealtime() + FOREGROUND_WAIT_MS);
    }

    private void waitForForeground(long deadline) {
        if (active == null) return;
        boolean inFront = getActivity() != null && getActivity().hasWindowFocus();
        if (inFront || SystemClock.elapsedRealtime() >= deadline) place();
        else main.postDelayed(() -> waitForForeground(deadline), 250);
    }

    private void place() {
        String number = active.getString("number", "").trim();
        try {
            // Already on a call (a contact may have rung back): this one cannot be placed, and that call is not ours to time.
            TelephonyManager telephony = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
            if (telephony.getCallState() != TelephonyManager.CALL_STATE_IDLE) {
                finish(false, false, 0);
                return;
            }
            listen();
            placedAt = System.currentTimeMillis();
            Intent intent = new Intent(Intent.ACTION_CALL, Uri.fromParts("tel", number, null));
            getActivity().startActivity(intent);
            main.postDelayed(startTimeout, START_TIMEOUT_MS);
        } catch (Exception e) {
            finish(false, false, 0);
        }
    }

    private void onCallState(int state) {
        if (active == null) return;
        if (state == TelephonyManager.CALL_STATE_OFFHOOK && !offHook) {
            offHook = true;
            offHookAt = SystemClock.elapsedRealtime();
            main.removeCallbacks(startTimeout);
            main.postDelayed(idleWatch, 5_000);
            // The phone hangs on the user's chest. Best effort: recent Android versions may ignore this for phone calls.
            main.postDelayed(this::speakerOn, 1_000);
        } else if (state == TelephonyManager.CALL_STATE_IDLE && offHook && !ended) {
            // Registering a listener reports the current state at once, so IDLE only counts after OFFHOOK.
            ended = true;
            main.removeCallbacks(idleWatch);
            long lastedMs = SystemClock.elapsedRealtime() - offHookAt;
            stopListening();
            main.postDelayed(() -> finishFromLog(lastedMs, true), LOG_SETTLE_MS);
        }
    }

    private void checkIdle() {
        if (active == null || !offHook || ended) return;
        try {
            TelephonyManager telephony = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
            if (telephony.getCallState() == TelephonyManager.CALL_STATE_IDLE) {
                onCallState(TelephonyManager.CALL_STATE_IDLE);
                return;
            }
        } catch (Exception e) {
            // keep watching
        }
        main.postDelayed(idleWatch, 5_000);
    }

    private void finishFromLog(long lastedMs, boolean mayRetry) {
        if (active == null) return;
        if (getPermissionState("callLog") != PermissionState.GRANTED) {
            finish(true, lastedMs >= ANSWERED_WITHOUT_LOG_MS, lastedMs / 1000);
            return;
        }
        long seconds = -1;
        try (
            Cursor cursor = getContext()
                .getContentResolver()
                .query(
                    CallLog.Calls.CONTENT_URI,
                    new String[] { CallLog.Calls.DURATION },
                    CallLog.Calls.TYPE + " = ? AND " + CallLog.Calls.DATE + " >= ?",
                    new String[] { String.valueOf(CallLog.Calls.OUTGOING_TYPE), String.valueOf(placedAt - 5_000) },
                    CallLog.Calls.DATE + " DESC"
                )
        ) {
            if (cursor != null && cursor.moveToFirst()) seconds = cursor.getLong(0);
        } catch (Exception e) {
            seconds = -1;
        }
        if (seconds < 0 && mayRetry) {
            main.postDelayed(() -> finishFromLog(lastedMs, false), LOG_SETTLE_MS);
            return;
        }
        if (seconds < 0) finish(true, lastedMs >= ANSWERED_WITHOUT_LOG_MS, lastedMs / 1000);
        else finish(true, seconds > 0, seconds);
    }

    private void finish(boolean started, boolean answered, long seconds) {
        main.removeCallbacks(startTimeout);
        main.removeCallbacks(idleWatch);
        stopListening();
        speakerOff();
        PluginCall call = active;
        active = null;
        if (call != null) resolve(call, started, answered, seconds);
    }

    private void resolve(PluginCall call, boolean started, boolean answered, long seconds) {
        JSObject result = new JSObject();
        result.put("started", started);
        result.put("answered", answered);
        result.put("seconds", seconds);
        call.resolve(result);
    }

    private void speakerOn() {
        if (active == null || !offHook) return;
        try {
            AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            audio.setSpeakerphoneOn(true);
            speakerTurnedOn = true;
        } catch (Exception e) {
            // not allowed on this phone: the call carries on through the earpiece
        }
    }

    // Put back what speakerOn changed, or the app's own warnings could come out of the wrong speaker afterwards.
    private void speakerOff() {
        if (!speakerTurnedOn) return;
        speakerTurnedOn = false;
        try {
            AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            audio.setSpeakerphoneOn(false);
        } catch (Exception e) {
            // nothing more to do
        }
    }

    private void listen() {
        TelephonyManager telephony = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            CallStateCallback callback = new CallStateCallback();
            telephony.registerTelephonyCallback(getContext().getMainExecutor(), callback);
            stateListener = callback;
        } else {
            PhoneStateListener listener = new PhoneStateListener() {
                @Override
                public void onCallStateChanged(int state, String phoneNumber) {
                    onCallState(state);
                }
            };
            telephony.listen(listener, PhoneStateListener.LISTEN_CALL_STATE);
            stateListener = listener;
        }
    }

    private void stopListening() {
        if (stateListener == null) return;
        TelephonyManager telephony = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                telephony.unregisterTelephonyCallback((TelephonyCallback) stateListener);
            } else {
                telephony.listen((PhoneStateListener) stateListener, PhoneStateListener.LISTEN_NONE);
            }
        } catch (Exception e) {
            // already gone
        }
        stateListener = null;
    }

    @Override
    protected void handleOnDestroy() {
        main.removeCallbacksAndMessages(null);
        stopListening();
        speakerOff();
        active = null;
    }

    @RequiresApi(api = Build.VERSION_CODES.S)
    private class CallStateCallback extends TelephonyCallback implements TelephonyCallback.CallStateListener {

        @Override
        public void onCallStateChanged(int state) {
            onCallState(state);
        }
    }
}
