import { describe, it, expect } from 'vitest';
import { avatarInitial, avatarTone } from '../studentAvatar';

describe('avatarInitial', () => {
  it('中文三字名取後兩字，不取姓', () => {
    // 兄弟姊妹的姓一定一樣，取姓等於沒取
    expect(avatarInitial('林小明')).toBe('小明');
  });

  it('中文兩字名取最後一字', () => {
    expect(avatarInitial('林帥')).toBe('帥');
  });

  it('複姓長名一樣只取最後兩字', () => {
    expect(avatarInitial('歐陽宥辰')).toBe('宥辰');
  });

  /* 測試資料是「測試學生01」這種，能分出人的正好是尾巴的編號 */
  it('名字帶編號時取得到編號', () => {
    expect(avatarInitial('測試學生01')).toBe('01');
    expect(avatarInitial('測試學生02')).toBe('02');
  });

  it('英文名反過來取前兩個字母，並轉大寫', () => {
    expect(avatarInitial('kevin')).toBe('KE');
  });

  it('前後有空白時先去掉', () => {
    expect(avatarInitial('  林小明 ')).toBe('小明');
  });

  it('空字串不會回傳空的圈圈', () => {
    expect(avatarInitial('   ')).toBe('？');
  });
});

describe('avatarTone', () => {
  it('同一個名字永遠同一個顏色', () => {
    expect(avatarTone('林小明')).toBe(avatarTone('林小明'));
  });

  /*
    只差一個字的名字要分得出來 —— 這正是家長最容易看錯的情況。
  */
  it('只差一個字的名字拿到不同顏色', () => {
    expect(avatarTone('測試學生01')).not.toBe(avatarTone('測試學生02'));
  });

  it('回傳的是成對的底色與字色', () => {
    expect(avatarTone('林小明')).toMatch(/^bg-\S+ text-\S+$/);
  });
});
