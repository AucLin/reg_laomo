import type { SVGProps } from 'react';

/*
  手繪風插圖。

  全部是手畫的 path，沒有用 feTurbulence 那類抖動濾鏡 —— 濾鏡要瀏覽器
  另外算一層點陣圖，為了幾張裝飾圖在長輩的舊手機上付這個代價不划算。
  線條直接畫歪就好，看起來一樣，成本是零。

  一律 aria-hidden：這些是氣氛，不是資訊。畫面上該說的話都用文字說了，
  用讀螢幕軟體的家長不會因為看不到插圖而少知道任何事。

  主線一律用 currentColor，由外層的 text-* 決定顏色；點綴色（琥珀）寫死，
  因為它就是要跟主色形成對比。
*/

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ACCENT = '#f59e0b';

/** 揮手打招呼的機器人。登入頁用 */
export function RobotDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 150 140" aria-hidden="true" {...props}>
      <g {...STROKE}>
        {/* 天線 */}
        <path d="M75 30 C 74 24, 76 21, 75 17" />
        <circle cx="75" cy="13" r="4.5" fill={ACCENT} stroke={ACCENT} />

        {/* 頭：四邊都畫歪一點，才不像用尺量的 */}
        <path d="M38 32 C 62 29, 94 30, 111 32 C 113 50, 112 68, 111 75 C 86 78, 56 77, 38 75 C 36 58, 37 40, 38 32 Z" />
        <circle cx="60" cy="50" r="5.5" fill="currentColor" />
        <circle cx="90" cy="50" r="5.5" fill="currentColor" />
        <path d="M61 62 C 68 69, 82 69, 89 61" />

        {/* 脖子 */}
        <path d="M66 77 L 66 84" />
        <path d="M84 77 L 84 84" />

        {/* 身體 */}
        <path d="M44 86 C 66 83, 88 84, 106 86 C 108 102, 107 116, 106 122 C 82 125, 60 124, 44 122 C 42 108, 43 94, 44 86 Z" />
        <path d="M62 100 C 70 97, 82 98, 89 100" />
        <circle cx="66" cy="112" r="3.5" />
        <circle cx="84" cy="112" r="3.5" fill={ACCENT} stroke={ACCENT} />

        {/* 左手舉起來揮 */}
        <path d="M44 95 C 32 92, 24 80, 26 66" />
        <path d="M20 60 C 22 55, 30 55, 31 61 C 32 55, 39 56, 39 62 C 39 70, 33 74, 27 72 C 22 71, 19 66, 20 60 Z" />
        {/* 揮動的動線 */}
        <path d="M10 46 C 13 44, 15 41, 15 38" opacity="0.55" />
        <path d="M18 40 C 20 36, 21 33, 20 29" opacity="0.55" />

        {/* 右手 */}
        <path d="M106 96 C 117 99, 122 108, 119 118" />

        {/* 腳 */}
        <path d="M60 124 L 58 134" />
        <path d="M90 124 L 92 134" />
        <path d="M48 135 L 68 135" />
        <path d="M82 135 L 102 135" />
      </g>
    </svg>
  );
}

/*
  只有頭的機器人，給店名旁邊那顆 28px 的小標記用。
  RobotDoodle 縮到這個尺寸會糊成一團（手、腳、身上的按鈕全擠在一起），
  細節少一半的版本反而看得出是機器人。
*/
export function RobotMarkDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 40" aria-hidden="true" {...props}>
      <g {...STROKE}>
        <path d="M24 11 C 23.5 8, 24.5 6.5, 24 5" />
        <circle cx="24" cy="3.5" r="2.6" fill={ACCENT} stroke={ACCENT} />
        <path d="M8 13 C 20 11.5, 32 12, 40 13 C 41 20, 40.5 28, 40 32 C 28 33.5, 16 33, 8 32 C 7 24, 7.5 17, 8 13 Z" />
        <circle cx="17.5" cy="20" r="2.8" fill="currentColor" />
        <circle cx="30.5" cy="20" r="2.8" fill="currentColor" />
        <path d="M18 26 C 21 29, 27 29, 30 25.5" />
      </g>
    </svg>
  );
}

/** 齒輪與積木。註冊頁用 —— 建帳號是「開始組裝」的第一步 */
export function BlocksDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" {...props}>
      <g {...STROKE}>
        {/* 積木一 */}
        <path d="M18 60 C 40 57, 62 58, 76 60 C 78 74, 77 86, 76 92 C 54 95, 36 94, 18 92 C 16 80, 17 66, 18 60 Z" />
        <path d="M30 58 C 30 51, 31 48, 38 48 C 45 48, 46 51, 46 58" />
        <path d="M54 58 C 54 51, 55 48, 62 48 C 69 48, 70 51, 70 58" />

        {/* 積木二，疊在旁邊 */}
        <path
          d="M88 74 C 106 71, 128 72, 142 74 C 144 84, 143 90, 142 94 C 122 97, 106 96, 88 94 C 86 86, 87 78, 88 74 Z"
          stroke={ACCENT}
        />
        <path d="M100 72 C 100 66, 101 63, 108 63 C 115 63, 116 66, 116 72" stroke={ACCENT} />

        {/* 齒輪 */}
        <circle cx="112" cy="30" r="15" />
        <circle cx="112" cy="30" r="5.5" />
        <path d="M112 8 L 112 14" />
        <path d="M112 46 L 112 52" />
        <path d="M90 30 L 96 30" />
        <path d="M128 30 L 134 30" />
        <path d="M97 15 L 101 19" />
        <path d="M123 41 L 127 45" />
        <path d="M127 15 L 123 19" />
        <path d="M101 41 L 97 45" />

        {/* 火花 */}
        <path d="M44 26 L 44 36" stroke={ACCENT} />
        <path d="M39 31 L 49 31" stroke={ACCENT} />
        <path d="M62 16 L 62 22" stroke={ACCENT} />
        <path d="M59 19 L 65 19" stroke={ACCENT} />
      </g>
    </svg>
  );
}

/** 飛出去的信。註冊完等收信那一頁用 */
export function EnvelopeDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" {...props}>
      <g {...STROKE}>
        {/* 信封 */}
        <path d="M46 34 C 78 31, 118 32, 142 34 C 144 56, 143 82, 142 92 C 110 95, 74 94, 46 92 C 44 72, 45 46, 46 34 Z" />
        <path d="M46 36 C 66 54, 82 66, 94 66 C 106 66, 122 54, 142 36" />
        <path d="M46 91 C 62 78, 72 70, 76 67" opacity="0.6" />
        <path d="M142 91 C 126 78, 116 70, 112 67" opacity="0.6" />

        {/* 打勾的圓章 */}
        <circle cx="130" cy="86" r="15" fill="#fff" stroke={ACCENT} />
        <path d="M123 86 L 128 92 L 138 80" stroke={ACCENT} />

        {/* 飛行動線 */}
        <path d="M8 48 L 32 48" opacity="0.55" />
        <path d="M4 64 L 28 64" opacity="0.55" />
        <path d="M14 80 L 34 80" opacity="0.55" />

        {/* 星星 */}
        <path d="M28 18 L 28 30" stroke={ACCENT} />
        <path d="M22 24 L 34 24" stroke={ACCENT} />
        <path d="M116 14 L 116 22" stroke={ACCENT} />
        <path d="M112 18 L 120 18" stroke={ACCENT} />
      </g>
    </svg>
  );
}

/** 拿著望遠鏡找東西的樣子。「目前沒有比賽」「還沒有孩子資料」等空畫面用 */
export function SearchingDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" {...props}>
      <g {...STROKE}>
        {/* 放大鏡 */}
        <circle cx="66" cy="52" r="30" />
        <circle cx="66" cy="52" r="22" opacity="0.35" />
        <path d="M88 74 C 98 84, 108 94, 116 102" strokeWidth={5} />

        {/* 鏡片裡的問號 */}
        <path d="M58 44 C 58 37, 64 34, 69 36 C 75 38, 75 45, 70 48 C 67 50, 66 52, 66 56" />
        <circle cx="66" cy="64" r="1.8" fill="currentColor" />

        {/* 找不到東西的虛線圈 */}
        <path d="M20 96 C 34 92, 52 91, 66 92" opacity="0.4" strokeDasharray="5 7" />
        <path d="M96 30 C 110 24, 128 22, 142 26" opacity="0.4" strokeDasharray="5 7" />

        {/* 星星 */}
        <path d="M132 60 L 132 70" stroke={ACCENT} />
        <path d="M127 65 L 137 65" stroke={ACCENT} />
      </g>
    </svg>
  );
}

/** 獎盃。比賽相關的標題旁用 */
export function TrophyDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" {...props}>
      <g {...STROKE}>
        <path d="M36 20 C 52 17, 70 18, 84 20 C 85 44, 80 62, 60 66 C 40 62, 35 44, 36 20 Z" />
        <path d="M36 26 C 26 25, 20 30, 22 38 C 24 46, 32 49, 38 47" />
        <path d="M84 26 C 94 25, 100 30, 98 38 C 96 46, 88 49, 82 47" />
        <path d="M60 66 L 60 82" />
        <path d="M42 84 C 54 81, 66 82, 78 84 C 79 90, 78 94, 78 96 C 66 99, 54 98, 42 96 C 41 92, 41 88, 42 84 Z" />
        <path d="M52 38 L 58 46 L 70 32" stroke={ACCENT} />
        <path d="M104 62 L 104 72" stroke={ACCENT} />
        <path d="M99 67 L 109 67" stroke={ACCENT} />
        <path d="M16 58 L 16 66" stroke={ACCENT} />
        <path d="M12 62 L 20 62" stroke={ACCENT} />
      </g>
    </svg>
  );
}

/** 夾著報名表的板子。「還沒有任何報名紀錄」的空畫面用 */
export function ClipboardDoodle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 150 130" aria-hidden="true" {...props}>
      <g {...STROKE}>
        {/* 板身 */}
        <path d="M34 26 C 60 23, 90 24, 110 26 C 112 56, 111 94, 110 114 C 84 117, 56 116, 34 114 C 32 84, 33 46, 34 26 Z" />
        {/* 上面的夾子 */}
        <path d="M56 27 C 56 17, 63 13, 72 13 C 81 13, 88 17, 88 27 C 79 29, 65 29, 56 27 Z" />

        {/* 表格上的三行字，長度不一才像真的手寫 */}
        <path d="M48 52 C 62 50, 78 51, 96 52" />
        <path d="M48 68 C 60 66, 72 67, 86 68" />
        <path d="M48 84 C 64 82, 80 83, 94 84" />

        {/* 打勾的圓章，跟註冊完那張信封用同一個記號 */}
        <circle cx="112" cy="98" r="15" fill="#fff" stroke={ACCENT} />
        <path d="M105 98 L 110 104 L 120 92" stroke={ACCENT} />

        {/* 星星 */}
        <path d="M20 40 L 20 50" stroke={ACCENT} />
        <path d="M15 45 L 25 45" stroke={ACCENT} />
        <path d="M126 34 L 126 42" stroke={ACCENT} />
        <path d="M122 38 L 130 38" stroke={ACCENT} />
      </g>
    </svg>
  );
}

/*
  卡片裡的分隔線，畫成一排手點上去的短虛線。
  一樣用 preserveAspectRatio="none" 跟著容器拉寬：橫向拉伸會把虛線的
  間距一起拉開，寬卡片上剛好變成疏一點的點線，不必為不同寬度各畫一版。
*/
export function DashedRule({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 6"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`h-1.5 w-full ${className}`}
    >
      <path
        d="M2 4 C 40 2, 78 5, 116 3 C 148 1.6, 176 4.5, 198 3"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
    </svg>
  );
}

/*
  標題底下那條歪歪的線。用 preserveAspectRatio="none" 讓它跟著標題拉寬，
  高度不變 —— 拉寬時線條會變扁一點點，那正是手畫的樣子。
*/
export function Squiggle({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 10"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`h-2 w-full ${className}`}
    >
      <path
        d="M2 7 C 30 2, 52 8, 80 5 C 108 2, 132 8, 158 5 C 176 3, 190 6, 198 4"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 手繪小星星，散在角落當點綴 */
export function Spark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-4 w-4 ${className}`}>
      <path
        d="M12 2 C 13 9, 15 11, 22 12 C 15 13, 13 15, 12 22 C 11 15, 9 13, 2 12 C 9 11, 11 9, 12 2 Z"
        fill="currentColor"
      />
    </svg>
  );
}
