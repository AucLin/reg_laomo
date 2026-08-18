import { describe, it, expect } from 'vitest';
import { normalizeSchoolKeyword } from '../schoolKeyword';

/*
  每一條都是家長真的會打出來的字。這支函式的規則必須跟資料庫的
  search_name 產生欄位對得起來，那邊做的是「臺→台、去空白」。
*/
describe('normalizeSchoolKeyword', () => {
  it('臺一律換成台，名錄那端也是這樣存的', () => {
    expect(normalizeSchoolKeyword('臺北教大實小')).toBe('台北教大實小');
  });

  it('去掉空白，含全形空白', () => {
    expect(normalizeSchoolKeyword('光復 國小')).toBe('光復國小');
    expect(normalizeSchoolKeyword('光復　國小')).toBe('光復國小');
  });

  /*
    校名裡沒有縣市（名錄是「市立光復國小」），家長卻很自然會連縣市一起打。
    剝掉之後剩下的仍是校名的子字串，模糊比對就找得到。
  */
  it('剝掉開頭的縣市名', () => {
    expect(normalizeSchoolKeyword('台北市光復國小')).toBe('光復國小');
    expect(normalizeSchoolKeyword('臺北市立光復國小')).toBe('立光復國小');
    expect(normalizeSchoolKeyword('桃園市立會稽國小')).toBe('立會稽國小');
  });

  it('只剝開頭，校名中間的縣市字不動', () => {
    expect(normalizeSchoolKeyword('市立台中國小')).toBe('市立台中國小');
  });

  /*
    「台中國小」把「台中」當縣市剝掉會只剩「國小」，兩千多所國小全部
    跳出來。所以只認完整的縣市名，不認兩個字的簡稱。
  */
  it('兩個字的縣市簡稱不算縣市，不剝', () => {
    expect(normalizeSchoolKeyword('台中國小')).toBe('台中國小');
    expect(normalizeSchoolKeyword('台西國小')).toBe('台西國小');
  });

  it('剝完剩不到兩個字就不剝，避免變成搜全部', () => {
    expect(normalizeSchoolKeyword('台北市')).toBe('台北市');
    expect(normalizeSchoolKeyword('新北市')).toBe('新北市');
  });

  it('全稱換成名錄用的簡稱', () => {
    expect(normalizeSchoolKeyword('光復國民小學')).toBe('光復國小');
    expect(normalizeSchoolKeyword('中正國民中學')).toBe('中正國中');
    expect(normalizeSchoolKeyword('泰北高級中學')).toBe('泰北高中');
  });

  it('原本就正確的關鍵字不動它', () => {
    expect(normalizeSchoolKeyword('康橋')).toBe('康橋');
    expect(normalizeSchoolKeyword('市立光復國小')).toBe('市立光復國小');
  });

  it('空字串與純空白回空字串，呼叫端才判斷得出「還沒開始打字」', () => {
    expect(normalizeSchoolKeyword('')).toBe('');
    expect(normalizeSchoolKeyword('   ')).toBe('');
  });
});
