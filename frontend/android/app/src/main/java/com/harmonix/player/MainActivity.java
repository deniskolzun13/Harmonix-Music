package com.harmonix.player;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HarmonixBackgroundAudioPlugin.class);
        registerPlugin(HarmonixAudioFocusPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
