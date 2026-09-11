package com.harmonix.player;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioFocus")
public class HarmonixAudioFocusPlugin extends Plugin {

    private AudioFocusRequest focusRequest;
    private final AudioManager.OnAudioFocusChangeListener focusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int focusChange) {
            JSObject ret = new JSObject();
            ret.put("focusChange", focusChange);
            switch (focusChange) {
                case AudioManager.AUDIOFOCUS_LOSS:
                    notifyListeners("audioFocusLoss", ret);
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    notifyListeners("audioFocusLossTransient", ret);
                    break;
                case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                    notifyListeners("audioFocusCanDuck", ret);
                    break;
                case AudioManager.AUDIOFOCUS_GAIN:
                    notifyListeners("audioFocusGain", ret);
                    break;
            }
        }
    };

    @PluginMethod
    public void requestAudioFocus(PluginCall call) {
        AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager == null) {
            call.reject("AudioManager not available");
            return;
        }

        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();

            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(playbackAttributes)
                .setAcceptsDelayedFocusGain(true)
                .setOnAudioFocusChangeListener(focusChangeListener)
                .build();

            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                focusChangeListener,
                AudioManager.STREAM_MUSIC,
                AudioManager.AUDIOFOCUS_GAIN
            );
        }

        JSObject ret = new JSObject();
        ret.put("granted", result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
        call.resolve(ret);
    }

    @PluginMethod
    public void abandonAudioFocus(PluginCall call) {
        abandonFocusInternal();
        call.resolve();
    }

    private void abandonFocusInternal() {
        try {
            AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                    audioManager.abandonAudioFocusRequest(focusRequest);
                } else {
                    audioManager.abandonAudioFocus(focusChangeListener);
                }
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void handleOnDestroy() {
        abandonFocusInternal();
        super.handleOnDestroy();
    }
}
