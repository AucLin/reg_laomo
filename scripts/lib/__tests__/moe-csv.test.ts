import { describe, it, expect } from 'vitest';
import { stripBracketPrefix, parseMoeCsv } from '../moe-csv';

describe('stripBracketPrefix', () => {
  it('剝除縣市代碼前綴', () => {
    expect(stripBracketPrefix('[01]新北市')).toBe('新北市');
  });

  it('剝除地址的郵遞區號前綴', () => {
    expect(stripBracketPrefix('[234]新北市永和區福和路125巷20號')).toBe(
      '新北市永和區福和路125巷20號'
    );
  });

  it('沒有前綴時原樣回傳', () => {
    expect(stripBracketPrefix('臺北市')).toBe('臺北市');
  });

  it('去除前後空白', () => {
    expect(stripBracketPrefix('  [01]新北市  ')).toBe('新北市');
  });
});

describe('parseMoeCsv', () => {
  // 國小檔有 8 欄，第一欄是學年度
  const elementaryCsv =
    '﻿"學年度","代碼","學校名稱","公/私立","縣市名稱","地址","電話","網址"\n' +
    '114,011601,私立育才國小,私立,[01]新北市,[234]新北市永和區福和路125巷20號,(02)29214630,https://www.ytes.ntpc.edu.tw\n';

  // 國中檔只有 7 欄，沒有學年度
  const juniorCsv =
    '﻿代碼,學校名稱,公/私立,縣市名稱,地址,電話,網址\n' +
    '014601,臺北市立中正國中,公立,[30]臺北市,[100]臺北市中正區愛國東路158號,(02)23913463,https://www.ccjhs.tp.edu.tw\n';

  // 高中職檔有 9 欄，比國小多一欄備註
  const seniorCsv =
    '﻿學年度,代碼,學校名稱,公/私立,縣市名稱,地址,電話,網址,備註\n' +
    '114,011301,臺北市立建國高級中學,公立,[30]臺北市,[100]臺北市中正區南海路56號,(02)23034381,https://www.ck.tp.edu.tw,\n';

  it('解析國小檔（8 欄，第一欄為學年度）', () => {
    const result = parseMoeCsv(elementaryCsv, 'elementary');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      code: '011601',
      name: '私立育才國小',
      level: 'elementary',
      city: '新北市',
      address: '新北市永和區福和路125巷20號',
      phone: '(02)29214630',
    });
  });

  it('解析國中檔（7 欄，沒有學年度欄）', () => {
    const result = parseMoeCsv(juniorCsv, 'junior');
    expect(result[0].code).toBe('014601');
    expect(result[0].name).toBe('臺北市立中正國中');
    // 這是最關鍵的一條：國中檔少一欄，用國小的欄位位置會把地址誤當成縣市
    expect(result[0].city).toBe('臺北市');
    expect(result[0].address).toBe('臺北市中正區愛國東路158號');
  });

  it('解析高中職檔（9 欄，多一欄備註）', () => {
    const result = parseMoeCsv(seniorCsv, 'senior');
    expect(result[0].name).toBe('臺北市立建國高級中學');
    expect(result[0].city).toBe('臺北市');
    expect(result[0].level).toBe('senior');
  });

  it('去除位元組順序記號（BOM）不讓它污染第一個欄位', () => {
    const result = parseMoeCsv(elementaryCsv, 'elementary');
    expect(result[0].code).not.toContain('﻿');
  });

  it('跳過空白行', () => {
    const withBlank = elementaryCsv + '\n   \n';
    expect(parseMoeCsv(withBlank, 'elementary')).toHaveLength(1);
  });

  it('跳過缺少代碼或校名的資料列', () => {
    const broken = elementaryCsv + '114,,,私立,[01]新北市,地址,電話,網址\n';
    expect(parseMoeCsv(broken, 'elementary')).toHaveLength(1);
  });

  it('處理欄位被雙引號包住且內含逗號的情形', () => {
    const quoted =
      '﻿"學年度","代碼","學校名稱","公/私立","縣市名稱","地址","電話","網址"\n' +
      '114,"012345","測試國小","公立","[01]新北市","新北市板橋區文化路一段1號, 2樓","(02)11112222",""\n';
    const result = parseMoeCsv(quoted, 'elementary');
    expect(result[0].address).toBe('新北市板橋區文化路一段1號, 2樓');
  });
});
