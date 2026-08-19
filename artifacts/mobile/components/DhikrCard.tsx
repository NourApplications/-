import { Audio } from "expo-av";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BUNDLED_AUDIO, CARD_COLORS, TEXT_COLORS, useApp } from "@/context/AppContext";
import type { Dhikr } from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { useReorderableDrag } from "react-native-reorderable-list";

interface Props {
  item: Dhikr;
  onEdit: (item: Dhikr) => void;
  onComplete?: () => void;
}

export function DhikrCard({ item, onEdit, onComplete }: Props) {
  const { settings, decrementCount, recordings, saveRecording, deleteRecording, speakDhikr, speakingId, stopDhikrSpeech, stopAllAudio, registerCardSound, getPlaybackGen, playingCardId, setPlayingCardId, isPlayingAll, skipCurrentInSpeakAll } = useApp();
  const { theme, bgColor, fontSize } = settings;
  const drag = useReorderableDrag();

  const cardC = CARD_COLORS[theme][bgColor];
  const textC = TEXT_COLORS[theme];
  const mutedC = theme === "day" ? "#6B7280" : "#9CA3AF";
  const primaryC = theme === "day" ? "#2E7D32" : "#4CAF50";
  const redC = "#EF4444";
  const borderC = theme === "day" ? "#E0E0E0" : "#333333";

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  // Web-only: maxHeight animation — starts at measured card height so collapse begins immediately
  const maxHeightAnim = useRef(new Animated.Value(600)).current;
  const cardHeightRef = useRef(600);

  const isDone = item.currentCount === 0;
  const hasBundledAudio = !!BUNDLED_AUDIO[item.id];
  const hasUserRecording = !!recordings[item.id];
  const hasRecording = hasUserRecording || hasBundledAudio;

  const [hidden, setHidden] = useState(isDone);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const prevIsDoneRef = useRef(isDone);

  const [isPlaying, setIsPlaying] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const isPlayingRef = useRef(false);
  const remainingRef = useRef(0);

  useEffect(() => {
    if (isDone && !prevIsDoneRef.current) {
      isPlayingRef.current = false;
      remainingRef.current = 0;
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {}).then(() => soundRef.current?.unloadAsync().catch(() => {}));
        soundRef.current = null;
      }
      setIsPlaying(false);
      // Stop audio on card fade:
      // - Single-card mode: stop TTS directly.
      // - SpeakAll mode: stop current audio and advance to next card.
      if (speakingId === item.id) {
        if (isPlayingAll) {
          skipCurrentInSpeakAll();
        } else {
          stopDhikrSpeech();
        }
      }
      // Stop any in-progress recording and save what was captured
      if (isRecording && recordingRef.current) {
        const recUri = recordingRef.current.getURI();
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
        setIsRecording(false);
        if (recUri) saveRecording(item.id, recUri);
      }
      if (Platform.OS === "web") {
        // Set maxHeight to the ACTUAL card height BEFORE applying the collapsing style.
        // If we set it after (or leave it at the 600 default), tall cards (>600px) would
        // instantly snap from their real height to 600px the moment isCollapsing becomes
        // true — that sudden layout jump confuses ReorderableList's Reanimated tracking
        // and produces the scroll-to-card-42 bug.
        maxHeightAnim.setValue(cardHeightRef.current);
        // Now safe to activate the outer wrapper style (maxHeight == content height → no jump).
        setIsCollapsing(true);
        // Notify parent so it can scroll to this card's top if the user was deep inside it.
        onComplete?.();
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          // maxHeightAnim is already at the correct starting value; animate to 0.
          Animated.timing(maxHeightAnim, {
            toValue: 0,
            duration: 450,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }).start(({ finished: f2 }) => {
            if (f2) {
              setIsCollapsing(false);
              setHidden(true);
            }
          });
        });
      } else {
        // Native: scroll-compensate FIRST (mirrors the web branch) so completing the
        // bottom of a tall card the user scrolled into doesn't make the list jump when
        // it collapses. Previously onComplete only ran on web, so the Android app kept
        // the jump bug even after the "fix".
        onComplete?.();
        // fade, then LayoutAnimation collapses the height natively
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            LayoutAnimation.configureNext({
              duration: 350,
              update: { type: LayoutAnimation.Types.easeInEaseOut },
            });
            setHidden(true);
          }
        });
      }
    } else if (!isDone) {
      fadeAnim.setValue(1);
      maxHeightAnim.setValue(600);
      setIsCollapsing(false);
      setHidden(false);
    }
    prevIsDoneRef.current = isDone;
  }, [isDone, fadeAnim, speakingId, isRecording]);

  useEffect(() => {
    if (isPlaying && playingCardId !== item.id) {
      isPlayingRef.current = false;
      remainingRef.current = 0;
      if (soundRef.current) {
        soundRef.current.stopAsync().then(() => soundRef.current?.unloadAsync()).catch(() => {});
        soundRef.current = null;
      }
      setIsPlaying(false);
    }
  }, [playingCardId, isPlaying, item.id]);

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const handlePress = () => {
    if (isDone) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    decrementCount(item.id);
  };

  const handlePlay = async () => {
    if (!hasRecording) return;
    try {
      if (isPlaying) {
        isPlayingRef.current = false;
        remainingRef.current = 0;
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
        soundRef.current = null;
        registerCardSound(null);
        setPlayingCardId(null);
        setIsPlaying(false);
        return;
      }

      // Stop any other audio (play-all, TTS, other card) before starting
      await stopAllAudio();
      setPlayingCardId(item.id);
      const gen = getPlaybackGen();

      const audioSource: import("expo-av").AVPlaybackSource = hasUserRecording
        ? { uri: recordings[item.id] }
        : BUNDLED_AUDIO[item.id];

      const playOnce = () => {
        if (!isPlayingRef.current || remainingRef.current <= 0 || gen !== getPlaybackGen()) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          return;
        }
        Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
          .then(() => Audio.Sound.createAsync(audioSource, { shouldPlay: false }))
          .then(async ({ sound }) => {
            // Abort if interrupted while loading
            if (gen !== getPlaybackGen() || !isPlayingRef.current) {
              await sound.unloadAsync().catch(() => {});
              setIsPlaying(false);
              return;
            }
            soundRef.current = sound;
            registerCardSound(sound);
            // Set status handler BEFORE playing to avoid missing finish events
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.isLoaded && status.didJustFinish) {
                sound.unloadAsync();
                soundRef.current = null;
                registerCardSound(null);
                remainingRef.current -= 1;
                decrementCount(item.id);
                if (isPlayingRef.current && remainingRef.current > 0) {
                  setTimeout(playOnce, 300);
                } else {
                  isPlayingRef.current = false;
                  setIsPlaying(false);
                  setPlayingCardId(null);
                }
              }
            });
            await sound.playAsync();
          })
          .catch(() => {
            isPlayingRef.current = false;
            setIsPlaying(false);
          });
      };

      isPlayingRef.current = true;
      remainingRef.current = item.currentCount;
      setIsPlaying(true);
      playOnce();
    } catch {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  };

  const handleMic = async () => {
    if (isRecording) {
      setIsRecording(false);
      try {
        const uri = recordingRef.current?.getURI() ?? null;
        await recordingRef.current?.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
        // Restore playback audio mode after recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        }).catch(() => {});
        if (uri) {
          await saveRecording(item.id, uri);
        } else {
          Alert.alert("تنبيه", "لم يتم الحصول على ملف التسجيل.");
        }
      } catch (e) {
        Alert.alert("خطأ في الحفظ", String(e));
      }
    } else {
      try {
        // Stop any playing audio before recording
        await stopAllAudio();
        stopDhikrSpeech();

        // Request microphone permission
        const current = await Audio.getPermissionsAsync();
        let granted = current.granted;
        if (!granted && current.canAskAgain) {
          const result = await Audio.requestPermissionsAsync();
          granted = result.granted;
        }
        if (!granted) {
          Alert.alert(
            "إذن المايكروفون",
            "يرجى منح إذن المايكروفون للتطبيق من إعدادات الجهاز.",
          );
          return;
        }

        // Set audio mode for recording (Android + iOS)
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY,
        );
        recordingRef.current = recording;
        setIsRecording(true);
      } catch (e) {
        // Restore audio mode on failure
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        }).catch(() => {});
        Alert.alert("خطأ في التسجيل", String(e));
      }
    }
  };

  const handleDeleteRecording = () => {
    deleteRecording(item.id);
  };

  const handleShare = async () => {
    const line = "━━━━━━━━━━━━━━━━━━━━━━";
    const msg = `${line}\n\n( ${item.text} )\n\n${line}\n📲 حمّل التطبيق:\nhttps://play.google.com/store/apps/details?id=com.adhkar.morningevening`;
    try { await Share.share({ message: msg }); } catch {}
  };

  if (hidden) return <View style={{ height: 0, overflow: "hidden" }} />;

  // Outer wrapper: on web, handles maxHeight collapse WITHOUT transform/opacity so no stacking context.
  // On native, outer has no style (LayoutAnimation collapses the layout naturally).
  // Inner Animated.View: fade + scale animation on both platforms.
  return (
    <Animated.View
      onLayout={(e) => { cardHeightRef.current = e.nativeEvent.layout.height; }}
      style={Platform.OS === "web" && isCollapsing ? { maxHeight: maxHeightAnim, overflow: "hidden" } : undefined}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: fadeAnim }}>
          <Pressable
        onPress={handlePress}
        style={[
          styles.card,
          {
            backgroundColor: speakingId === item.id ? (theme === "day" ? "#F1F8F1" : "#1A2E1A") : cardC,
            borderColor: speakingId === item.id ? primaryC : isDone ? primaryC : borderC,
            borderWidth: speakingId === item.id ? 2 : isDone ? 1.5 : 1,
            opacity: isDone ? 0.65 : 1,
            shadowColor: speakingId === item.id ? primaryC : "transparent",
            shadowOpacity: speakingId === item.id ? 0.35 : 0,
            shadowRadius: speakingId === item.id ? 8 : 0,
            elevation: speakingId === item.id ? 6 : 0,
          },
        ]}
      >
        <View style={styles.cardTopRow}>
          <TouchableOpacity
            onPressIn={drag}
            style={styles.dragHandle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="اسحب لإعادة ترتيب الذكر"
          >
            <Icon name="more-vertical" size={18} color={mutedC} />
          </TouchableOpacity>
        </View>

        <Text
          selectable={false}
          style={[
            styles.dhikrText,
            {
              fontSize,
              color: isDone ? mutedC : textC,
              lineHeight: fontSize * 1.8,
            },
          ]}
        >
          {item.text}
        </Text>

        <View style={[styles.bottomBar, { borderTopColor: borderC }]}>
          {/* TTS button — hidden for Quran verses */}
          {!item.isQuran && (
            <TouchableOpacity
              onPress={() => speakDhikr(item.id, item.text, item.currentCount)}
              style={[styles.iconBtn, { backgroundColor: speakingId === item.id ? primaryC + "33" : mutedC + "18" }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="speaker" size={18} color={speakingId === item.id ? primaryC : mutedC} />
            </TouchableOpacity>
          )}

          {/* Play button for bundled audio only — hidden once user has recorded */}
          {hasBundledAudio && !hasUserRecording && !isRecording && (
            <TouchableOpacity
              onPress={handlePlay}
              style={[styles.iconBtn, { backgroundColor: isPlaying ? primaryC + "33" : primaryC + "18" }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name={isPlaying ? "pause" : "volume-2"} size={18} color={primaryC} />
            </TouchableOpacity>
          )}

          <Animated.View style={[styles.micRow, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              onPress={hasUserRecording && !isRecording ? handlePlay : handleMic}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: isRecording
                    ? redC + "22"
                    : hasUserRecording
                    ? isPlaying ? primaryC + "33" : primaryC + "22"
                    : mutedC + "18",
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon
                name={
                  isRecording ? "square"
                  : hasUserRecording ? (isPlaying ? "volume-x" : "play")
                  : "mic"
                }
                size={16}
                color={isRecording ? redC : hasUserRecording ? primaryC : mutedC}
              />
            </TouchableOpacity>
            <Text style={[styles.micLabel, { color: isRecording ? redC : hasUserRecording ? primaryC : mutedC }]}>
              {isRecording
                ? "اضغط للإيقاف"
                : hasUserRecording
                ? isPlaying ? "اضغط للإيقاف" : "اضغط للاستماع"
                : "استمع إلى الذكر بصوتك"}
            </Text>
          </Animated.View>

          <View style={styles.rightActions}>
            {hasUserRecording && !isRecording && (
              <TouchableOpacity
                onPress={handleDeleteRecording}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.actionBtn}
              >
                <Icon name="x-circle" size={14} color={redC} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleShare}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.actionBtn}
            >
              <Icon name="share-2" size={14} color={mutedC} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onEdit(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.actionBtn}
            >
              <Icon name="edit-2" size={14} color={mutedC} />
            </TouchableOpacity>
            {isDone ? (
              <View style={[styles.countBadge, { backgroundColor: primaryC }]}>
                <Icon name="check" size={13} color="#fff" />
              </View>
            ) : (
              <View
                style={[
                  styles.countBadge,
                  speakingId === item.id
                    ? { backgroundColor: primaryC, borderColor: primaryC, borderWidth: 1 }
                    : { backgroundColor: primaryC + "22", borderColor: primaryC + "44", borderWidth: 1 },
                ]}
              >
                <Text style={[styles.countText, { color: speakingId === item.id ? "#fff" : primaryC }]}>
                  {item.currentCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        {isRecording && (
          <View style={[styles.recordingBanner, { backgroundColor: redC + "15" }]}>
            <Icon name="mic" size={12} color={redC} />
            <Text style={[styles.recordingText, { color: redC }]}>جارٍ التسجيل... اضغط ■ للإيقاف</Text>
          </View>
        )}
        {hasUserRecording && !isRecording && (
          <View style={[styles.recordingBanner, { backgroundColor: primaryC + "12" }]}>
            <Icon name="check-circle" size={12} color={primaryC} />
            <Text style={[styles.recordingText, { color: primaryC }]}>تم تسجيل صوتك بنجاح ✓</Text>
          </View>
        )}
      </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: "hidden",
    paddingBottom: 16,
    marginBottom: 28,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  dhikrText: {
    fontFamily: Platform.OS === "ios" ? "System" : undefined,
    textAlign: "center",
    writingDirection: "rtl",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    lineHeight: 34,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: "auto",
  },
  actionBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  micRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  micLabel: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  recordingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  recordingText: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
});
