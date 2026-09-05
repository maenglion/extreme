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
            <h3>${escapeHtml(term.name)}</h3>
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
      </div>
    </article>`;
}

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
