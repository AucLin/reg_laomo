import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Cpu, Trophy } from 'lucide-react';
import LightningEffect from '../components/LightningEffect';
import {
  BlocksDoodle,
  DashedRule,
  RobotDoodle,
  RobotMarkDoodle,
  Spark,
  Squiggle,
  TrophyDoodle,
} from '../components/doodles';
import { useAuth } from '../auth/useAuth';
import { listOpenContests } from '../lib/contests';
import { formatGrade, type Contest } from '../lib/types';

const FEATURES = [
  {
    icon: Bot,
    title: '動手做中學',
    description: '從組裝到程式，孩子親手打造會動的機器人，把抽象概念變成看得見的成果。',
  },
  {
    icon: Cpu,
    title: '循序漸進的課程',
    description: '依年齡與程度分班，從積木式程式到文字程式，每個階段都有明確的能力目標。',
  },
  {
    icon: Trophy,
    title: '賽事與成果發表',
    description: '定期舉辦成果發表，並輔導有興趣的孩子參加各級機器人競賽。',
  },
];

export default function LandingPage() {
  const { user, isAdmin } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);

  useEffect(() => {
    let active = true;
    listOpenContests().then((rows) => {
      if (!active) return;
      // 進入頁只放最近三場，其餘引導到比賽頁
      setContests(rows.filter((row) => row.status === 'published').slice(0, 3));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4">
        {/*
          店名維持在單一個元素裡（插圖放在同一顆 span 內），
          不要拆成「圖示 ＋ 文字」兩個節點 —— 拆開會讓靠文字定位的測試
          與讀螢幕軟體各自拿到半截店名。
        */}
        <span className="flex min-w-0 items-center gap-2 text-lg font-bold text-slate-900">
          <RobotMarkDoodle className="h-8 w-8 shrink-0 text-brand-600" />
          老莫機器人
        </span>
        <nav className="flex items-center gap-3 text-sm">
          {isAdmin && (
            <Link to="/admin" className="font-medium text-slate-600 hover:text-brand-700">
              後台管理
            </Link>
          )}
          {user ? (
            <Link to="/my" className="font-medium text-slate-600 hover:text-brand-700">
              我的報名
            </Link>
          ) : (
            <Link to="/login" className="font-medium text-slate-600 hover:text-brand-700">
              登入
            </Link>
          )}
        </nav>
      </header>

      {/* 主視覺：手機直式滿版、桌機左文右圖 */}
      <section className="relative overflow-hidden bg-brand-900">
        {/* 深底上再壓一層靛藍，色調比原本的中性灰暖一點，跟琥珀點綴才是同一家 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-900 via-slate-900 to-brand-800"
        />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-white/25 px-3 py-1 text-xs font-semibold text-brand-100">
              <Spark className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              國小到國中，分齡小班
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              讓孩子親手
              <br />
              打造第一台機器人
            </h1>
            <div className="mt-3 w-40 sm:w-52">
              <Squiggle className="text-amber-400" />
            </div>
            <p className="mt-4 max-w-md text-base leading-relaxed text-slate-200 sm:text-lg">
              從積木、電路到程式，老莫機器人陪孩子把想像變成真的會動的作品。
            </p>
            <Link
              to={user ? '/apply' : '/register'}
              className="doodle-btn mt-8 inline-block bg-amber-400 px-8 py-3.5 text-base text-slate-900 shadow-[0_4px_0_#b45309] hover:bg-amber-300 active:shadow-[0_1px_0_#b45309]"
            >
              立即報名
            </Link>
          </div>

          <div className="relative">
            <LightningEffect />
            {/*
              照片框成一張貼歪的相片：白邊＋輕微傾斜。傾斜只給桌機，
              手機上滿版照片一斜就會頂出橫向捲軸。
            */}
            <img
              src="/hero.webp"
              alt="孩子在教室裡組裝教育機器人"
              width={1920}
              height={1072}
              loading="eager"
              className="relative w-full rounded-[2rem_1.5rem_2.25rem_1.6rem] border-4 border-white/85 shadow-2xl lg:-rotate-1"
            />
            <RobotDoodle
              className="animate-doodle-float absolute -bottom-4 -left-2 hidden h-24 w-auto text-amber-300 sm:block"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      {/* 課程簡介：手機單欄堆疊、桌機三欄並排 */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">我們怎麼教</h2>
          <div className="mx-auto mt-2 w-28">
            <Squiggle className="text-amber-400" />
          </div>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={`${
                index % 2 === 0 ? 'doodle-card' : 'doodle-card-alt'
              } p-6`}
            >
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-[1.1rem_0.85rem_1.15rem_0.9rem] border-2 border-amber-200 bg-amber-50">
                <feature.icon className="h-7 w-7 text-brand-700" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-slate-900">{feature.title}</h3>
              <div className="mt-2 text-slate-300">
                <DashedRule />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/*
        近期比賽。未登入也讀得到（列級權限只擋草稿），這是招生素材 ——
        家長不必先註冊才知道中心有在帶孩子比賽。沒有開放中的比賽時整段
        不出現，免得留一塊空白區塊。
      */}
      {contests.length > 0 && (
        <section className="border-y-2 border-slate-900/5 bg-brand-50/60">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="flex flex-col items-center text-center">
              <TrophyDoodle className="h-16 w-16 -rotate-6 text-brand-600" />
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                近期比賽
              </h2>
              <div className="mt-2 w-28">
                <Squiggle className="text-amber-400" />
              </div>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              {contests.map((contest, index) => (
                <li
                  key={contest.id}
                  className={`${
                    index % 2 === 0 ? 'doodle-card' : 'doodle-card-alt'
                  } p-5`}
                >
                  <h3 className="break-words font-bold text-slate-900">
                    {contest.title}
                  </h3>
                  <div className="mt-2 text-slate-300">
                    <DashedRule />
                  </div>
                  <p className="mt-2 break-words text-sm text-slate-600">
                    {contest.event_date} · {contest.location}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {formatGrade(contest.min_grade)}至
                    {formatGrade(contest.max_grade)} · 報名至{' '}
                    {contest.signup_deadline}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-8 text-center">
              <Link to="/contests" className="doodle-btn-soft inline-block px-6 py-3">
                看比賽詳情與報名
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <BlocksDoodle className="animate-doodle-float mx-auto h-20 w-auto text-brand-600" />
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            準備好讓孩子開始了嗎？
          </h2>
          <div className="mx-auto mt-2 w-32">
            <Squiggle className="text-amber-400" />
          </div>
          <p className="mt-3 text-slate-600">
            填寫報名資訊，我們會盡快與您聯繫安排試上。
          </p>
          <Link
            to={user ? '/apply' : '/register'}
            className="doodle-btn mt-6 inline-block px-8 py-3.5"
          >
            填寫報名資訊
          </Link>
        </div>
      </section>

      <footer className="border-t-2 border-slate-900/10 py-8 text-center text-sm text-slate-600">
        © 老莫機器人
      </footer>
    </div>
  );
}
