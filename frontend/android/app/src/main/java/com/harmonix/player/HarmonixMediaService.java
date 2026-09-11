package com.harmonix.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

public class HarmonixMediaService extends Service {

    public static final String ACTION_START = "com.harmonix.player.action.START";
    public static final String ACTION_STOP = "com.harmonix.player.action.STOP";
    public static final String ACTION_UPDATE = "com.harmonix.player.action.UPDATE";
    public static final String ACTION_PREV = "com.harmonix.player.action.PREV";
    public static final String ACTION_PLAY_PAUSE = "com.harmonix.player.action.PLAY_PAUSE";
    public static final String ACTION_NEXT = "com.harmonix.player.action.NEXT";

    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_ARTIST = "extra_artist";
    public static final String EXTRA_IS_PLAYING = "extra_is_playing";

    private static final String CHANNEL_ID = "harmonix_media_playback";
    private static final int NOTIFICATION_ID = 1001;

    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Harmonix::MediaPlaybackWakeLock");
            wakeLock.setReferenceCounted(false);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Фоновое воспроизведение",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Служба поддержания фонового воспроизведения музыки");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_START.equals(action)) {
            String title = intent.getStringExtra(EXTRA_TITLE);
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
            startForegroundServiceInternal(title, artist, isPlaying);
        } else if (ACTION_UPDATE.equals(action)) {
            String title = intent.getStringExtra(EXTRA_TITLE);
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            boolean isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
            updateNotification(title, artist, isPlaying);
        } else if (ACTION_PREV.equals(action)) {
            HarmonixBackgroundAudioPlugin.onMediaAction("prev");
        } else if (ACTION_PLAY_PAUSE.equals(action)) {
            HarmonixBackgroundAudioPlugin.onMediaAction("togglePlay");
        } else if (ACTION_NEXT.equals(action)) {
            HarmonixBackgroundAudioPlugin.onMediaAction("next");
        } else if (ACTION_STOP.equals(action)) {
            stopForegroundServiceInternal();
        }

        return START_NOT_STICKY;
    }

    private void startForegroundServiceInternal(String title, String artist, boolean isPlaying) {
        if (wakeLock != null && !wakeLock.isHeld()) {
            try {
                wakeLock.acquire();
            } catch (Exception ignored) {}
        }

        Notification notification = buildNotification(title, artist, isPlaying);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification(String title, String artist, boolean isPlaying) {
        Notification notification = buildNotification(title, artist, isPlaying);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, notification);
        }
    }

    private void stopForegroundServiceInternal() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }

        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private Notification buildNotification(String title, String artist, boolean isPlaying) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setAction(Intent.ACTION_MAIN);
        launchIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);

        // Интерактивные PendingIntent для кнопок в шторке Android
        Intent prevIntent = new Intent(this, HarmonixMediaService.class).setAction(ACTION_PREV);
        PendingIntent prevPending = PendingIntent.getService(this, 1, prevIntent, flags);

        Intent playPauseIntent = new Intent(this, HarmonixMediaService.class).setAction(ACTION_PLAY_PAUSE);
        PendingIntent playPausePending = PendingIntent.getService(this, 2, playPauseIntent, flags);

        Intent nextIntent = new Intent(this, HarmonixMediaService.class).setAction(ACTION_NEXT);
        PendingIntent nextPending = PendingIntent.getService(this, 3, nextIntent, flags);

        String displayTitle = (title != null && !title.trim().isEmpty()) ? title : "Harmonix Player";
        String displayArtist = (artist != null && !artist.trim().isEmpty()) ? artist : "Воспроизведение музыки";

        int playIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playTitle = isPlaying ? "Пауза" : "Играть";

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(displayTitle)
            .setContentText(displayArtist)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_media_previous, "Предыдущий", prevPending)
            .addAction(playIcon, playTitle, playPausePending)
            .addAction(android.R.drawable.ic_media_next, "Следующий", nextPending)
            .setOngoing(isPlaying)
            .setOnlyAlertOnce(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
