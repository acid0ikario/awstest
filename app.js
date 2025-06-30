/* app.js – refactored, modular, no globals leaking
 * --------------------------------------------------
 * • Fix: refreshing the page no longer reshuffles the
 *   questions.  The initial shuffle happens **only**
 *   when no saved progress exists.  The exact order
 *   is stored in localStorage and restored verbatim
 *   on every reload until the user resets progress.
 */
(() => {
  'use strict';

  /* -------------------- constants -------------------- */
  const STORAGE_KEY          = 'quiz-progress-v1';
  const TOTAL_QUESTIONS_KEY  = 'quiz-total-questions';

  /* -------------------- helpers ---------------------- */
  const qs  = (sel) => document.querySelector(sel);
  const qsa = (sel) => document.querySelectorAll(sel);

  /** Fisher‑Yates shuffle (in‑place) */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /** Re‑order questions according to a stored sequence */
  function reorderQuestions(questions, order) {
    const pos = Object.create(null);
    order.forEach((enumVal, idx) => (pos[enumVal] = idx));
    questions.sort((a, b) => (pos[a.enumeration] ?? 0) - (pos[b.enumeration] ?? 0));
  }

  /** Read ?page=&perPage= params */
  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      page:     parseInt(params.get('page'))    || 1,
      perPage:  parseInt(params.get('perPage')) || 1
    };
  }

  /** Write params back (keeps other params intact) */
  function writeUrlParams(page, perPage) {
    const params = new URLSearchParams(window.location.search);
    params.set('page',    page);
    params.set('perPage', perPage);
    history.replaceState(null, '', `?${params.toString()}`);
  }

  /* --------------------- class ----------------------- */
  class QuizApp {
    constructor() {
      /* -------- cache DOM ---------- */
      this.ui = {
        quizContainer:      qs('#quiz-container'),
        resultContainer:    qs('#result-container'),
        progressBar:        qs('#progress-bar'),
        pageInd:            qs('#page-indicator'),
        perPageSel:         qs('#questions-per-page'),
        totalQuestionsSel:  qs('#total-questions'),
        prevBtn:            qs('#prev-btn'),
        nextBtn:            qs('#next-btn'),
        submitBtn:          qs('#submit-btn'),
        resetBtn:           qs('#reset-btn'),
        resetModal:         null
      };

      /* -------- reactive state ----- */
      this.state = {
        questions:        [],
        answers:          [],   // user selections
        revealed:         [],
        questionOrder:    [],   // persistent order of enumerations
        page:             1,
        perPage:          1,
        totalQuestionsOpt:'all'
      };

      this.bootstrap();
    }

    /* ------------- initialisation bootstrapping -------------- */
    async bootstrap() {
      /* Load persisted settings first (may influence subset) */
      this.loadTotalQuestionsSetting();

      /* URL params override nothing but initialise defaults */
      const url = readUrlParams();
      this.state.page    = url.page;
      this.state.perPage = url.perPage;

      this.ui.perPageSel.value        = this.state.perPage;
      this.ui.totalQuestionsSel.value = this.state.totalQuestionsOpt;

      /* Fetch questions JSON */
      const raw = await fetch('saa-c03-questions.json').then(r => r.json());
      this.state.questions = raw.filter(q => q.question && Object.keys(q.options).length);

      /* Apply total‑questions subset early */
      this.applyTotalQuestionsSubset();

      /* Load persisted progress (includes order) */
      this.loadProgress();

      /* Ensure question order is stable */
      if (this.state.questionOrder.length === this.state.questions.length) {
        reorderQuestions(this.state.questions, this.state.questionOrder);
      } else {
        shuffle(this.state.questions);
        this.state.questionOrder = this.state.questions.map(q => q.enumeration);
      }

      /* Allocate state arrays if first run */
      const len = this.state.questions.length;
      if (this.state.answers.length !== len)  this.state.answers  = Array(len).fill(null);
      if (this.state.revealed.length !== len) this.state.revealed = Array(len).fill(false);

      /* Finalise URL to what we really run with */
      writeUrlParams(this.state.page, this.state.perPage);

      /* UI hooks */
      this.attachEventListeners();
      this.render();
      this.updateNavButtons();
      this.updateProgressBar();
    }

    /* ---------------- persistent settings ------------------- */
    loadTotalQuestionsSetting() {
      const saved = localStorage.getItem(TOTAL_QUESTIONS_KEY);
      if (saved) this.state.totalQuestionsOpt = saved;
    }

    saveTotalQuestionsSetting() {
      localStorage.setItem(TOTAL_QUESTIONS_KEY, this.state.totalQuestionsOpt);
    }

    saveProgress() {
      const { answers, revealed, page, perPage, questionOrder } = this.state;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ answers, revealed, page, perPage, questionOrder })
      );
    }

    loadProgress() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        const { answers, revealed, page, perPage, questionOrder } = JSON.parse(raw);
        if (Array.isArray(answers))      this.state.answers       = answers;
        if (Array.isArray(revealed))     this.state.revealed      = revealed;
        if (Array.isArray(questionOrder))this.state.questionOrder = questionOrder;
        if (page)                        this.state.page          = page;
        if (perPage)                     this.state.perPage       = perPage;
      } catch {/* ignore malformed */}
    }

    /* ------------------- data helpers ----------------------- */
    applyTotalQuestionsSubset() {
      const opt = this.state.totalQuestionsOpt;
      if (opt === 'all') return;
      const n = Number(opt);
      if (Number.isFinite(n) && n > 0 && n < this.state.questions.length) {
        shuffle(this.state.questions);
        this.state.questions = this.state.questions.slice(0, n);
      }
    }

    /* --------------------- rendering ------------------------ */
    render() {
      const { page, perPage, questions, answers, revealed } = this.state;
      const start = (page - 1) * perPage;
      const end   = Math.min(start + perPage, questions.length);

      let html = '';
      for (let i = start; i < end; i++) {
        const q = questions[i];
        html += `
          <div class="mb-3"><span class="badge bg-primary">Question ${q.enumeration} of ${questions.length}</span></div>
          <h5 class="mb-3">${q.question}</h5>
          <form data-idx="${i}" class="options-form">
        `;
        for (const [key, value] of Object.entries(q.options)) {
          const isUser     = answers[i] === key;
          const isCorrect  = (q.correct || []).includes(key);
          const isRevealed = revealed[i];
          let wrapperClass = '';
          let labelClass   = '';
          let styleBorder  = '';
          if (isRevealed) {
            if (isCorrect) {
              wrapperClass = 'border-success';
              labelClass   = 'text-success fw-bold';
              styleBorder  = 'border-color:#198754;';
            }
            if (isUser && !isCorrect) {
              wrapperClass = 'border-danger';
              labelClass   = 'text-danger fw-bold';
              styleBorder  = 'border-color:#dc3545;';
            }
          }
          html += `
            <div class="form-check mb-2 ${wrapperClass}" style="border:1.5px solid transparent;border-radius:6px;padding:4px;${styleBorder}">
              <input class="form-check-input" type="radio" name="option-${i}" id="opt-${i}-${key}" value="${key}" ${isUser ? 'checked' : ''} ${isRevealed ? 'disabled' : ''}>
              <label class="form-check-label ${labelClass}" for="opt-${i}-${key}"><b>${key}.</b> ${value}</label>
            </div>`;
        }
        html += `</form>
          <button class="btn btn-outline-info btn-sm mt-2 mb-3" data-action="reveal" data-idx="${i}" ${revealed[i] ? 'disabled' : ''}>Reveal Answer</button>
        `;
        if (revealed[i]) {
          html += `<div class="alert alert-warning py-2">Correct answer: <b>${(q.correct || []).join(', ')}</b></div>`;
        }
        html += '<hr/>';
      }
      this.ui.quizContainer.innerHTML   = html;
      this.ui.resultContainer.innerHTML = '';
      this.attachQuestionDelegation(start, end);
      this.updatePageIndicator();
      this.saveProgress();
    }

    attachQuestionDelegation(startIdx, endIdx) {
      this.ui.quizContainer.onclick = (e) => {
        const btn  = e.target.closest('[data-action="reveal"]');
        const form = e.target.closest('form.options-form');
        if (btn) {
          const idx = +btn.dataset.idx;
          this.state.revealed[idx] = true;
          this.saveProgress();
          this.render();
          return;
        }
        if (form && e.target.matches('input[type="radio"]')) {
          const idx = +form.dataset.idx;
          this.state.answers[idx] = e.target.value;
          this.saveProgress();
        }
      };
    }

    /* ---------------- navigation / progress --------------- */
    get totalPages() {
      return Math.ceil(this.state.questions.length / this.state.perPage);
    }

    updateNavButtons() {
      this.ui.prevBtn.disabled      = this.state.page === 1;
      this.ui.nextBtn.classList.toggle('d-none', this.state.page === this.totalPages);
      this.ui.submitBtn.classList.toggle('d-none', this.state.page !== this.totalPages);
    }

    updateProgressBar() {
      const percent = Math.round((this.state.page / this.totalPages) * 100);
      this.ui.progressBar.style.width  = `${percent}%`;
      this.ui.progressBar.textContent  = `${percent}%`;
    }

    updatePageIndicator() {
      this.ui.pageInd.textContent = `Page ${this.state.page} of ${this.totalPages}`;
    }

    /* ---------------- event listeners ---------------------- */
    attachEventListeners() {
      this.ui.perPageSel.onchange = (e) => {
        this.state.perPage = parseInt(e.target.value, 10);
        this.state.page    = 1;
        writeUrlParams(this.state.page, this.state.perPage);
        this.render();
        this.updateNavButtons();
        this.updateProgressBar();
      };
      this.ui.totalQuestionsSel.onchange = (e) => {
        this.state.totalQuestionsOpt = e.target.value;
        this.saveTotalQuestionsSetting();
        localStorage.removeItem(STORAGE_KEY);  // start fresh order
        location.reload();
      };
      this.ui.prevBtn.onclick = () => {
        if (this.state.page > 1) {
          this.state.page--;
          writeUrlParams(this.state.page, this.state.perPage);
          this.render();
          this.updateNavButtons();
          this.updateProgressBar();
        }
      };
      this.ui.nextBtn.onclick = () => {
        if (this.state.page < this.totalPages) {
          this.state.page++;
          writeUrlParams(this.state.page, this.state.perPage);
          this.render();
          this.updateNavButtons();
          this.updateProgressBar();
        }
      };
      this.ui.submitBtn.onclick = () => this.showResults();
      this.setupResetModal();
    }

    /* --------------------- results ------------------------- */
    showResults() {
      const { questions, answers } = this.state;
      let correct = 0;
      let review  = '';
      questions.forEach((q, i) => {
        const userAns   = answers[i];
        const isCorrect = userAns && (q.correct || []).includes(userAns);
        if (isCorrect) correct++;
        let opts = '';
        for (const [key, val] of Object.entries(q.options)) {
          const cls = (q.correct || []).includes(key) ? 'text-success fw-bold' : userAns === key ? 'text-danger' : '';
          opts += `<div class="mb-1 ${cls}"><b>${key}.</b> ${val}</div>`;
        }
        const cid = `ans-${i}`;
        review += `
          <div class="card mb-3 ${isCorrect ? 'border-success' : 'border-danger'}">
            <div class="card-body">
              <div class="mb-2"><span class="badge bg-secondary">Q${q.enumeration}</span> ${q.question}</div>
              <div>Your answer: <b>${userAns ?? 'None'}</b> ${isCorrect ? '✅' : '❌'}</div>
              <div>Correct answer: <b>${(q.correct || []).join(', ')}</b></div>
              <button class="btn btn-link p-0 mt-2" data-bs-toggle="collapse" data-bs-target="#${cid}" aria-expanded="false" aria-controls="${cid}">
                <span class="show-text">Show Answer Details</span><span class="hide-text d-none">Hide Answer Details</span>
              </button>
              <div class="collapse mt-2" id="${cid}"><div class="card card-body border-0 p-2">${opts}</div></div>
            </div>
          </div>`;
      });
      this.ui.resultContainer.innerHTML = `<div class="alert alert-info text-center">You scored <b>${correct}</b> out of <b>${questions.length}</b></div>${review}`;
      this.ui.quizContainer.innerHTML   = '';
      this.ui.prevBtn.disabled = true;
      this.ui.nextBtn.classList.add('d-none');
      this.ui.submitBtn.classList.add('d-none');
      this.ui.progressBar.style.width = '100%';
      this.ui.progressBar.textContent = '100%';
      setTimeout(() => {
        qsa('[data-bs-toggle="collapse"]').forEach(btn => {
          const tgt = btn.getAttribute('data-bs-target');
          const el  = qs(tgt);
          if (!el) return;
          el.addEventListener('show.bs.collapse', () => {
            btn.querySelector('.show-text').classList.add('d-none');
            btn.querySelector('.hide-text').classList.remove('d-none');
          });
          el.addEventListener('hide.bs.collapse', () => {
            btn.querySelector('.show-text').classList.remove('d-none');
            btn.querySelector('.hide-text').classList.add('d-none');
          });
        });
      }, 0);
    }

    /* -------------------- reset modal ---------------------- */
    setupResetModal() {
      if (!qs('#resetModal')) {
        document.body.insertAdjacentHTML('beforeend', `
          <div class="modal fade" id="resetModal" tabindex="-1" aria-labelledby="resetModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered"><div class="modal-content">
              <div class="modal-header bg-danger text-white">
                <h5 class="modal-title" id="resetModalLabel">Reset Progress</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body"><div class="alert alert-danger mb-0"><strong>Are you sure?</strong> This will erase all your answers and progress.</div></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-danger" id="confirm-reset-btn">Yes, Reset</button>
              </div>
            </div></div>
          </div>`);
      }
      this.ui.resetModal = new bootstrap.Modal(qs('#resetModal'));
      this.ui.resetBtn.onclick          = () => this.ui.resetModal.show();
      qs('#confirm-reset-btn').onclick  = () => {
        localStorage.removeItem(STORAGE_KEY);
        this.state.page              = 1;
        this.state.perPage           = 1;
        this.state.answers.fill(null);
        this.state.revealed.fill(false);
        this.state.questionOrder     = [];
        this.state.totalQuestionsOpt = 'all';
        this.saveTotalQuestionsSetting();
        writeUrlParams(this.state.page, this.state.perPage);
        this.ui.perPageSel.value        = this.state.perPage;
        this.ui.totalQuestionsSel.value = this.state.totalQuestionsOpt;
        this.render();
        this.updateNavButtons();
        this.updateProgressBar();
        this.ui.resetModal.hide();
      };
    }
  }

  /* --------------------- Launch -------------------- */
  new QuizApp();
})();
