import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, UIManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CustomSplash } from "@/components/CustomSplash";
import { AppProvider, useApp } from "@/context/AppContext";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const KEEP_AWAKE_TAG = "adhkar-active";
const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

function KeepAwakeHandler() {
  const { isPlayingAll } = useApp();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAwake = useRef(false);

  const enableKeepAwake = useCallback(async () => {
    if (!isAwake.current) {
      isAwake.current = true;
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    }
  }, []);

  const disableKeepAwake = useCallback(() => {
    if (isAwake.current) {
      isAwake.current = false;
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    enableKeepAwake();
    idleTimer.current = setTimeout(disableKeepAwake, IDLE_TIMEOUT_MS);
  }, [enableKeepAwake, disableKeepAwake]);

  // Keep awake while audio is playing — ignore idle timer
  useEffect(() => {
    if (isPlayingAll) {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      enableKeepAwake();
    } else {
      resetIdleTimer();
    }
  }, [isPlayingAll, enableKeepAwake, resetIdleTimer]);

  // Reset idle timer on any user touch
  useEffect(() => {
    if (Platform.OS === "web") return;
    // AppState: when app comes to foreground, reset timer
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") resetIdleTimer();
      else if (state === "background") {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        if (!isPlayingAll) disableKeepAwake();
      }
    });
    // Start timer on mount
    resetIdleTimer();
    return () => {
      sub.remove();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      disableKeepAwake();
    };
  }, [resetIdleTimer, disableKeepAwake, isPlayingAll]);

  return null;
}

function SplashController() {
  const [splashVisible, setSplashVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide native splash as soon as our image is decoded (local asset = fast).
  // Start the 2-second visible timer from that point so the user sees the
  // full design — not from when data loads, which adds unnecessary delay.
  const handleImageReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
    timerRef.current = setTimeout(() => setSplashVisible(false), 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return <CustomSplash visible={splashVisible} onImageReady={handleImageReady} />;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppProvider>
              <SplashController />
              {Platform.OS !== "web" && <KeepAwakeHandler />}
              <RootLayoutNav />
            </AppProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
