import { Link } from 'react-router-dom';
import { Bot, Cpu, Trophy } from 'lucide-react';
import LightningEffect from '../components/LightningEffect';
import { useAuth } from '../auth/useAuth';

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

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold text-slate-900">老莫機器人教育中心</span>
        <nav className="flex items-center gap-3 text-sm">
          {isAdmin && (
            <Link to="/admin" className="text-slate-600 hover:text-brand-600">
              後台管理
            </Link>
          )}
          {user ? (
            <Link to="/my" className="text-slate-600 hover:text-brand-600">
              我的報名
            </Link>
          ) : (
            <Link to="/login" className="text-slate-600 hover:text-brand-600">
              登入
            </Link>
          )}
        </nav>
      </header>

      {/* 主視覺：手機直式滿版、桌機左文右圖 */}
      <section className="relative overflow-hidden bg-slate-900">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-24">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              讓孩子親手
              <br />
              打造第一台機器人
            </h1>
            <p className="mt-4 max-w-md text-base text-slate-300 sm:text-lg">
              從積木、電路到程式，老莫機器人教育中心陪孩子把想像變成真的會動的作品。
            </p>
            <Link
              to={user ? '/apply' : '/register'}
              className="mt-8 inline-block rounded-xl bg-brand-500 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-brand-600"
            >
              立即報名
            </Link>
          </div>

          <div className="relative">
            <LightningEffect />
            <img
              src="/hero.webp"
              alt="孩子在教室裡組裝教育機器人"
              width={1920}
              height={1072}
              loading="eager"
              className="relative w-full rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* 課程簡介：手機單欄堆疊、桌機三欄並排 */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          我們怎麼教
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl bg-slate-50 p-6">
              <feature.icon className="h-8 w-8 text-brand-600" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-brand-50">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <h2 className="text-2xl font-bold text-slate-900">準備好讓孩子開始了嗎？</h2>
          <p className="mt-3 text-slate-600">
            填寫報名資訊，我們會盡快與您聯繫安排試上。
          </p>
          <Link
            to={user ? '/apply' : '/register'}
            className="mt-6 inline-block rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white transition hover:bg-brand-700"
          >
            填寫報名資訊
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-400">
        © 老莫機器人教育中心
      </footer>
    </div>
  );
}
