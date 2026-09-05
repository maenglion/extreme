import assert from 'node:assert/strict';
import test from 'node:test';
import { listTerms, openGlossary, upsertTerm } from '../db/glossary.js';

const fixture = {
  name: 'API',
  definition: '프로그램끼리 기능과 데이터를 주고받는 약속',
  primaryExample: '화면에서 서버의 용어 목록을 요청한다.',
  usageContext: '서로 다른 프로그램을 연결할 때',
  mechanism: '정해진 주소와 형식으로 요청하고 응답한다.',
  tags: ['백엔드']
};

test('같은 용어를 다시 등록하면 한 행의 횟수만 증가한다', () => {
  const db = openGlossary(':memory:');
  upsertTerm(db, { ...fixture, sourceKey: 'first' });
  upsertTerm(db, { ...fixture, name: '  API  ', sourceKey: 'second' });
  const terms = listTerms(db);
  assert.equal(terms.length, 1);
  assert.equal(terms[0].occurrenceCount, 2);
  assert.deepEqual(terms[0].tags, ['백엔드']);
  db.close();
});

test('같은 출처를 재처리해도 횟수가 중복 증가하지 않는다', () => {
  const db = openGlossary(':memory:');
  upsertTerm(db, { ...fixture, sourceKey: 'same-source' });
  upsertTerm(db, { ...fixture, sourceKey: 'same-source' });
  assert.equal(listTerms(db)[0].occurrenceCount, 1);
  db.close();
});
