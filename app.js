let questions = [];
let currentPage = 1;
let questionsPerPage = 1;
let userAnswers = [];
let revealedAnswers = [];
const STORAGE_KEY = 'quiz-progress-v1';
let totalQuestions = 'all'; // 'all' or a number
const TOTAL_QUESTIONS_KEY = 'quiz-total-questions';

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: parseInt(params.get('page')) || 1,
    perPage: parseInt(params.get('perPage')) || 1
  };
}

function setUrlParams(page, perPage) {
  const params = new URLSearchParams(window.location.search);
  params.set('page', page);
  params.set('perPage', perPage);
  history.replaceState(null, '', '?' + params.toString());
}

function saveProgress() {
  const data = {
    userAnswers,
    revealedAnswers,
    currentPage,
    questionsPerPage
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed.userAnswers)) userAnswers = parsed.userAnswers;
    if (Array.isArray(parsed.revealedAnswers)) revealedAnswers = parsed.revealedAnswers;
    if (typeof parsed.currentPage === 'number') currentPage = parsed.currentPage;
    if (typeof parsed.questionsPerPage === 'number') questionsPerPage = parsed.questionsPerPage;
  } catch {}
}

function saveTotalQuestionsSetting() {
  localStorage.setItem(TOTAL_QUESTIONS_KEY, totalQuestions);
}

function loadTotalQuestionsSetting() {
  const val = localStorage.getItem(TOTAL_QUESTIONS_KEY);
  if (val) totalQuestions = val;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Load questions from JSON file
fetch('saa-c03-questions.json')
  .then(res => res.json())
  .then(data => {
    loadTotalQuestionsSetting();
    questions = data.filter(q => q.question && Object.keys(q.options).length > 0);
    if (totalQuestions !== 'all') {
      const n = parseInt(totalQuestions);
      if (!isNaN(n) && n > 0 && n < questions.length) {
        shuffleArray(questions);
        questions = questions.slice(0, n);
      }
    }
    userAnswers = Array(questions.length).fill(null);
    revealedAnswers = Array(questions.length).fill(false);
    loadProgress();
    // Only override from URL if present in the URL (not just default 1)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('page')) currentPage = parseInt(urlParams.get('page')) || 1;
    if (urlParams.has('perPage')) questionsPerPage = parseInt(urlParams.get('perPage')) || 1;
    document.getElementById('questions-per-page').value = questionsPerPage;
    document.getElementById('total-questions').value = totalQuestions;
    setUrlParams(currentPage, questionsPerPage); // keep URL in sync with restored state
    renderQuestions();
    updateButtons();
    updateProgress();
  });

document.getElementById('questions-per-page').addEventListener('change', (e) => {
  questionsPerPage = parseInt(e.target.value);
  currentPage = 1;
  setUrlParams(currentPage, questionsPerPage);
  saveProgress();
  renderQuestions();
  updateButtons();
  updateProgress();
});

document.getElementById('total-questions').addEventListener('change', (e) => {
  totalQuestions = e.target.value;
  saveTotalQuestionsSetting();
  // reload page to reinitialize quiz with new total
  window.location.reload();
});

function renderQuestions() {
  const start = (currentPage - 1) * questionsPerPage;
  const end = Math.min(start + questionsPerPage, questions.length);
  let html = '';
  for (let i = start; i < end; i++) {
    const q = questions[i];
    html += `<div class="mb-3"><span class="badge bg-primary">Question ${q.enumeration} of ${questions.length}</span></div>`;
    html += `<h5 class="mb-3">${q.question}</h5><form id="options-form-${i}">`;
    for (const [key, value] of Object.entries(q.options)) {
      let optionClass = '';
      let labelClass = '';
      if (revealedAnswers[i]) {
        if (q.correct && q.correct.includes(key)) {
          optionClass = 'border-success';
          labelClass = 'text-success fw-bold';
        }
        if (userAnswers[i] === key && !q.correct.includes(key)) {
          optionClass = 'border-danger';
          labelClass = 'text-danger fw-bold';
        }
        if (userAnswers[i] === key && q.correct.includes(key)) {
          optionClass = 'border-success';
          labelClass = 'text-success fw-bold';
        }
      }
      html += `<div class="form-check mb-2 ${optionClass}" style="border:1.5px solid transparent; border-radius:6px; padding:4px;${optionClass ? (optionClass==='border-success'?'border-color:#198754;':'border-color:#dc3545;') : ''}">
        <input class="form-check-input" type="radio" name="option${i}" id="opt${i}${key}" value="${key}" ${userAnswers[i]===key?'checked':''} ${revealedAnswers[i]?'disabled':''}>
        <label class="form-check-label ${labelClass}" for="opt${i}${key}"><b>${key}.</b> ${value}</label>
      </div>`;
    }
    html += '</form>';
    html += `<button class="btn btn-outline-info btn-sm mt-2 mb-3" type="button" onclick="revealAnswer(${i})" ${revealedAnswers[i]?'disabled':''}>Reveal Answer</button>`;
    if (revealedAnswers[i]) {
      html += `<div class="alert alert-warning py-2">Correct answer: <b>${(q.correct||[]).join(', ')}</b></div>`;
    }
    html += '<hr/>';
  }
  document.getElementById('quiz-container').innerHTML = html;
  document.getElementById('result-container').innerHTML = '';
  updatePageIndicator();
  saveProgress();
  // Add event listeners for answer selection if not revealed
  for (let i = start; i < end; i++) {
    if (!revealedAnswers[i]) {
      const form = document.getElementById(`options-form-${i}`);
      if (form) {
        form.addEventListener('change', (e) => {
          if (e.target && e.target.name === `option${i}`) {
            userAnswers[i] = e.target.value;
            saveProgress();
          }
        });
      }
    }
  }
}

window.revealAnswer = function(idx) {
  revealedAnswers[idx] = true;
  saveProgress();
  renderQuestions();
};

function updateButtons() {
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  document.getElementById('prev-btn').disabled = currentPage === 1;
  document.getElementById('next-btn').classList.toggle('d-none', currentPage === totalPages);
  document.getElementById('submit-btn').classList.toggle('d-none', currentPage !== totalPages);
}

function updateProgress() {
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const percent = Math.round((currentPage/totalPages)*100);
  const bar = document.getElementById('progress-bar');
  bar.style.width = percent + '%';
  bar.textContent = percent + '%';
}

function updatePageIndicator() {
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  document.getElementById('page-indicator').textContent = `Page ${currentPage} of ${totalPages}`;
}

document.getElementById('prev-btn').onclick = () => {
  saveAnswersOnPage();
  if (currentPage > 1) currentPage--;
  setUrlParams(currentPage, questionsPerPage);
  saveProgress();
  renderQuestions();
  updateButtons();
  updateProgress();
};
document.getElementById('next-btn').onclick = () => {
  saveAnswersOnPage();
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  if (currentPage < totalPages) currentPage++;
  setUrlParams(currentPage, questionsPerPage);
  saveProgress();
  renderQuestions();
  updateButtons();
  updateProgress();
};
document.getElementById('submit-btn').onclick = () => {
  saveAnswersOnPage();
  saveProgress();
  showResult();
};
function saveAnswersOnPage() {
  const start = (currentPage - 1) * questionsPerPage;
  const end = Math.min(start + questionsPerPage, questions.length);
  for (let i = start; i < end; i++) {
    const form = document.getElementById(`options-form-${i}`);
    if (!form) continue;
    const selected = form[`option${i}`] ? form[`option${i}`].value : null;
    userAnswers[i] = selected;
  }
}

function showResult() {
  let correct = 0;
  let review = '';
  questions.forEach((q, i) => {
    const user = userAnswers[i];
    const isCorrect = user && q.correct && q.correct.includes(user);
    if (isCorrect) correct++;
    review += `<div class="card mb-3 ${isCorrect ? 'border-success' : 'border-danger'}">
      <div class="card-body">
        <div class="mb-2"><span class="badge bg-secondary">Q${q.enumeration}</span> ${q.question}</div>
        <div>Your answer: <b>${user || 'None'}</b> ${isCorrect ? '<span class=\'text-success\'>✅</span>' : '<span class=\'text-danger\'>❌</span>'}</div>
        <div>Correct answer: <b>${(q.correct||[]).join(', ')}</b></div>
      </div>
    </div>`;
  });
  document.getElementById('result-container').innerHTML = `<div class="alert alert-info text-center">You scored <b>${correct}</b> out of <b>${questions.length}</b></div>${review}`;
  document.getElementById('quiz-container').innerHTML = '';
  document.getElementById('prev-btn').disabled = true;
  document.getElementById('next-btn').classList.add('d-none');
  document.getElementById('submit-btn').classList.add('d-none');
  document.getElementById('progress-bar').style.width = '100%';
  document.getElementById('progress-bar').textContent = '100%';
}

// Add Bootstrap modal for reset confirmation
if (!document.getElementById('resetModal')) {
  const modalHtml = `
  <div class="modal fade" id="resetModal" tabindex="-1" aria-labelledby="resetModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header bg-danger text-white">
          <h5 class="modal-title" id="resetModalLabel">Reset Progress</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="alert alert-danger mb-0">
            <strong>Are you sure?</strong> This will erase all your answers and progress. This action cannot be undone.
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-reset-btn">Yes, Reset</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

document.getElementById('reset-btn').onclick = () => {
  const modal = new bootstrap.Modal(document.getElementById('resetModal'));
  modal.show();
};

document.getElementById('confirm-reset-btn').onclick = () => {
  localStorage.removeItem(STORAGE_KEY);
  userAnswers = Array(questions.length).fill(null);
  revealedAnswers = Array(questions.length).fill(false);
  currentPage = 1;
  questionsPerPage = 1;
  totalQuestions = 'all';
  setUrlParams(currentPage, questionsPerPage);
  document.getElementById('questions-per-page').value = questionsPerPage;
  document.getElementById('total-questions').value = totalQuestions;
  renderQuestions();
  updateButtons();
  updateProgress();
  const modal = bootstrap.Modal.getInstance(document.getElementById('resetModal'));
  modal.hide();
};
