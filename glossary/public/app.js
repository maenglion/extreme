const list = document.querySelector('#term-list');
const termCount = document.querySelector('#term-count');
const mentionCount = document.querySelector('#mention-count');

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function renderTerm(term, index) {
  const tags = term.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  return `
    <article class="term-card">
      <div class="term-index">${String(index + 1).padStart(2, '0')}</div>
      <div class="term-body">
        <div class="term-title-row">
          <div>
            <h3><a href="/terms/${term.id}">${escapeHtml(term.name)}</a></h3>
            <div class="tags" aria-label="태그">${tags}</div>
          </div>
          <div class="frequency" title="이 용어가 입력된 횟수">
            <strong>${term.occurrenceCount}</strong><span>번 만남</span>
          </div>
        </div>
        <p class="definition">${escapeHtml(term.definition)}</p>
        <dl class="term-details">
          <div>
            <dt><span>01</span> 주 사용 예시</dt>
            <dd>${escapeHtml(term.primaryExample)}</dd>
          </div>
          <div>
            <dt><span>02</span> 사용 상황</dt>
            <dd>${escapeHtml(term.usageContext)}</dd>
          </div>
          <div>
            <dt><span>03</span> 작동 방식</dt>
            <dd>${escapeHtml(term.mechanism)}</dd>
          </div>
        </dl>
        ${term.hasLesson ? `<a class="deep-link" href="/terms/${term.id}">로직으로 더 깊이 이해하기 <span aria-hidden="true">→</span></a>` : ''}
      </div>
    </article>`;
}

function loadCatalog() {
  fetch('/api/terms')
  .then((response) => {
    if (!response.ok) throw new Error('용어를 불러오지 못했습니다.');
    return response.json();
  })
  .then(({ terms }) => {
    termCount.textContent = terms.length;
    mentionCount.textContent = terms.reduce((sum, term) => sum + term.occurrenceCount, 0);
    list.innerHTML = terms.length
      ? terms.map(renderTerm).join('')
      : '<p class="empty">아직 등록된 용어가 없습니다.</p>';
  })
  .catch((error) => {
    list.innerHTML = `<p class="error">${escapeHtml(error.message)} 서버를 다시 실행해 주세요.</p>`;
  });
}

function renderDetail(term) {
  const lesson = term.lesson;
  document.title = `${term.name} — 개발어 번역소`;
  document.querySelector('#intro').hidden = true;
  document.querySelector('#catalog').hidden = true;
  const detail = document.querySelector('#detail');
  detail.hidden = false;
  const tags = term.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  const steps = lesson?.logicSteps.map((step, index) => `
    <li><span>${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(step)}</p></li>`).join('') || '';
  const related = lesson?.relatedTerms.map((name) => `<span>${escapeHtml(name)}</span>`).join('') || '';

  detail.innerHTML = `
    <a class="back-link" href="/">← 전체 용어로</a>
    <article class="lesson">
      <header class="lesson-header">
        <div>
          <p class="eyebrow">DEEP DIVE · ${String(term.id).padStart(3, '0')}</p>
          <h1>${escapeHtml(term.name)}</h1>
          <div class="tags">${tags}</div>
        </div>
        <div class="frequency"><strong>${term.occurrenceCount}</strong><span>번 만남</span></div>
      </header>
      <p class="lesson-definition">${escapeHtml(term.definition)}</p>
      ${lesson ? `
        <section class="memory-hook">
          <span>한 줄 기억법</span>
          <strong>${escapeHtml(lesson.memoryHook)}</strong>
        </section>
        <section class="lesson-section two-column">
          <div><p class="section-number">01 · WHY</p><h2>왜 필요한가</h2></div>
          <p>${escapeHtml(lesson.whyItMatters)}</p>
        </section>
        <section class="lesson-section">
          <p class="section-number">02 · LOGIC TREE</p>
          <h2>머릿속 작동 순서</h2>
          <ol class="logic-steps">${steps}</ol>
        </section>
        <section class="lesson-section two-column caution">
          <div><p class="section-number">03 · CAUTION</p><h2>헷갈리기 쉬운 지점</h2></div>
          <p>${escapeHtml(lesson.commonMistake)}</p>
        </section>
        <section class="related"><span>함께 연결할 용어</span><div>${related}</div></section>
      ` : ''}
      <section class="lesson-section source-grid">
        <div><h2>주 사용 예시</h2><p>${escapeHtml(term.primaryExample)}</p></div>
        <div><h2>사용 상황</h2><p>${escapeHtml(term.usageContext)}</p></div>
        <div><h2>작동 방식</h2><p>${escapeHtml(term.mechanism)}</p></div>
      </section>
    </article>`;
}

const detailMatch = location.pathname.match(/^\/terms\/(\d+)$/);
if (detailMatch) {
  fetch(`/api/terms/${detailMatch[1]}`)
    .then((response) => {
      if (!response.ok) throw new Error('해당 용어를 찾지 못했습니다.');
      return response.json();
    })
    .then(({ term }) => renderDetail(term))
    .catch((error) => {
      const detail = document.querySelector('#detail');
      document.querySelector('#intro').hidden = true;
      document.querySelector('#catalog').hidden = true;
      detail.hidden = false;
      detail.innerHTML = `<a class="back-link" href="/">← 전체 용어로</a><p class="error">${escapeHtml(error.message)}</p>`;
    });
} else {
  loadCatalog();
}
