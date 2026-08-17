import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getSchoolById, searchOtherLevels, searchSchools } from '../lib/schools';
import {
  SCHOOL_LEVEL_LABELS,
  DEFAULT_CITIES,
  type School,
  type SchoolLevel,
} from '../lib/types';

export const DEBOUNCE_MS = 250;

/** 選擇器提供的縣市。老莫招生範圍以雙北為主，其餘依人口排序方便尋找。 */
const CITY_OPTIONS = [
  '新北市',
  '臺北市',
  '桃園市',
  '臺中市',
  '臺南市',
  '高雄市',
  '基隆市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
];

export interface SchoolSelection {
  level: SchoolLevel;
  schoolId: string;
  schoolNameRaw: string;
}

interface Props {
  value: SchoolSelection;
  onChange: (next: SchoolSelection) => void;
}

export default function SchoolSelector({ value, onChange }: Props) {
  const [cities, setCities] = useState<string[]>(DEFAULT_CITIES);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<School[]>([]);
  /*
    目前級別找不到，但其他級別有同名學校時的提示。

    教育部名錄只收獨立立案的學校，一貫制私校的國小部多半只以高中身分
    登錄一筆。家長在國小級別搜「康橋」什麼都沒有，第一反應是系統壞了，
    而不是去點下面的「找不到我的學校」。
  */
  const [otherLevelHints, setOtherLevelHints] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);
  const [manualMode, setManualMode] = useState(value.schoolNameRaw !== '');
  const [searching, setSearching] = useState(false);
  /*
    中文輸入法組字狀態。注音、倉頡在使用者還沒選字前就會持續觸發輸入事件，
    keyword 會短暫變成「ㄓㄨㄥ」這種半成品。組字期間送查詢不但查不到東西，
    還會讓結果清單在打字過程中亂跳，所以用這個狀態擋住防抖動的查詢。
  */
  const [composing, setComposing] = useState(false);

  /*
    編輯既有報名時，外面只傳得進 schoolId，沒有校名。
    這個效果把先前選的學校補查回來顯示，家長才知道自己原本填的是哪一所。
  */
  useEffect(() => {
    if (value.schoolId === '' || selected?.id === value.schoolId) return;
    let active = true;
    getSchoolById(value.schoolId).then((school) => {
      if (active && school) setSelected(school);
    });
    return () => {
      active = false;
    };
  }, [value.schoolId, selected]);

  /*
    掛載當下的 useState 初始值只顧得到「一開始就有自由文字校名」的情況。
    Task 13 報名表頁面編輯既有報名時，是先掛載空白表單，等
    getRegistration(editId) 這個非同步請求 resolve 後才把值餵進來——這時
    元件早就掛載完畢，初始值判斷完全不會再跑。這裡另外用一個效果盯著
    value.schoolNameRaw 的後續變化，非空時才切到自由輸入模式，家長原本
    填的校名才補得回來。
  */
  useEffect(() => {
    if (value.schoolNameRaw !== '') setManualMode(true);
  }, [value.schoolNameRaw]);

  // 防抖動：停止打字 250 毫秒後才查詢，避免每按一個鍵就打一次資料庫
  useEffect(() => {
    // 組字中一律不查 —— 這時的 keyword 是還沒選字的注音符號
    if (manualMode || composing) return;

    const timer = setTimeout(() => {
      setSearching(true);
      searchSchools({ level: value.level, keyword, cities })
        .then(async (found) => {
          setResults(found);
          /*
            只有在這個級別真的查不到時才去問其他級別。查得到就不必問，
            省一次資料庫查詢 —— 這是絕大多數的情況。
          */
          if (found.length > 0 || keyword.trim() === '') {
            setOtherLevelHints([]);
            return;
          }
          setOtherLevelHints(
            await searchOtherLevels({ level: value.level, keyword, cities })
          );
        })
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [keyword, cities, value.level, manualMode, composing]);

  function handleLevelChange(level: SchoolLevel) {
    if (level === value.level) return;
    // 換級別等於換了一整個名單，先前選的學校一定不再適用
    setSelected(null);
    setKeyword('');
    setResults([]);
    // 手動輸入模式下的校名也一併作廢：畫面若繼續停在自由輸入模式，
    // 就會出現「畫面還留著舊校名、父層資料卻已被清空」的不一致
    setManualMode(false);
    onChange({ level, schoolId: '', schoolNameRaw: '' });
  }

  function toggleCity(city: string) {
    setCities((current) =>
      current.includes(city)
        ? current.filter((item) => item !== city)
        : [...current, city]
    );
  }

  function handleSelect(school: School) {
    setSelected(school);
    setResults([]);
    setKeyword('');
    // 存的是學校代碼，不是使用者打的文字
    onChange({ level: value.level, schoolId: school.id, schoolNameRaw: '' });
  }

  function clearSelection() {
    setSelected(null);
    onChange({ level: value.level, schoolId: '', schoolNameRaw: '' });
  }

  function enterManualMode() {
    setManualMode(true);
    setSelected(null);
    setResults([]);
    onChange({ level: value.level, schoolId: '', schoolNameRaw: '' });
  }

  return (
    <div className="space-y-4">
      {/* 第一步：級別 */}
      <div>
        <span className="block text-sm font-medium text-slate-700">學校級別</span>
        <div className="mt-2 flex gap-2">
          {(Object.keys(SCHOOL_LEVEL_LABELS) as SchoolLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => handleLevelChange(level)}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                value.level === level
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500'
              }`}
            >
              {SCHOOL_LEVEL_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      {manualMode ? (
        <ManualInput
          value={value.schoolNameRaw}
          onChange={(text) =>
            onChange({ level: value.level, schoolId: '', schoolNameRaw: text })
          }
          onCancel={() => {
            setManualMode(false);
            onChange({ level: value.level, schoolId: '', schoolNameRaw: '' });
          }}
        />
      ) : selected ? (
        <SelectedSchool school={selected} onClear={clearSelection} />
      ) : (
        <>
          {/* 第二步：縣市，預設雙北 */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">
              縣市
              <span className="ml-2 font-normal text-slate-400">
                預設為老莫招生範圍，可自行調整
              </span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CITY_OPTIONS.map((city) => (
                <label
                  key={city}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
                    cities.includes(city)
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={cities.includes(city)}
                    onChange={() => toggleCity(city)}
                    aria-label={city}
                  />
                  {city}
                </label>
              ))}
            </div>
          </fieldset>

          {/* 第三步：搜尋 */}
          <div>
            <label
              htmlFor="school-keyword"
              className="block text-sm font-medium text-slate-700"
            >
              搜尋學校名稱
            </label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="school-keyword"
                type="text"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={(event) => {
                  // 選字完成才解除封鎖，並補上最終文字 ——
                  // 有些瀏覽器的 compositionend 在 change 之後才發生，
                  // 少了這一行，最後一個字會查不到。
                  setComposing(false);
                  setKeyword(event.currentTarget.value);
                }}
                placeholder="輸入學校名稱關鍵字"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <ul className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {searching && (
                <li className="px-4 py-3 text-sm text-slate-400">搜尋中…</li>
              )}
              {!searching &&
                results.map((school) => (
                  <li key={school.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(school)}
                      className="w-full px-4 py-3 text-left text-sm transition hover:bg-brand-50"
                    >
                      <span className="font-medium text-slate-900">{school.name}</span>
                      <span className="ml-2 text-slate-400">· {school.city}</span>
                    </button>
                  </li>
                ))}
              {!searching && results.length === 0 && keyword !== '' && (
                <li className="px-4 py-3 text-sm text-slate-400">
                  找不到符合的學校，試試放寬縣市範圍
                </li>
              )}
              {/*
                名錄裡有同名學校、只是掛在別的級別。直接告訴家長實際情況，
                否則他只會看到「找不到」，不會意識到該走自由填寫那條路。
              */}
              {!searching && otherLevelHints.length > 0 && (
                <li className="border-t border-slate-100 bg-amber-50 px-4 py-3">
                  <p className="text-sm text-amber-900">
                    名錄裡有這些同名學校，但登錄在其他級別：
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {otherLevelHints.map((school) => (
                      <li key={school.id} className="text-sm text-amber-800">
                        · {school.name}
                        <span className="ml-1 text-amber-600">
                          （{SCHOOL_LEVEL_LABELS[school.level]}）
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-amber-700">
                    許多私立學校是一貫制，教育部名錄只登錄其中一個級別。
                    孩子若就讀的是這所學校的
                    {SCHOOL_LEVEL_LABELS[value.level]}部，請用下面的
                    「找不到我的學校」填寫校名。
                  </p>
                </li>
              )}
              {/* 這個出口是必要的：實驗教育機構、境外臺校不在教育部名錄裡，
                  沒有出口這些家長會完全無法完成報名 */}
              <li className="border-t border-slate-100">
                <button
                  type="button"
                  onClick={enterManualMode}
                  className="w-full px-4 py-3 text-left text-sm text-brand-600 transition hover:bg-brand-50"
                >
                  找不到我的學校
                </button>
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function SelectedSchool({ school, onClear }: { school: School; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-brand-500 bg-brand-50 px-4 py-3">
      <div>
        <p className="font-medium text-slate-900">{school.name}</p>
        <p className="text-sm text-slate-500">{school.city}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="清除已選學校"
        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ManualInput({
  value,
  onChange,
  onCancel,
}: {
  value: string;
  onChange: (text: string) => void;
  onCancel: () => void;
}) {
  /*
    這裡刻意不直接用 value prop 當輸入框的受控值。呼叫端（例如報名表頁面）
    的 onChange 通常要等下一輪 re-render 才會把新值傳回來，若輸入框完全
    綁死 value prop，兩次 keystroke 之間值還沒回傳，畫面就會把使用者剛打的
    字吃掉。改用本地狀態累積文字驅動輸入框顯示。

    但這不代表外部值的「後續變化」可以放著不管：編輯既有報名時，父層常常
    是非同步把校名餵進來（掛載完才 resolve），這時要讓本地狀態跟著外部
    value 更新一次，家長原本填的自由文字校名才補得回來顯示。
  */
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <label
        htmlFor="school-manual"
        className="block text-sm font-medium text-slate-700"
      >
        請填寫學校全名
      </label>
      <input
        id="school-manual"
        type="text"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          onChange(event.target.value);
        }}
        placeholder="例如：臺北市某某實驗教育機構"
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      <p className="mt-2 text-xs text-amber-700">
        我們會人工確認這所學校，可能會與您聯繫確認。
      </p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 text-sm text-brand-600 hover:underline"
      >
        改回從名單中挑選
      </button>
    </div>
  );
}
