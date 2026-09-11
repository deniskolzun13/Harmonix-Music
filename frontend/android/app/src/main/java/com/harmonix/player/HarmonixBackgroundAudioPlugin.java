package com.harmonix.player;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackgroundAudio")
public class HarmonixBackgroundAudioPlugin extends Plugin {

    private static HarmonixBackgroundAudioPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void onMediaAction(String action) {
        if (instance != null) {
            com.getcapacitor.JSObject ret = new com.getcapacitor.JSObject();
            ret.put("action", action);
            instance.notifyListeners("mediaAction", ret);
        }
    }

    @PluginMethod
    public void enable(PluginCall call) {
        Context context = getContext();
        String title = call.getString("title", "Harmonix Player");
        String artist = call.getString("artist", "Воспроизведение");
        boolean isPlaying = call.getBoolean("isPlaying", true);

        Intent intent = new Intent(context, HarmonixMediaService.class);
        intent.setAction(HarmonixMediaService.ACTION_START);
        intent.putExtra(HarmonixMediaService.EXTRA_TITLE, title);
        intent.putExtra(HarmonixMediaService.EXTRA_ARTIST, artist);
        intent.putExtra(HarmonixMediaService.EXTRA_IS_PLAYING, isPlaying);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start background audio service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, HarmonixMediaService.class);
        intent.setAction(HarmonixMediaService.ACTION_STOP);
        try {
            context.startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop background audio service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext();
        String title = call.getString("title", "Harmonix Player");
        String artist = call.getString("artist", "Воспроизведение");
        boolean isPlaying = call.getBoolean("isPlaying", true);

        Intent intent = new Intent(context, HarmonixMediaService.class);
        intent.setAction(HarmonixMediaService.ACTION_UPDATE);
        intent.putExtra(HarmonixMediaService.EXTRA_TITLE, title);
        intent.putExtra(HarmonixMediaService.EXTRA_ARTIST, artist);
        intent.putExtra(HarmonixMediaService.EXTRA_IS_PLAYING, isPlaying);
        try {
            context.startService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to update background audio service: " + e.getMessage(), e);
        }
    }
}
