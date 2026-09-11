package com.harmonix.player;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

public class HarmonixWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_WIDGET_PREV = "com.harmonix.player.widget.PREV";
    public static final String ACTION_WIDGET_PLAY_PAUSE = "com.harmonix.player.widget.PLAY_PAUSE";
    public static final String ACTION_WIDGET_NEXT = "com.harmonix.player.widget.NEXT";
    public static final String ACTION_WIDGET_UPDATE = "com.harmonix.player.widget.UPDATE";

    private static String cachedTitle = "Harmonix Player";
    private static String cachedArtist = "Нажмите для воспроизведения";
    private static boolean cachedIsPlaying = false;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId, cachedTitle, cachedArtist, cachedIsPlaying);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();

        if (ACTION_WIDGET_PREV.equals(action)) {
            HarmonixBackgroundAudioPlugin.onMediaAction("prev");
        } else if (ACTION_WIDGET_PLAY_PAUSE.equals(action)) {
            HarmonixBackgroundAudioPlugin.onMediaAction("togglePlay");
        } else if (ACTION_WIDGET_NEXT.equals(action)) {
            HarmonixBackgroundAudioPlugin.onMediaAction("next");
        } else if (ACTION_WIDGET_UPDATE.equals(action)) {
            String title = intent.getStringExtra(HarmonixMediaService.EXTRA_TITLE);
            String artist = intent.getStringExtra(HarmonixMediaService.EXTRA_ARTIST);
            boolean isPlaying = intent.getBooleanExtra(HarmonixMediaService.EXTRA_IS_PLAYING, false);
            updateAllWidgets(context, title, artist, isPlaying);
        }
    }

    public static void updateAllWidgets(Context context, String title, String artist, boolean isPlaying) {
        if (title != null && !title.trim().isEmpty()) {
            cachedTitle = title;
        }
        if (artist != null && !artist.trim().isEmpty()) {
            cachedArtist = artist;
        }
        cachedIsPlaying = isPlaying;

        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName widgetComponent = new ComponentName(context, HarmonixWidgetProvider.class);
            int[] appWidgetIds = manager.getAppWidgetIds(widgetComponent);

            if (appWidgetIds != null && appWidgetIds.length > 0) {
                for (int id : appWidgetIds) {
                    updateAppWidget(context, manager, id, cachedTitle, cachedArtist, cachedIsPlaying);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId,
                                        String title, String artist, boolean isPlaying) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_player);

        views.setTextViewText(R.id.widget_title, title != null ? title : "Harmonix Player");
        views.setTextViewText(R.id.widget_artist, artist != null ? artist : "Воспроизведение");

        int playIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        views.setImageViewResource(R.id.widget_btn_play_pause, playIcon);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Клик по телу виджета открывает главное окно приложения
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setAction(Intent.ACTION_MAIN);
        openAppIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPending = PendingIntent.getActivity(context, 0, openAppIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_root, openPending);

        // Предыдущий трек
        Intent prevIntent = new Intent(context, HarmonixWidgetProvider.class);
        prevIntent.setAction(ACTION_WIDGET_PREV);
        PendingIntent prevPending = PendingIntent.getBroadcast(context, 10, prevIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_btn_prev, prevPending);

        // Воспроизведение / Пауза
        Intent playPauseIntent = new Intent(context, HarmonixWidgetProvider.class);
        playPauseIntent.setAction(ACTION_WIDGET_PLAY_PAUSE);
        PendingIntent playPausePending = PendingIntent.getBroadcast(context, 20, playPauseIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_btn_play_pause, playPausePending);

        // Следующий трек
        Intent nextIntent = new Intent(context, HarmonixWidgetProvider.class);
        nextIntent.setAction(ACTION_WIDGET_NEXT);
        PendingIntent nextPending = PendingIntent.getBroadcast(context, 30, nextIntent, flags);
        views.setOnClickPendingIntent(R.id.widget_btn_next, nextPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
