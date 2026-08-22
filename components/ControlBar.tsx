import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BG_COLORS,
  TEXT_COLORS,
  useApp,
  type BgColorKey,
} from "@/context/AppContext";
import { Icon } from "@/components/Icon";
import { HistoryModal } from "@/components/HistoryModal";

const COLOR_OPTIONS: {
  key: BgColorKey;
  dayColor: string;
  nightColor: string;
  label: string;
}[] = [
  { key: "blue", dayColor: "#DCEEFC", nightColor: "#0E1A2E", label: "أزرق" },
  { key: "white", dayColor: "#FFFFFF", nightColor: "#1C1F2E", label: "أبيض" },
  { key: "cream", dayColor: "#FBF3E0", nightColor: "#221C0E", label: "كريمي" },
  { key: "mint", dayColor: "#E8F5E8", nightColor: "#0E1F0E", label: "أخضر" },
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function to12h(hour24: number): string {
  if (hour24 === 0) return "12 ص";
  if (hour24 < 12) return `${hour24} ص`;
  if (hour24 === 12) return "12 م";
  return `${hour24 - 12} م`;
}

export function ControlBar() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const {
    settings,
    updateSettings,
    activeCategory,
    resetCategory,
    isPlayingAll,
    speakAll,
    stopSpeaking,
    dailyStats,
    completionHistory,
  } = useApp();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const barScrollRef = useRef<ScrollView>(null);
  // Track the toolbar scroll geometry so we can show a "more icons" hint on
  // whichever edge still has content hidden off-screen (phones only).
  const [scrollViewW, setScrollViewW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  const autoScrollDone = useRef(false);
  useEffect(() => {
    if (
      !autoScrollDone.current &&
      contentW > 0 &&
      scrollViewW > 0 &&
      contentW > scrollViewW + 6
    ) {
      autoScrollDone.current = true;
      const t1 = setTimeout(
        () => barScrollRef.current?.scrollToEnd({ animated: true }),
        400,
      );
      const t2 = setTimeout(
        () => barScrollRef.current?.scrollTo({ x: 0, animated: true }),
        1200,
      );
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [contentW, scrollViewW]);

  const { theme, bgColor, fontSize } = settings;
  const textC = TEXT_COLORS[theme];
  const barBg = theme === "day" ? "rgba(255,255,255,0.97)" : "rgba(0,0,0,0.97)";
  const borderC = theme === "day" ? "#E5E7EB" : "#2A2D3E";
  const primaryC = theme === "day" ? "#2E7D32" : "#4CAF50";
  const mutedC = theme === "day" ? "#9CA3AF" : "#6B7280";
  const modalBg = theme === "day" ? "#FFFFFF" : "#000000";
  const sectionBg = theme === "day" ? "#F9FAFB" : "#1A1A1A";

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 8) : insets.top;

  // Edge hints: chevrons point toward content hidden beyond each side. Computed
  // purely from pixel offsets, so it stays correct regardless of RTL direction.
  const maxScroll = Math.max(0, contentW - scrollViewW);
  const canScroll = !isTablet && maxScroll > 6;
  const showStartHint = canScroll && scrollX > 6;
  const showEndHint = canScroll && scrollX < maxScroll - 6;

  const todayMorning = dailyStats.morningCount;
  const todayEvening = dailyStats.eveningCount;

  return (
    <>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: barBg,
            borderBottomColor: borderC,
            paddingTop: topPad + 2,
          },
        ]}
      >
        <View style={styles.scrollWrap}>
          <ScrollView
            ref={barScrollRef}
            horizontal={!isTablet}
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!isTablet}
            onLayout={(e) => setScrollViewW(e.nativeEvent.layout.width)}
            onContentSizeChange={(w) => setContentW(w)}
            onScroll={(e) => setScrollX(e.nativeEvent.contentOffset.x)}
            scrollEventThrottle={32}
            contentContainerStyle={[
              styles.row,
              isTablet && styles.rowTablet,
              !isTablet && styles.rowPadded,
            ]}
          >
            <TouchableOpacity
              onPress={() =>
                updateSettings({ theme: theme === "day" ? "night" : "day" })
              }
              style={[styles.iconBtn, { borderColor: borderC }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon
                name={theme === "day" ? "moon" : "sun"}
                size={18}
                color={textC}
              />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: borderC }]} />

            {COLOR_OPTIONS.map((opt) => {
              const circleColor =
                theme === "day" ? opt.dayColor : opt.nightColor;
              const isSelected = bgColor === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => updateSettings({ bgColor: opt.key })}
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor: circleColor,
                      borderColor: isSelected ? primaryC : borderC,
                      borderWidth: isSelected ? 2.5 : 1,
                    },
                  ]}
                />
              );
            })}

            <View style={[styles.divider, { backgroundColor: borderC }]} />

            <TouchableOpacity
              onPress={isPlayingAll ? stopSpeaking : speakAll}
              style={[
                styles.iconBtn,
                {
                  borderColor: isPlayingAll ? primaryC : borderC,
                  backgroundColor: isPlayingAll
                    ? primaryC + "22"
                    : "transparent",
                },
              ]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon
                name={isPlayingAll ? "pause" : "headphones"}
                size={18}
                color={isPlayingAll ? primaryC : textC}
              />
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: borderC }]} />

            <TouchableOpacity
              onPress={() =>
                updateSettings({ fontSize: Math.max(14, fontSize - 2) })
              }
              style={[styles.iconBtn, { borderColor: borderC }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text
                style={[
                  styles.fontBtnText,
                  {
                    color: textC,
                    fontSize: 16,
                    lineHeight: 18,
                    includeFontPadding: false,
                  },
                ]}
              >
                ب
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                updateSettings({ fontSize: Math.min(28, fontSize + 2) })
              }
              style={[styles.iconBtn, { borderColor: borderC }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text
                style={[
                  styles.fontBtnText,
                  {
                    color: textC,
                    fontSize: 24,
                    lineHeight: 26,
                    includeFontPadding: false,
                  },
                ]}
              >
                ب
              </Text>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: borderC }]} />

            <TouchableOpacity
              onPress={() => resetCategory(activeCategory)}
              style={[styles.iconBtn, { borderColor: borderC }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="refresh-cw" size={16} color={mutedC} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSettingsOpen(true)}
              style={[styles.iconBtn, { borderColor: borderC }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="settings" size={16} color={mutedC} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                Share.share({
                  title: "أذكار الصباح والمساء",
                  message:
                    "تطبيق أذكار الصباح والمساء 🤲\nاحرص على ذكر الله صباحاً ومساءً\n\nحمّل التطبيق:\nhttps://play.google.com/store/apps/details?id=com.adhkar.morningevening",
                })
              }
              style={[styles.iconBtn, { borderColor: borderC }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="gift" size={16} color={mutedC} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setHistoryOpen(true)}
              style={[styles.iconBtn, { borderColor: borderC }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Icon name="calendar" size={16} color={mutedC} />
            </TouchableOpacity>
          </ScrollView>
          {showStartHint && (
            <View
              pointerEvents="none"
              style={[
                styles.scrollHint,
                styles.scrollHintLeft,
                { backgroundColor: barBg },
              ]}
            >
              <Icon name="chevron-left" size={16} color={primaryC} />
            </View>
          )}
          {showEndHint && (
            <View
              pointerEvents="none"
              style={[
                styles.scrollHint,
                styles.scrollHintRight,
                { backgroundColor: barBg },
              ]}
            >
              <Icon name="chevron-right" size={16} color={primaryC} />
            </View>
          )}
        </View>

        {(() => {
          const today = new Date();
          const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          const todayRecord = completionHistory.find(
            (r) => r.date === todayKey,
          );
          const morningDone = todayRecord?.morning ?? false;
          const eveningDone = todayRecord?.evening ?? false;
          return (
            <View style={styles.todayWidget}>
              <View
                style={[
                  styles.todayItem,
                  {
                    backgroundColor: morningDone
                      ? primaryC + "18"
                      : borderC + "44",
                  },
                ]}
              >
                <Text style={styles.todayEmoji}>☀️</Text>
                <Text
                  style={[
                    styles.todayItemText,
                    { color: morningDone ? primaryC : mutedC },
                  ]}
                >
                  {morningDone ? "مكتمل" : "لم يكتمل"}
                </Text>
              </View>
              <View
                style={[
                  styles.todayItem,
                  { backgroundColor: eveningDone ? "#000000" : "#666666" },
                ]}
              >
                <Icon name="moon-filled" size={13} color="#FFFFFF" />
                <Text
                  style={[
                    styles.todayItemText,
                    { color: eveningDone ? "#A5B4FC" : "#FFFFFF" },
                  ]}
                >
                  {eveningDone ? "مكتمل" : "لم يكتمل"}
                </Text>
              </View>
            </View>
          );
        })()}
      </View>

      <Modal
        visible={settingsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSettingsOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSettingsOpen(false)}
        >
          <Pressable
            style={[styles.modalSheet, { backgroundColor: modalBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: borderC }]} />
            <View style={[styles.modalHeader, { borderBottomColor: borderC }]}>
              <Text style={[styles.modalTitle, { color: textC }]}>
                الإعدادات
              </Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                <Icon name="x" size={22} color={mutedC} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingBottom: insets.bottom + 8 }}>
              <View
                style={[
                  styles.section,
                  { backgroundColor: sectionBg, borderColor: borderC },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: mutedC }]}>
                  القارئ الذاتي
                </Text>
                <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.settingLabel}>
                    <Text style={[styles.settingText, { color: textC }]}>
                      صوت رجل تلقائيًا
                    </Text>
                    <Text style={[styles.settingHint, { color: mutedC }]}>
                      يُفضّل صوتًا رجاليًا عربيًا عند توفره على الجهاز
                    </Text>
                  </View>
                  <Switch
                    value={settings.preferredVoiceGender === "male"}
                    onValueChange={(enabled) =>
                      updateSettings({
                        preferredVoiceGender: enabled ? "male" : "system",
                      })
                    }
                    trackColor={{ false: borderC, true: primaryC + "88" }}
                    thumbColor={
                      settings.preferredVoiceGender === "male"
                        ? primaryC
                        : mutedC
                    }
                  />
                </View>
              </View>

              <View
                style={[
                  styles.section,
                  { backgroundColor: sectionBg, borderColor: borderC },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: mutedC }]}>
                  التذكيرات اليومية
                </Text>

                <View
                  style={[styles.settingRow, { borderBottomColor: borderC }]}
                >
                  <View style={styles.settingLabel}>
                    <Text style={[styles.settingText, { color: textC }]}>
                      تفعيل الإشعارات
                    </Text>
                  </View>
                  <Switch
                    value={settings.notificationsEnabled}
                    onValueChange={(v) =>
                      updateSettings({ notificationsEnabled: v })
                    }
                    trackColor={{ false: borderC, true: primaryC + "88" }}
                    thumbColor={
                      settings.notificationsEnabled ? primaryC : mutedC
                    }
                  />
                </View>

                {settings.notificationsEnabled && (
                  <>
                    <View
                      style={[
                        styles.settingRow,
                        { borderBottomColor: borderC },
                      ]}
                    >
                      <View style={styles.settingLabel}>
                        <Text style={[styles.settingText, { color: textC }]}>
                          🌅 وقت أذكار الصباح
                        </Text>
                      </View>
                      <View style={styles.timeControl}>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              morningNotifHour:
                                (settings.morningNotifHour + 1) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon name="chevron-up" size={14} color={primaryC} />
                        </TouchableOpacity>
                        <Text style={[styles.timeText, { color: textC }]}>
                          {to12h(settings.morningNotifHour)}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              morningNotifHour:
                                (settings.morningNotifHour - 1 + 24) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon
                            name="chevron-down"
                            size={14}
                            color={primaryC}
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.timeControl}>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              morningNotifMinute:
                                (settings.morningNotifMinute + 5) % 60,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon name="chevron-up" size={14} color={primaryC} />
                        </TouchableOpacity>
                        <Text style={[styles.timeText, { color: textC }]}>
                          {pad(settings.morningNotifMinute)} د
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              morningNotifMinute:
                                (settings.morningNotifMinute - 5 + 60) % 60,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon
                            name="chevron-down"
                            size={14}
                            color={primaryC}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.settingRow]}>
                      <View style={styles.settingLabel}>
                        <Text style={[styles.settingText, { color: textC }]}>
                          🌙 وقت أذكار المساء
                        </Text>
                      </View>
                      <View style={styles.timeControl}>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              eveningNotifHour:
                                (settings.eveningNotifHour + 1) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon name="chevron-up" size={14} color={primaryC} />
                        </TouchableOpacity>
                        <Text style={[styles.timeText, { color: textC }]}>
                          {to12h(settings.eveningNotifHour)}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              eveningNotifHour:
                                (settings.eveningNotifHour - 1 + 24) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon
                            name="chevron-down"
                            size={14}
                            color={primaryC}
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.timeControl}>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              eveningNotifMinute:
                                (settings.eveningNotifMinute + 5) % 60,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon name="chevron-up" size={14} color={primaryC} />
                        </TouchableOpacity>
                        <Text style={[styles.timeText, { color: textC }]}>
                          {pad(settings.eveningNotifMinute)} د
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              eveningNotifMinute:
                                (settings.eveningNotifMinute - 5 + 60) % 60,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon
                            name="chevron-down"
                            size={14}
                            color={primaryC}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>

              <View
                style={[
                  styles.section,
                  { backgroundColor: sectionBg, borderColor: borderC },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: mutedC }]}>
                  أذكار تذكيرية
                </Text>

                <View
                  style={[
                    styles.settingRow,
                    {
                      borderBottomColor: borderC,
                      borderBottomWidth: settings.dhikrReminderEnabled ? 1 : 0,
                    },
                  ]}
                >
                  <View style={styles.settingLabel}>
                    <Text style={[styles.settingText, { color: textC }]}>
                      تفعيل الأذكار التذكيرية
                    </Text>
                  </View>
                  <Switch
                    value={settings.dhikrReminderEnabled}
                    onValueChange={(v) =>
                      updateSettings({ dhikrReminderEnabled: v })
                    }
                    trackColor={{ false: borderC, true: primaryC + "88" }}
                    thumbColor={
                      settings.dhikrReminderEnabled ? primaryC : mutedC
                    }
                  />
                </View>

                {settings.dhikrReminderEnabled && (
                  <>
                    <View
                      style={[
                        styles.settingRow,
                        {
                          borderBottomColor: borderC,
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: 6,
                        },
                      ]}
                    >
                      <Text style={[styles.settingText, { color: textC }]}>
                        كل كم يظهر الذكر؟
                      </Text>
                      <View style={styles.intervalBtns}>
                        {[
                          { label: "٣٠ دقيقة", value: 30 },
                          { label: "ساعة", value: 60 },
                          { label: "ساعتين", value: 120 },
                          { label: "٣ ساعات", value: 180 },
                        ].map((opt) => {
                          const isSelected =
                            settings.dhikrReminderIntervalMinutes === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              onPress={() =>
                                updateSettings({
                                  dhikrReminderIntervalMinutes: opt.value,
                                })
                              }
                              style={[
                                styles.intervalBtn,
                                {
                                  backgroundColor: isSelected
                                    ? primaryC
                                    : "transparent",
                                  borderColor: isSelected ? primaryC : borderC,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.intervalBtnText,
                                  { color: isSelected ? "#fff" : textC },
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View
                      style={[
                        styles.settingRow,
                        { borderBottomColor: borderC },
                      ]}
                    >
                      <View style={styles.settingLabel}>
                        <Text style={[styles.settingText, { color: textC }]}>
                          ⏰ من الساعة
                        </Text>
                      </View>
                      <View style={styles.timeControl}>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              dhikrReminderStartHour:
                                (settings.dhikrReminderStartHour + 1) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon name="chevron-up" size={14} color={primaryC} />
                        </TouchableOpacity>
                        <Text style={[styles.timeText, { color: textC }]}>
                          {to12h(settings.dhikrReminderStartHour)}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              dhikrReminderStartHour:
                                (settings.dhikrReminderStartHour - 1 + 24) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon
                            name="chevron-down"
                            size={14}
                            color={primaryC}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
                      <View style={styles.settingLabel}>
                        <Text style={[styles.settingText, { color: textC }]}>
                          🔕 حتى الساعة
                        </Text>
                      </View>
                      <View style={styles.timeControl}>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              dhikrReminderEndHour:
                                (settings.dhikrReminderEndHour + 1) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon name="chevron-up" size={14} color={primaryC} />
                        </TouchableOpacity>
                        <Text style={[styles.timeText, { color: textC }]}>
                          {to12h(settings.dhikrReminderEndHour)}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            updateSettings({
                              dhikrReminderEndHour:
                                (settings.dhikrReminderEndHour - 1 + 24) % 24,
                            })
                          }
                          style={[styles.timeBtn, { borderColor: borderC }]}
                        >
                          <Icon
                            name="chevron-down"
                            size={14}
                            color={primaryC}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <HistoryModal
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  scrollWrap: {
    position: "relative",
  },
  scrollHint: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 22,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.95,
  },
  scrollHintLeft: {
    left: 0,
  },
  scrollHintRight: {
    right: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
    justifyContent: "center",
  },
  rowPadded: {
    paddingHorizontal: 26,
  },
  rowTablet: {
    gap: 10,
    paddingHorizontal: 16,
    flexWrap: "nowrap",
    justifyContent: "center",
    width: "100%",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  colorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  divider: {
    width: 1,
    height: 22,
    marginHorizontal: 1,
  },
  fontBtnText: {
    fontWeight: "700",
  },
  todayWidget: {
    flexDirection: "row",
    gap: 8,
    marginTop: 7,
    justifyContent: "center",
    direction: "rtl",
  },
  todayItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  todayEmoji: {
    fontSize: 13,
  },
  todayItemText: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 20,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 2,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    textAlign: "right",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 10,
  },
  settingLabel: {
    flex: 1,
    alignItems: "flex-end",
  },
  settingText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
  },
  settingHint: {
    fontSize: 11,
    marginTop: 1,
    textAlign: "right",
  },
  timeControl: {
    alignItems: "center",
    gap: 2,
  },
  timeBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 34,
    textAlign: "center",
  },
  intervalBtns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  intervalBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  intervalBtnText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    paddingVertical: 14,
    gap: 4,
  },
  statEmoji: {
    fontSize: 24,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
  },
  statName: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  radioBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
  voiceAutoLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginStart: 8,
    alignSelf: "center",
  },
});
