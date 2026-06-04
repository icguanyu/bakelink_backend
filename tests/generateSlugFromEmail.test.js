const { generateSlugFromEmail } = require('../src/controllers/authController');

test('一般 email 轉成小寫 slug', () => {
  expect(generateSlugFromEmail('hello@gmail.com')).toBe('hello');
});

test('大寫字母要轉小寫', () => {
  expect(generateSlugFromEmail('Hello@gmail.com')).toBe('hello');
});

test('點號要轉成破折號', () => {
  expect(generateSlugFromEmail('Hello.World@gmail.com')).toBe('hello-world');
});

test('連續特殊符號要合併成一個破折號', () => {
  expect(generateSlugFromEmail('hello..world@gmail.com')).toBe('hello-world');
});

test('slug 太短（不足 3 字）要補零', () => {
  expect(generateSlugFromEmail('a@gmail.com')).toBe('a00');
});

test('slug 超過 50 字要截斷', () => {
  const longEmail = 'a'.repeat(60) + '@gmail.com';
  expect(generateSlugFromEmail(longEmail).length).toBeLessThanOrEqual(50);
});
