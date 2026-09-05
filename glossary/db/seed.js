import { openGlossary, upsertTerm } from './glossary.js';

const db = openGlossary();

const terms = [
  {
    name: '복합 인덱스',
    definition: '두 개 이상의 컬럼을 정해진 순서로 묶어 만든 데이터베이스 인덱스. 여러 조건을 함께 사용하는 조회에서 탐색해야 할 행의 범위를 줄인다.',
    primaryExample: '현행불명 규정을 찾는 조회가 currency_status와 currency_reason_code를 함께 조건으로 사용한다면 (currency_status, currency_reason_code) 순서의 복합 인덱스를 검토한다.',
    usageContext: '목록 필터, 정합성 검증, 근거 문서 역추적처럼 WHERE·JOIN·ORDER BY에서 같은 컬럼 조합이 반복되는 상황에 사용한다.',
    mechanism: 'B-Tree가 첫 번째 컬럼부터 정렬된 키를 저장한다. 따라서 (A, B) 인덱스는 A 또는 A+B 조건에 유리하지만 B만 조회할 때는 보통 온전히 활용되지 않는다. 실제 쿼리와 EXPLAIN 결과를 기준으로 컬럼 순서를 정하고, 중복 매핑이 허용되면 UNIQUE가 아닌 일반 인덱스로 만든다.',
    tags: ['DB', 'SQL', '인덱스', '성능', '데이터 모델링'],
    sourceKey: 'initial-composite-index-2026-09-05',
    sourceText: 'currency_status, currency_reason_code, basis_document_sha 조합의 복합 인덱스 설계 메모'
  },
  {
    name: 'B-Tree 인덱스',
    definition: '키를 정렬된 균형 트리 구조로 관리하는 관계형 데이터베이스의 대표적인 인덱스 방식. 원하는 키를 찾은 뒤 해당 행의 위치로 빠르게 이동한다.',
    primaryExample: 'user_id에 B-Tree 인덱스가 있으면 DB는 전체 사용자 테이블을 읽지 않고 트리에서 해당 ID를 찾아 행으로 이동한다.',
    usageContext: '일치 조건(=), 범위 조건(<, >, BETWEEN), 정렬(ORDER BY), 접두 컬럼 조건을 빠르게 처리할 때 주로 사용한다.',
    mechanism: '루트·중간·리프 노드를 따라 검색 범위를 단계적으로 좁힌다. 리프에는 키와 행 위치 또는 실제 레코드가 정렬되어 있다. 소수 행 조회에는 빠르지만 많은 행을 각각 가져오면 랜덤 I/O가 누적되어 순차 읽기보다 불리할 수 있다.',
    tags: ['DB', '인덱스', 'B-Tree', '자료구조', '성능'],
    sourceKey: 'b-tree-index-2026-09-05',
    sourceText: 'B-Tree 인덱스는 정렬된 트리 구조로 키와 행 위치를 관리하며 소수 레코드 조회에 빠르다는 학습 메모'
  },
  {
    name: '선택도',
    definition: '쿼리 조건을 적용했을 때 전체 행 중 결과로 남는 비율. 결과 비율이 작을수록 조건이 데이터를 잘 좁혀 보통 “선택도가 좋다(높다)”고 표현한다.',
    primaryExample: '100만 행에서 user_id 조건으로 1행만 찾으면 결과 비율은 0.0001%라 인덱스 효율이 높다. 상태 코드 조건으로 30만 행이 나오면 인덱스 이점이 작아질 수 있다.',
    usageContext: '어떤 컬럼에 인덱스를 만들지, 옵티마이저가 인덱스 스캔과 풀 스캔 중 무엇을 선택할지 판단할 때 사용한다.',
    mechanism: '개념적으로 결과 행 수 ÷ 전체 행 수로 본다. 값이 균등 분포라면 한 값의 예상 결과 비율을 1 ÷ 카디널리티로 근사할 수 있지만, 실제 데이터가 치우쳐 있으면 통계와 값별 분포를 함께 봐야 한다.',
    tags: ['DB', 'SQL', '쿼리 튜닝', '통계', '성능'],
    sourceKey: 'selectivity-2026-09-05',
    sourceText: '선택도는 특정 조건이 전체 데이터 중 얼마를 반환하는지를 나타내며 카디널리티와 관련된다는 학습 메모'
  },
  {
    name: '옵티마이저',
    definition: 'SQL을 실행하기 전에 가능한 처리 경로의 비용을 비교하고 실행 계획을 결정하는 데이터베이스 내부 구성요소.',
    primaryExample: '같은 SELECT문이라도 데이터 통계를 바탕으로 인덱스 스캔, 풀 스캔, 조인 순서와 조인 방식을 선택한다.',
    usageContext: '쿼리가 예상보다 느리거나 만든 인덱스를 사용하지 않을 때 실행 계획과 함께 옵티마이저의 선택을 분석한다.',
    mechanism: '테이블·인덱스 통계, 예상 행 수, I/O와 CPU 비용을 사용해 후보 실행 계획을 평가한다. 가장 낮다고 추정한 비용의 계획을 고르지만 통계가 오래되거나 데이터 분포가 치우치면 실제 최적 경로와 달라질 수 있다.',
    tags: ['DB', 'SQL', '실행 계획', '쿼리 튜닝', '성능'],
    sourceKey: 'optimizer-2026-09-05',
    sourceText: '옵티마이저는 SQL 실행 전 디스크 I/O와 CPU 비용을 추정해 실행 계획을 고른다는 학습 메모'
  },
  {
    name: '풀 테이블 스캔',
    definition: '특정 인덱스로 일부만 찾지 않고 테이블의 데이터 블록 전체를 처음부터 끝까지 읽어 조건에 맞는 행을 찾는 방식.',
    primaryExample: '전체 행의 40%를 반환하는 상태 코드 조회라면 많은 행을 인덱스로 각각 찾는 것보다 테이블 전체를 순차적으로 읽는 편이 빠를 수 있다.',
    usageContext: '인덱스가 없거나, 조건이 많은 행을 반환하거나, 옵티마이저가 전체 순차 읽기의 비용이 더 낮다고 판단할 때 발생한다.',
    mechanism: '저장된 블록을 순차적으로 읽으며 각 행에 조건을 적용한다. 읽는 행 수는 많지만 연속적인 I/O와 단순한 접근 패턴 덕분에 대량 조회에서는 랜덤 I/O 중심의 인덱스 접근보다 효율적일 수 있다.',
    tags: ['DB', 'SQL', '풀 스캔', 'I/O', '성능'],
    sourceKey: 'full-table-scan-2026-09-05',
    sourceText: '풀 스캔은 인덱스를 타지 않고 테이블 전체 블록을 순차적으로 읽는다는 학습 메모'
  },
  {
    name: '카디널리티',
    definition: 'DB 성능 문맥에서는 컬럼의 중복 없는 고유값 개수를 뜻한다. 데이터 모델링 문맥에서는 두 엔터티 사이에서 연결 가능한 행의 수, 즉 1:1·1:N·N:M 같은 관계 차수를 뜻한다.',
    primaryExample: '100만 개의 서로 다른 user_id는 높은 카디널리티를 갖고, Y/N 상태 컬럼은 고유값이 2개라 낮은 카디널리티를 갖는다. ERD에서는 규정 1개와 개정이력 여러 개를 1:N 관계로 표시한다.',
    usageContext: '인덱스 후보의 변별력을 추정하거나 컬럼 통계를 설명할 때, 그리고 ERD에서 테이블 간 관계를 설계할 때 사용한다. 같은 단어이므로 문맥을 먼저 확인해야 한다.',
    mechanism: '고유값이 많을수록 특정 값 하나가 가리키는 평균 행 수가 줄어드는 경향이 있다. 균등 분포라면 한 값의 예상 결과 비율은 대략 1 ÷ 고유값 수지만, 실제 선택도는 NULL·편향·인기 값 분포에 따라 달라진다. ERD에서는 각 방향의 최소·최대 연결 수로 관계를 표현한다.',
    tags: ['DB', '데이터 모델링', 'ERD', '인덱스', '통계'],
    sourceKey: 'cardinality-2026-09-05',
    sourceText: '카디널리티의 인덱스 튜닝 의미와 ERD 관계 차수 의미를 함께 설명한 학습 메모'
  }
];

for (const term of terms) upsertTerm(db, term);

db.close();
console.log('Glossary database is ready.');
