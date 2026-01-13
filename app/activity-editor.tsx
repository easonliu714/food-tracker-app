import { 
  Ionicons, 
  MaterialCommunityIcons, 
  FontAwesome5, 
  Foundation, 
  Entypo, 
  MaterialIcons 
} from "@expo/vector-icons";
import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { format } from "date-fns";
import DateTimePicker from "@react-native-community/datetimepicker";
import { db } from "@/lib/db"; 
import { activityLogs, userProfiles } from "@/drizzle/schema";
import { desc, eq } from "drizzle-orm";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t, useLanguage } from "@/lib/i18n"; // i18n

// [新增] 統一管理的圖示元件
const ActivityIcon = ({ library, name, size, color, style }: { library?: string, name: string, size: number, color: string, style?: any }) => {
  switch (library) {
    case "MaterialCommunityIcons":
      return <MaterialCommunityIcons name={name as any} size={size} color={color} style={style} />;
    case "FontAwesome5":
      return <FontAwesome5 name={name as any} size={size} color={color} style={style} />;
    case "Foundation":
      return <Foundation name={name as any} size={size} color={color} style={style} />;
    case "MaterialIcons":
      return <MaterialIcons name={name as any} size={size} color={color} style={style} />;
    case "Entypo":
      return <Entypo name={name as any} size={size} color={color} style={style} />;
    // 預設使用 Ionicons
    default:
      return <Ionicons name={name as any} size={size} color={color} style={style} />;
  }
};

// 更新型別定義，加入 library? 屬性
type ActivityItem = { id: string; mets: number; icon: string; library?: string };
type ActivityCategory = { id: string; items: ActivityItem[] };
// 依據國民健康署 PDF 更新 METs 與項目 (鍵值對應 i18n)
// 類別：
// cat_cardio: 跑步、騎車、游泳、爬樓梯、走路、跳繩
// cat_gym: 健身房器材、有氧團課、瑜珈、重訓
// cat_sport: 球類運動、競技運動
// cat_life: 日常生活、家事
const ACTIVITY_RAW: ActivityCategory[] = [
  {
    id: "cat_cardio",
    items: [
      { id: "act_walk", mets: 3.0, icon: "walk" }, // 慢走 4km/h
      { id: "act_walk_3_2", mets: 2.5, icon: "walk", library: "MaterialCommunityIcons" }, // 3.2 km/h
      { id: "act_walk_4", mets: 3.0, icon: "walk", library: "MaterialCommunityIcons" }, // 4 km/h
      { id: "act_walk_4_8", mets: 3.5, icon: "walk", library: "MaterialCommunityIcons" }, // 4.8 km/h
      { id: "act_walk_5_6", mets: 4.3, icon: "walk", library: "MaterialCommunityIcons" }, // 5.6 km/h
      { id: "act_walk_6_4", mets: 5.0, icon: "walk", library: "MaterialCommunityIcons" }, // 6.4 km/h
      { id: "act_walk_7_2", mets: 6.3, icon: "run", library: "MaterialCommunityIcons" }, // 7.2 km/h
      { id: "act_walk_8", mets: 8.0, icon: "run-fast", library: "MaterialCommunityIcons" }, // 8 km/h
      
      { id: "act_jogging", mets: 7.0, icon: "run", library: "MaterialCommunityIcons" }, // 慢跑 一般
      { id: "act_run_8kph", mets: 8.0, icon: "run", library: "MaterialCommunityIcons" }, // 8 km/h
      { id: "act_run_9_7kph", mets: 9.8, icon: "run", library: "MaterialCommunityIcons" }, // 9.7 km/h
      { id: "act_run_11kph", mets: 11.0, icon: "run-fast", library: "MaterialCommunityIcons" }, // 11 km/h
      { id: "act_run_12kph", mets: 11.5, icon: "run-fast", library: "MaterialCommunityIcons" }, // 12 km/h
      { id: "act_run_13kph", mets: 12.3, icon: "run-fast", library: "MaterialCommunityIcons" }, // 13 km/h
      { id: "act_run_14_5kph", mets: 14.5, icon: "run-fast", library: "MaterialCommunityIcons" }, // 14.5 km/h
      { id: "act_run_16kph", mets: 16.0, icon: "run-fast", library: "MaterialCommunityIcons" }, // 16 km/h

      { id: "act_cycling_leisure", mets: 4.0, icon: "bike", library: "MaterialCommunityIcons" }, // <16 km/h
      { id: "act_cycling_slow", mets: 6.0, icon: "bike", library: "MaterialCommunityIcons" }, // 16-19 km/h
      { id: "act_cycling_moderate", mets: 8.0, icon: "bike", library: "MaterialCommunityIcons" }, // 19-22 km/h
      { id: "act_cycling_vigorous", mets: 10.0, icon: "bike-fast", library: "MaterialCommunityIcons" }, // 22-25 km/h
      { id: "act_cycling_racing", mets: 12.0, icon: "bike-fast", library: "MaterialCommunityIcons" }, // >26 km/h
      { id: "act_cycling_mountain", mets: 8.5, icon: "mountain", library: "FontAwesome5" }, // 山地

      { id: "act_swim", mets: 6.3, icon: "swim", library: "MaterialCommunityIcons" }, // 慢
      { id: "act_swim_fast", mets: 9.8, icon: "swim", library: "MaterialCommunityIcons" }, // 快
      { id: "act_swim_back", mets: 7.0, icon: "swim", library: "MaterialCommunityIcons" }, // 仰式
      { id: "act_swim_breast", mets: 10.3, icon: "swim", library: "MaterialCommunityIcons" }, // 蛙式
      { id: "act_swim_butterfly", mets: 13.8, icon: "swim", library: "MaterialCommunityIcons" }, // 蝶式
      { id: "act_water_jogging", mets: 9.8, icon: "water", library: "MaterialCommunityIcons" }, // 水中慢跑
      { id: "act_aqua_aerobics", mets: 5.3, icon: "water", library: "MaterialCommunityIcons" }, // 水上有氧

      { id: "act_stairs_down", mets: 3.2, icon: "stairs", library: "MaterialCommunityIcons" }, // 下樓梯
      { id: "act_stairs_up", mets: 8.4, icon: "stairs-up", library: "MaterialCommunityIcons" }, // 上樓梯 (爬樓梯)
      { id: "act_hike", mets: 6.0, icon: "hiking", library: "MaterialCommunityIcons" }, // 爬山
      { id: "act_jump_rope_slow", mets: 8.0, icon: "jump-rope", library: "MaterialCommunityIcons" }, // 慢
      { id: "act_jump_rope_mod", mets: 10.0, icon: "jump-rope", library: "MaterialCommunityIcons" }, // 中
      { id: "act_jump_rope_fast", mets: 12.0, icon: "jump-rope", library: "MaterialCommunityIcons" }, // 快
    ],
  },
  {
    id: "cat_gym",
    items: [
      { id: "act_weight_light", mets: 3.0, icon: "dumbbell", library: "MaterialCommunityIcons" }, // 輕中度
      { id: "act_weight_vig", mets: 6.0, icon: "weight-lifter", library: "MaterialCommunityIcons" }, // 高強度
      { id: "act_circuit_training", mets: 8.0, icon: "cached", library: "MaterialCommunityIcons" }, // 循環訓練
      { id: "act_core", mets: 3.8, icon: "human-handsup", library: "MaterialCommunityIcons" }, // 核心
      { id: "act_yoga", mets: 2.5, icon: "yoga", library: "MaterialCommunityIcons" }, // 熱瑜珈
      { id: "act_yoga_power", mets: 4.0, icon: "yoga", library: "MaterialCommunityIcons" }, // 力量瑜珈
      { id: "act_pilates", mets: 3.0, icon: "human-handsup", library: "MaterialCommunityIcons" },
      { id: "act_pilates_adv", mets: 4.5, icon: "human-handsup", library: "MaterialCommunityIcons" }, // 進階
      
      { id: "act_aerobic_dance", mets: 6.5, icon: "human-female-dance", library: "MaterialCommunityIcons" }, 
      { id: "act_aerobics_low", mets: 5.0, icon: "human-female-dance", library: "MaterialCommunityIcons" }, // 低衝擊
      { id: "act_aerobics_high", mets: 7.3, icon: "human-female-dance", library: "MaterialCommunityIcons" }, // 高衝擊
      { id: "act_zumba", mets: 7.3, icon: "human-female-dance", library: "MaterialCommunityIcons" },
      { id: "act_dance_general", mets: 4.5, icon: "music-note", library: "MaterialCommunityIcons" },
      { id: "act_dance_swing", mets: 5.5, icon: "music-note", library: "MaterialCommunityIcons" },
      { id: "act_dance_ballet", mets: 5.0, icon: "shoe-ballet", library: "MaterialCommunityIcons" },

      { id: "act_hiit", mets: 12.5, icon: "flash", library: "MaterialCommunityIcons" },
      { id: "act_crossfit", mets: 12.0, icon: "flash", library: "MaterialCommunityIcons" },
      { id: "act_burpees", mets: 8.0, icon: "flash", library: "MaterialCommunityIcons" },
      { id: "act_battle_ropes", mets: 10.3, icon: "flash", library: "MaterialCommunityIcons" },
      { id: "act_trx", mets: 7.0, icon: "flash", library: "MaterialCommunityIcons" },
      
      { id: "act_elliptical", mets: 5.0, icon: "run", library: "MaterialCommunityIcons" },
      { id: "act_stair_stepper", mets: 9.0, icon: "stairs", library: "MaterialCommunityIcons" },
      { id: "act_stat_bike_light", mets: 3.5, icon: "bike", library: "MaterialCommunityIcons" },
      { id: "act_stat_bike_mod", mets: 6.8, icon: "bike", library: "MaterialCommunityIcons" },
      { id: "act_stat_bike_vig", mets: 10.5, icon: "bike", library: "MaterialCommunityIcons" },
      { id: "act_spinning", mets: 8.5, icon: "bike-fast", library: "MaterialCommunityIcons" },
      { id: "act_rowing_machine", mets: 7.0, icon: "rowing", library: "MaterialCommunityIcons" },
      { id: "act_treadmill", mets: 9.0, icon: "run", library: "MaterialCommunityIcons" }, // 跑步機
      
      { id: "act_stretching", mets: 2.3, icon: "human-handsdown", library: "MaterialCommunityIcons" },
      { id: "act_plank", mets: 3.8, icon: "human-handsdown", library: "MaterialCommunityIcons" },
      { id: "act_pushups", mets: 3.8, icon: "human-handsdown", library: "MaterialCommunityIcons" },
      { id: "act_situps", mets: 3.8, icon: "human-handsdown", library: "MaterialCommunityIcons" },
      { id: "act_squats", mets: 5.0, icon: "human-handsdown", library: "MaterialCommunityIcons" },
      { id: "act_kettlebell", mets: 8.0, icon: "kettlebell", library: "MaterialCommunityIcons" },
      { id: "act_medicine_ball", mets: 5.5, icon: "volleyball", library: "MaterialCommunityIcons" },
      { id: "act_trampoline", mets: 4.5, icon: "arrow-up-bold", library: "MaterialCommunityIcons" },
      { id: "act_hula_hoop", mets: 4.0, icon: "circle-outline", library: "MaterialCommunityIcons" },
    ],
  },
  {
    id: "cat_sport",
    items: [
      { id: "act_badminton", mets: 5.5, icon: "badminton", library: "MaterialCommunityIcons" }, // 休閒
      { id: "act_badminton_comp", mets: 7.0, icon: "badminton", library: "MaterialCommunityIcons" }, // 競技
      { id: "act_basketball_gen", mets: 6.5, icon: "basketball", library: "MaterialCommunityIcons" }, // 一般
      { id: "act_basketball", mets: 8.0, icon: "basketball", library: "MaterialCommunityIcons" }, // 比賽
      { id: "act_tennis_doubles", mets: 6.0, icon: "tennisball" }, // 雙打
      { id: "act_tennis", mets: 8.0, icon: "tennisball" }, // 單人
      { id: "act_table_tennis", mets: 4.0, icon: "table-tennis", library: "MaterialCommunityIcons" },
      { id: "act_soccer", mets: 7.0, icon: "soccer", library: "MaterialCommunityIcons" }, // 一般
      { id: "act_soccer_comp", mets: 10.0, icon: "soccer", library: "MaterialCommunityIcons" }, // 競技
      { id: "act_baseball", mets: 5.0, icon: "baseball", library: "MaterialCommunityIcons" },
      { id: "act_softball", mets: 5.0, icon: "baseball", library: "MaterialCommunityIcons" },
      { id: "act_golf", mets: 4.3, icon: "golf", library: "MaterialCommunityIcons" }, // 步行
      { id: "act_volleyball", mets: 6.0, icon: "volleyball", library: "MaterialCommunityIcons" }, // 室內
      { id: "act_volleyball_beach", mets: 8.0, icon: "volleyball", library: "MaterialCommunityIcons" }, // 沙灘
      { id: "act_rugby", mets: 8.0, icon: "rugby", library: "MaterialCommunityIcons" }, // 橄欖球
      { id: "act_hockey", mets: 8.0, icon: "hockey-sticks", library: "MaterialCommunityIcons" },
      { id: "act_racquetball", mets: 7.0, icon: "tennis", library: "MaterialCommunityIcons" }, // 壁球
      { id: "act_billiards", mets: 2.5, icon: "billiards", library: "MaterialCommunityIcons" },
      { id: "act_bowling", mets: 3.0, icon: "bowling", library: "MaterialCommunityIcons" },
      { id: "act_darts", mets: 2.5, icon: "target", library: "MaterialCommunityIcons" },
      { id: "act_frisbee", mets: 3.0, icon: "disc", library: "MaterialCommunityIcons" },
      { id: "act_archery", mets: 3.5, icon: "bullseye-arrow", library: "MaterialCommunityIcons" },
      
      { id: "act_boxing_bag", mets: 5.5, icon: "boxing-glove", library: "MaterialCommunityIcons" },
      { id: "act_boxing_spar", mets: 7.8, icon: "boxing-glove", library: "MaterialCommunityIcons" },
      { id: "act_karate", mets: 10.0, icon: "karate", library: "MaterialCommunityIcons" },
      { id: "act_judo", mets: 10.0, icon: "karate", library: "MaterialCommunityIcons" },
      { id: "act_taekwondo", mets: 10.0, icon: "karate", library: "MaterialCommunityIcons" },
      { id: "act_wrestling", mets: 6.0, icon: "kabaddi", library: "MaterialCommunityIcons" },
      { id: "act_taichi", mets: 3.0, icon: "yin-yang", library: "MaterialCommunityIcons" },
      { id: "act_fencing", mets: 6.0, icon: "fencing", library: "MaterialCommunityIcons" },

      { id: "act_rock_climbing", mets: 11.0, icon: "image-filter-hdr", library: "MaterialCommunityIcons" },
      { id: "act_roller_skating", mets: 7.0, icon: "roller-skate", library: "MaterialCommunityIcons" },
      { id: "act_skateboarding", mets: 5.0, icon: "skateboard", library: "MaterialCommunityIcons" },
      { id: "act_skiing", mets: 7.0, icon: "ski", library: "MaterialCommunityIcons" },
      { id: "act_surfing", mets: 3.0, icon: "surfing", library: "MaterialCommunityIcons" },
      { id: "act_waterskiing", mets: 6.0, icon: "water", library: "MaterialCommunityIcons" },
      { id: "act_water_polo", mets: 10.0, icon: "water-polo", library: "MaterialCommunityIcons" },
      { id: "act_kayaking", mets: 5.0, icon: "rowing", library: "MaterialCommunityIcons" },
      { id: "act_canoeing", mets: 5.0, icon: "rowing", library: "MaterialCommunityIcons" },
      { id: "act_rowing", mets: 6.0, icon: "rowing", library: "MaterialCommunityIcons" },
      { id: "act_horseback", mets: 5.5, icon: "horse-human", library: "MaterialCommunityIcons" },
    ],
  },
  {
    id: "cat_life",
    items: [
      { id: "act_sitting_work", mets: 1.5, icon: "chair-rolling", library: "MaterialCommunityIcons" },
      { id: "act_typing", mets: 1.5, icon: "keyboard", library: "MaterialCommunityIcons" },
      { id: "act_reading", mets: 1.3, icon: "book-open-variant", library: "MaterialCommunityIcons" },
      { id: "act_watching_tv", mets: 1.0, icon: "television", library: "MaterialCommunityIcons" },
      { id: "act_standing", mets: 1.3, icon: "human-male", library: "MaterialCommunityIcons" },
      { id: "act_driving", mets: 2.0, icon: "car", library: "MaterialCommunityIcons" },
      { id: "act_motorcycling", mets: 2.5, icon: "motorbike", library: "MaterialCommunityIcons" },
      { id: "act_playing_music", mets: 2.0, icon: "music", library: "MaterialCommunityIcons" },
      { id: "act_singing", mets: 2.0, icon: "microphone", library: "MaterialCommunityIcons" },
      
      { id: "act_cooking", mets: 2.5, icon: "chef-hat", library: "MaterialCommunityIcons" },
      { id: "act_cleaning", mets: 3.5, icon: "broom", library: "MaterialCommunityIcons" },
      { id: "act_vacuuming", mets: 3.3, icon: "robot-vacuum", library: "MaterialCommunityIcons" }, // 或用一般吸塵器圖標
      { id: "act_mopping", mets: 3.5, icon: "bucket", library: "MaterialCommunityIcons" },
      { id: "act_housework", mets: 3.5, icon: "home", library: "MaterialCommunityIcons" },
      { id: "act_childcare", mets: 3.0, icon: "baby-carriage", library: "MaterialCommunityIcons" },
      { id: "act_play_children", mets: 4.0, icon: "human-child", library: "MaterialCommunityIcons" },
      { id: "act_play_animals", mets: 4.0, icon: "dog", library: "MaterialCommunityIcons" },
      { id: "act_walking_dog", mets: 3.0, icon: "dog-side", library: "MaterialCommunityIcons" },
      { id: "act_shopping", mets: 2.3, icon: "cart", library: "MaterialCommunityIcons" },
      { id: "act_carrying_groceries", mets: 3.5, icon: "shopping", library: "MaterialCommunityIcons" },
      { id: "act_washing_car", mets: 3.0, icon: "car-wash", library: "MaterialCommunityIcons" },
      
      { id: "act_gardening", mets: 4.0, icon: "flower", library: "MaterialCommunityIcons" },
      { id: "act_weeding", mets: 4.5, icon: "sprout", library: "MaterialCommunityIcons" },
      { id: "act_mowing", mets: 5.5, icon: "grass", library: "MaterialCommunityIcons" },
      { id: "act_shoveling", mets: 6.0, icon: "shovel", library: "MaterialCommunityIcons" },
      { id: "act_painting", mets: 4.5, icon: "format-paint", library: "MaterialCommunityIcons" },
      { id: "act_carpentry", mets: 3.5, icon: "hammer", library: "MaterialCommunityIcons" },
      { id: "act_wiring", mets: 3.3, icon: "pipe", library: "MaterialCommunityIcons" },
      
      { id: "act_moving", mets: 6.0, icon: "truck-delivery", library: "MaterialCommunityIcons" },
      { id: "act_fishing", mets: 3.5, icon: "fish", library: "MaterialCommunityIcons" },
      { id: "act_hunting", mets: 5.0, icon: "target", library: "MaterialCommunityIcons" },
    ],
  },
  { id: "cat_custom", items: [] }
];

const FEELING_EMOJIS = ["😫", "😓", "😐", "🙂", "🤩", "💪"];

// [新增] 根據 METs 判斷強度的輔助函式
const getIntensityFromMets = (mets: number): "low" | "medium" | "high" => {
  if (mets < 3) return "low";
  if (mets > 6) return "high";
  return "medium"; // 3 <= mets <= 6
};

export default function ActivityEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const lang = useLanguage();

  const [logId, setLogId] = useState<number | null>(null);
  const [recordDate, setRecordDate] = useState(new Date());
  const [recordTime, setRecordTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [activity, setActivity] = useState<ActivityItem | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [customActivityName, setCustomActivityName] = useState("");

  const [intensity, setIntensity] = useState<"low"|"medium"|"high">("medium");
  const [duration, setDuration] = useState(""); 
  const [distance, setDistance] = useState("");
  const [steps, setSteps] = useState("");
  const [floors, setFloors] = useState("");

  const [details, setDetails] = useState("");
  const [feeling, setFeeling] = useState("🙂");
  const [userWeight, setUserWeight] = useState(70);

  // 1. 載入用戶體重
  useEffect(() => {
    async function loadUserProfile() {
      try {
        const profile = await db.select().from(userProfiles).orderBy(desc(userProfiles.updatedAt)).limit(1);
        if (profile.length > 0 && profile[0].currentWeightKg) {
          setUserWeight(profile[0].currentWeightKg);
        }
      } catch (e) { console.log(e); }
    }
    loadUserProfile();
  }, []);

  // 2. 載入紀錄 (編輯模式 或 快捷新增模式)
  useEffect(() => {
      async function loadLog() {
          // A. 編輯既有紀錄
          if (params.logId) {
              const id = parseInt(params.logId as string);
              setLogId(id);
              try {
                  const res = await db.select().from(activityLogs).where(eq(activityLogs.id, id));
                  if (res.length > 0) {
                      const log = res[0];
                      setRecordDate(new Date(log.date));
                      setRecordTime(new Date(log.loggedAt));
                      
                      setDuration(log.durationMinutes?.toString() || "");
                      setDistance(log.distanceKm?.toString() || "");
                      setSteps(log.steps?.toString() || "");
                      setFloors(log.floors?.toString() || "");
                      setDetails(log.notes || "");
                      setFeeling(log.feeling || "🙂");
                      if(log.intensity) setIntensity(log.intensity as any);

                      // 嘗試回填類別與活動
                      let found = false;
                      const logCatName = log.category;
                      const logActName = log.activityName;

                      for (const cat of ACTIVITY_RAW) {
                          if (t(cat.id, lang) === logCatName || (cat.id === 'cat_custom' && logCatName === t('cat_custom', lang))) {
                              if (cat.items.length > 0) {
                                  const act = cat.items.find(item => t(item.id, lang) === logActName);
                                  if (act) {
                                      setCategory(cat);
                                      setActivity(act);
                                      found = true;
                                  }
                              }
                              break;
                          }
                      }

                      if (!found) {
                          const customCat = ACTIVITY_RAW.find(c => c.id === 'cat_custom');
                          setCategory(customCat || null);
                          setCustomActivityName(logActName);
                          setActivity(null);
                      }
                  }
              } catch (e) {
                  console.error("Load log failed:", e);
              }
          } 
          // B. [FIX] 來自首頁快捷鍵的新增模式
          else if (params.activityName) {
             const targetName = params.activityName as string;
             let found = false;

             // 遍歷所有分類尋找符合名稱的項目 (比對翻譯後的名稱)
             for (const cat of ACTIVITY_RAW) {
                 const matchItem = cat.items.find(item => t(item.id, lang) === targetName);
                 if (matchItem) {
                     setCategory(cat);
                     setActivity(matchItem);
                     // [修改] 快捷新增時，自動帶入對應強度
                     setIntensity(getIntensityFromMets(matchItem.mets));
                     found = true;
                     break;
                 }
             }

             // 若找不到 (可能是自訂名稱)，則歸類為 Custom
             if (!found) {
                 const customCat = ACTIVITY_RAW.find(c => c.id === 'cat_custom');
                 setCategory(customCat || null);
                 setCustomActivityName(targetName);
                 setActivity(null);
             }
          }
      }
      loadLog();
  }, [params.logId, params.activityName]);

  const calculatedCalories = useMemo(() => {
    const timeMins = parseFloat(duration);
    if (!isNaN(timeMins) && timeMins > 0) {
        const baseMets = activity ? activity.mets : 4.0;
        const multiplier = intensity === 'low' ? 0.8 : (intensity === 'high' ? 1.2 : 1.0);
        return Math.round(baseMets * multiplier * userWeight * (timeMins / 60));
    }
    let estCalories = 0;
    const distKm = parseFloat(distance);
    if (!isNaN(distKm) && distKm > 0) estCalories += distKm * userWeight * 0.9;
    const stepCount = parseInt(steps);
    if (!isNaN(stepCount) && stepCount > 0) {
        const stepCal = stepCount * 0.04;
        if (stepCal > estCalories) estCalories = stepCal;
    }
    return Math.round(estCalories);
  }, [activity, intensity, duration, distance, steps, userWeight]);

  const handleSave = async () => {
    const hasValue = duration || distance || steps || floors;
    const hasName = (category?.id === 'cat_custom' && customActivityName) || activity;

    if (!hasName || !hasValue) {
      Alert.alert(t('data_incomplete', lang), t('data_incomplete_msg', lang));
      return;
    }

    try {
      const logDate = new Date(recordDate);
      logDate.setHours(recordTime.getHours());
      logDate.setMinutes(recordTime.getMinutes());

      const finalName = category?.id === 'cat_custom' ? customActivityName : t(activity.id, lang);

      const logData = {
        date: format(logDate, 'yyyy-MM-dd'),
        loggedAt: logDate,
        category: t(category?.id, lang),
        activityName: finalName,
        intensity: intensity,
        durationMinutes: parseInt(duration) || 0,
        distanceKm: parseFloat(distance) || null,
        steps: parseInt(steps) || null,
        floors: parseInt(floors) || null,
        caloriesBurned: calculatedCalories,
        feeling: feeling,
        notes: details,
      };

      if (logId) {
          await db.update(activityLogs).set(logData).where(eq(activityLogs.id, logId));
      } else {
          await db.insert(activityLogs).values(logData);
      }

      Alert.alert(t('success', lang), "OK", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      console.error(e);
      Alert.alert(t('error', lang), "Save Failed");
    }
  };

  // Render
  const renderSelectorModal = () => (
    <Modal visible={showSelector} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="subtitle">{t('select_activity', lang)}</ThemedText>
            <TouchableOpacity onPress={() => setShowSelector(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
          
          <View style={{flexDirection: 'row', flex: 1}}>
            <View style={[styles.categoryList, { borderColor: theme.icon }]}>
              {ACTIVITY_RAW.map(cat => (
                <TouchableOpacity 
                  key={cat.id} 
                  style={[styles.catItem, category?.id === cat.id && { backgroundColor: theme.tint + '20' }]}
                  onPress={() => setCategory(cat)}
                >
                  <ThemedText style={{fontWeight: category?.id === cat.id ? 'bold' : 'normal', color: category?.id === cat.id ? theme.tint : theme.text}}>
                    {t(cat.id, lang)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <FlatList
              data={category?.items || []}
              keyExtractor={item => item.id}
              ListEmptyComponent={
                category?.id === 'cat_custom' ? (
                  <View style={{padding: 16}}>
                    <ThemedText>{t('custom_activity', lang)}</ThemedText>
                    <TouchableOpacity 
                        style={[styles.confirmBtn, {backgroundColor: theme.tint, marginTop: 20}]}
                        onPress={() => { setActivity(null); setShowSelector(false); }}
                    >
                        <ThemedText style={{color: '#FFF'}}>OK</ThemedText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{padding: 16}}><ThemedText style={{color: theme.icon}}>{t('select_category_msg',lang)}</ThemedText></View>
                )
              }
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.activityItem}
                  onPress={() => { 
                    setActivity(item); 
                    // [修改] 選擇活動時，自動切換至建議強度
                    setIntensity(getIntensityFromMets(item.mets));
                    setShowSelector(false); 
                  }}
                >
                  <View style={{flexDirection:'row', alignItems:'center'}}>
                      {/* [修改] 使用統一元件 */}
                      <ActivityIcon 
                          library={item.library} 
                          name={item.icon} 
                          size={20} 
                          color={theme.text} 
                          style={{marginRight: 10}} 
                      />  
                      <ThemedText>{t(item.id, lang)}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.icon} />
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={28} color={theme.text} /></TouchableOpacity>
        <ThemedText type="subtitle">{logId ? t('edit_activity', lang) : t('record_activity', lang)}</ThemedText>
        <TouchableOpacity onPress={handleSave}><Ionicons name="save" size={28} color={theme.tint} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.dateTimeRow}>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateBtn}><Ionicons name="calendar-outline" size={20} color={theme.text} /><ThemedText style={{marginLeft: 8}}>{format(recordDate, "yyyy-MM-dd")}</ThemedText></TouchableOpacity>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={styles.dateBtn}><Ionicons name="time-outline" size={20} color={theme.text} /><ThemedText style={{marginLeft: 8}}>{format(recordTime, "HH:mm")}</ThemedText></TouchableOpacity>
        </View>
        {showDatePicker && <DateTimePicker value={recordDate} mode="date" onChange={(e,d) => {setShowDatePicker(false); if(d) setRecordDate(d)}} />}
        {showTimePicker && <DateTimePicker value={recordTime} mode="time" onChange={(e,d) => {setShowTimePicker(false); if(d) setRecordTime(d)}} />}

        <ThemedView style={styles.card}>
          <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowSelector(true)}>
             <View>
                <ThemedText style={styles.labelSmall}>{t('select_activity', lang)}</ThemedText>
                <View style={{flexDirection:'row', alignItems:'center', marginTop: 4}}>

                    {/* [同步修改] 主按鈕上的圖示顯示邏輯 */}
                    {activity?.icon && (
                      <ActivityIcon 
                        library={activity.library} // [修正] 補上 library 屬性
                        name={activity.icon} 
                        size={24} 
                        color={theme.text} 
                        style={{marginRight: 8}} 
                      />
                    )}
                    
                    <ThemedText type="defaultSemiBold" style={{fontSize: 18}}>
                        {category?.id === 'cat_custom' ? (customActivityName || t('custom_activity', lang)) : (activity ? t(activity.id, lang) : t('select_activity', lang))}
                    </ThemedText>
                </View>
             </View>
             <Ionicons name="chevron-down" size={20} color={theme.icon} />
          </TouchableOpacity>
          {category?.id === 'cat_custom' && (
             <TextInput style={[styles.input, { marginTop: 12, color: theme.text, borderColor: theme.icon }]} placeholder={t('input_activity_name', lang)} placeholderTextColor="#D1D1D6" value={customActivityName} onChangeText={setCustomActivityName} />
          )}
        </ThemedView>

        {renderSelectorModal()}

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>{t('activity_intensity', lang)}</ThemedText>
            <View style={styles.intensityContainer}>
                {['low', 'medium', 'high'].map((key) => {
                    const label = t(`intensity_${key}`, lang);
                    const color = key==='low'?'#34C759':(key==='medium'?'#FF9500':'#FF3B30');
                    const isSelected = intensity === key;
                    return (
                        <TouchableOpacity key={key} style={[styles.intensityBtn, { borderColor: color, backgroundColor: isSelected ? color : 'transparent' }]} onPress={() => setIntensity(key as any)}>
                            <ThemedText style={{color: isSelected ? '#FFF' : color, fontWeight: '600'}}>{label}</ThemedText>
                        </TouchableOpacity>
                    );
                })}
            </View>
            
            {/* 新增：METs 說明註釋 */}
            <View style={{marginTop: 16, backgroundColor: 'rgba(0,0,0,0.03)', padding: 10, borderRadius: 8}}>
                <ThemedText style={{fontSize: 12, color: '#666', lineHeight: 18}}>
                    {t('mets_explanation', lang)}
                </ThemedText>
            </View>
        </ThemedView>

        <ThemedView style={styles.card}>
             <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>{t('activity_details', lang)}</ThemedText>
             <View style={styles.inputRow}>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('time_min', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={duration} onChangeText={setDuration} keyboardType="numeric"/></View>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('distance_km', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={distance} onChangeText={setDistance} keyboardType="numeric"/></View>
             </View>
             <View style={styles.inputRow}>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('steps', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={steps} onChangeText={setSteps} keyboardType="numeric"/></View>
                 <View style={styles.inputItem}><ThemedText style={styles.labelSmall}>{t('floors', lang)}</ThemedText><TextInput style={[styles.input, { color: theme.text, borderColor: theme.icon }]} value={floors} onChangeText={setFloors} keyboardType="numeric"/></View>
             </View>
             <View style={styles.caloriesBox}>
                 <View><ThemedText>{t('est_calories', lang)}</ThemedText></View>
                 <View style={{alignItems: 'flex-end'}}><ThemedText type="title" style={{color: '#FF9500'}}>{calculatedCalories} kcal</ThemedText></View>
             </View>
        </ThemedView>

        <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold" style={{marginBottom: 12}}>{t('feeling_notes', lang)}</ThemedText>
            <View style={styles.feelingContainer}>
                {FEELING_EMOJIS.map(emoji => (
                    <TouchableOpacity key={emoji} style={[styles.emojiBtn, feeling === emoji && { backgroundColor: theme.tint + '30', borderColor: theme.tint }]} onPress={() => setFeeling(emoji)}>
                        <ThemedText style={{fontSize: 24}}>{emoji}</ThemedText>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top', marginTop: 12, color: theme.text, borderColor: theme.icon }]} placeholder={t('enter_notes', lang)} placeholderTextColor="#D1D1D6" multiline value={details} onChangeText={setDetails} />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  scrollContent: { padding: 16 },
  dateTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, backgroundColor: 'rgba(142, 142, 147, 0.1)', flex: 0.48, justifyContent: 'center' },
  card: { padding: 16, borderRadius: 12, marginBottom: 16, backgroundColor: 'rgba(142, 142, 147, 0.05)' },
  selectorBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelSmall: { fontSize: 12, color: '#8E8E93', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '70%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  categoryList: { width: '35%', borderRightWidth: 1 },
  catItem: { paddingVertical: 16, paddingHorizontal: 12 },
  activityItem: { paddingVertical: 16, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  confirmBtn: { padding: 12, borderRadius: 8, alignItems: 'center' },
  intensityContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  intensityBtn: { flex: 0.3, paddingVertical: 10, borderWidth: 1, borderRadius: 8, alignItems: 'center' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  inputItem: { width: '48%' },
  caloriesBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 149, 0, 0.1)', padding: 12, borderRadius: 8, marginTop: 8 },
  feelingContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  emojiBtn: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent' },
});