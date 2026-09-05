# 개발어 번역소

개발 용어를 정의, 주 사용 예시, 사용 상황, 작동 방식, 태그로 정리하는 로컬 웹 앱입니다. 같은 용어를 다시 등록하면 별도 행을 만들지 않고 `occurrence_count`를 올리며, 원문 등록 이력은 `term_occurrences`에 남깁니다.

## 실행

Node.js 22.5 이상에서 다음 명령을 실행합니다.

```powershell
cd C:\protocol-extreme\glossary
npm run seed
npm start
```

브라우저에서 `http://127.0.0.1:4173`을 엽니다.

## Netlify 배포

저장소를 Netlify에 연결하면 루트의 `netlify.toml`이 `public/index.html`을 진입점으로 사용합니다. `npm run build`가 SQLite 내용을 `public/data/terms.json`으로 내보내므로 공개 페이지에서는 별도 DB 서버 없이 읽을 수 있습니다. 상세 주소도 `_redirects`를 통해 같은 진입점으로 연결됩니다.

## 데이터 구조

- `terms`: 용어와 설명 본문, 누적 등장 횟수
- `tags`: 재사용 가능한 태그
- `term_tags`: 용어와 태그의 다대다 관계
- `term_occurrences`: 같은 용어가 다시 들어온 시점과 원문 이력

DB 파일은 `db/glossary.sqlite`에 만들어지며 Git에는 포함하지 않습니다. 배포 시에는 같은 관계 구조를 Cloudflare D1 또는 PostgreSQL로 이전할 수 있습니다.
