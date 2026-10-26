/**
 * Stateless Practice Quiz Controller (docs/quiz.js)
 * Zero dependencies, zero innerHTML (strict DOM creation), pure ?topic=<slug> routing.
 */
(function () {
  'use strict';

  const TOPIC_REGEX = /^[a-z0-9-]+$/;
  const GUIDE_URL_REGEX = /^[A-Za-z0-9_-]+\.html$/;
  const ANCHOR_REGEX = /^[a-z0-9-]+$/;
  const LETTERS = ['A', 'B', 'C', 'D'];

  let topicData = null;
  let allQuestions = [];
  // Session question order (all questions); section filters are views over this order.
  let baseOrder = [];
  let activeDeck = [];
  let currentIndex = 0;
  let sessionSeed = 1;
  let retryMode = false;
  // Map of questionId -> { chosenShuffledIdx: number, isCorrect: boolean }
  let answersState = new Map();
  // Map of questionId -> shuffled array of option objects
  let shuffledOptionsMap = new Map();

  function hash32(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let state = seed >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
    };
  }

  function deterministicShuffle(items, seed) {
    const rng = mulberry32(seed);
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function newRandomSeed() {
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] >>> 0;
    }
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
  }

  function getSafeTopicSlug() {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('topic') || 'rag').toLowerCase().trim();
    return TOPIC_REGEX.test(raw) ? raw : 'rag';
  }

  function getSafeGuideHref(guideUrl, guideAnchor) {
    const safeUrl = GUIDE_URL_REGEX.test(guideUrl || '') ? guideUrl : 'index.html';
    if (guideAnchor && ANCHOR_REGEX.test(guideAnchor)) {
      return safeUrl + '#' + guideAnchor;
    }
    return safeUrl;
  }

  function shuffleOptionsFor(questions) {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qSeed = hash32(String(sessionSeed) + ':' + q.id);
      shuffledOptionsMap.set(q.id, deterministicShuffle(q.options, qSeed));
    }
  }

  function populateSectionDropdown(questions) {
    const selectEl = document.getElementById('quiz-section-select');
    if (!selectEl) return;
    selectEl.replaceChildren();

    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Sections (' + questions.length + ')';
    selectEl.appendChild(allOpt);

    const sectionCounts = new Map();
    for (let i = 0; i < questions.length; i++) {
      const sec = questions[i].section || 'General';
      sectionCounts.set(sec, (sectionCounts.get(sec) || 0) + 1);
    }

    sectionCounts.forEach(function (count, secName) {
      const opt = document.createElement('option');
      opt.value = secName;
      opt.textContent = secName + ' (' + count + ')';
      selectEl.appendChild(opt);
    });
  }

  function getSelectedSection() {
    const selectEl = document.getElementById('quiz-section-select');
    return selectEl ? selectEl.value : 'all';
  }

  function filterBySection(order, section) {
    if (section === 'all') return order.slice();
    return order.filter(function (q) {
      return (q.section || 'General') === section;
    });
  }

  function computeDeckStats() {
    let correctCount = 0;
    let missedCount = 0;
    for (let i = 0; i < activeDeck.length; i++) {
      const st = answersState.get(activeDeck[i].id);
      if (st) {
        if (st.isCorrect) correctCount++;
        else missedCount++;
      }
    }
    return { correct: correctCount, missed: missedCount, answered: correctCount + missedCount };
  }

  function updateSessionBar(stats) {
    const progressPill = document.getElementById('quiz-progress-pill');
    const correctPill = document.getElementById('quiz-correct-pill');
    const missedPill = document.getElementById('quiz-missed-pill');
    const retryBtn = document.getElementById('quiz-retry-missed-btn');
    const retryLabel = document.getElementById('quiz-retry-missed-label');

    if (progressPill) {
      progressPill.textContent =
        'Question ' + (activeDeck.length ? currentIndex + 1 : 0) + ' of ' + activeDeck.length;
    }
    if (correctPill) {
      correctPill.textContent = '✓ ' + stats.correct + ' Correct';
    }
    if (missedPill) {
      missedPill.textContent = '✗ ' + stats.missed + ' Missed';
    }
    if (retryBtn && retryLabel) {
      if (stats.missed > 0) {
        retryBtn.hidden = false;
        retryLabel.textContent = 'Retry Missed (' + stats.missed + ')';
      } else {
        retryBtn.hidden = true;
      }
    }
  }

  function updateRetryBanner() {
    const banner = document.getElementById('quiz-retry-banner');
    const selectEl = document.getElementById('quiz-section-select');
    if (banner) banner.hidden = !retryMode;
    if (selectEl) selectEl.disabled = retryMode;
  }

  function updateCompletionBox(stats) {
    const box = document.getElementById('quiz-complete-box');
    const scoreEl = document.getElementById('quiz-complete-score');
    const detailEl = document.getElementById('quiz-complete-detail');
    const retryBtn = document.getElementById('quiz-complete-retry-btn');
    if (!box) return;

    const isComplete = activeDeck.length > 0 && stats.answered === activeDeck.length;
    box.hidden = !isComplete;
    if (!isComplete) return;

    const pct = Math.round((stats.correct / activeDeck.length) * 100);
    if (scoreEl) {
      scoreEl.textContent = stats.correct + ' / ' + activeDeck.length + ' — ' + pct + '%';
    }
    if (detailEl) {
      let msg;
      if (stats.missed === 0) {
        msg = 'Perfect score — every question answered correctly.';
      } else if (pct >= 80) {
        msg = 'Strong result. Retry the ' + stats.missed + ' missed question(s) to lock them in.';
      } else {
        msg = 'Review the linked study guide sections, then retry the ' + stats.missed + ' missed question(s).';
      }
      detailEl.textContent = msg;
    }
    if (retryBtn) {
      retryBtn.hidden = stats.missed === 0;
    }
  }

  function renderStrip() {
    const stripList = document.getElementById('mcq-strip-list');
    if (!stripList) return;
    stripList.replaceChildren();

    for (let i = 0; i < activeDeck.length; i++) {
      const q = activeDeck[i];
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mcq-strip-btn';
      btn.textContent = String(i + 1);

      const st = answersState.get(q.id);
      let statusDesc = 'unanswered';
      if (st) {
        if (st.isCorrect) {
          btn.classList.add('is-correct');
          statusDesc = 'correct';
        } else {
          btn.classList.add('is-wrong');
          statusDesc = 'missed';
        }
      }
      if (i === currentIndex) {
        btn.classList.add('is-current');
        btn.setAttribute('aria-current', 'step');
      }
      btn.setAttribute('aria-label', 'Jump to question ' + (i + 1) + ' (' + statusDesc + ')');
      btn.addEventListener('click', function () {
        goTo(i);
      });
      li.appendChild(btn);
      stripList.appendChild(li);
    }
  }

  function renderFeedback(q, shuffledOpts, answerRecord) {
    const feedbackBox = document.getElementById('mcq-feedback-box');
    const banner = document.getElementById('mcq-feedback-banner');
    const explanationEl = document.getElementById('mcq-explanation-text');
    const distractorList = document.getElementById('mcq-distractor-list');
    const takeawayEl = document.getElementById('mcq-takeaway-text');
    const deepLink = document.getElementById('mcq-deep-link');

    if (!feedbackBox) return;
    if (!answerRecord) {
      feedbackBox.hidden = true;
      return;
    }

    feedbackBox.hidden = false;
    if (banner) {
      banner.className =
        'mcq-feedback-banner ' + (answerRecord.isCorrect ? 'banner-correct' : 'banner-wrong');
      banner.textContent = answerRecord.isCorrect
        ? '✓ Correct — Well spotted!'
        : '✗ Not quite — review the breakdown below:';
    }

    if (explanationEl) {
      explanationEl.textContent = q.explanation || '';
    }

    if (distractorList) {
      distractorList.replaceChildren();
      for (let i = 0; i < shuffledOpts.length; i++) {
        const opt = shuffledOpts[i];
        if (opt.correct) continue;
        const li = document.createElement('li');
        li.className = 'mcq-distractor-item';
        if (i === answerRecord.chosenShuffledIdx) {
          li.classList.add('is-chosen-distractor');
        }

        const badge = document.createElement('strong');
        badge.className = 'mcq-distractor-letter';
        badge.textContent =
          'Option ' + LETTERS[i] + (i === answerRecord.chosenShuffledIdx ? ' (Your Choice): ' : ': ');

        const reason = document.createElement('span');
        reason.textContent = opt.why_wrong || '';

        li.appendChild(badge);
        li.appendChild(reason);
        distractorList.appendChild(li);
      }
    }

    if (takeawayEl) {
      takeawayEl.textContent = q.key_takeaway || '';
    }

    if (deepLink && topicData) {
      deepLink.setAttribute('href', getSafeGuideHref(topicData.guide_url, q.guide_anchor));
    }
  }

  function handleOptionSelect(q, shuffledIdx) {
    if (answersState.has(q.id)) return;
    const shuffledOpts = shuffledOptionsMap.get(q.id) || q.options;
    const chosen = shuffledOpts[shuffledIdx];
    if (!chosen) return;

    const isCorrect = Boolean(chosen.correct);
    answersState.set(q.id, {
      chosenShuffledIdx: shuffledIdx,
      isCorrect: isCorrect
    });

    if (typeof window.gtag === 'function' && topicData) {
      window.gtag('event', 'quiz_answer', {
        event_category: 'Quiz',
        event_label: topicData.topic_id + ':' + q.id,
        value: isCorrect ? 1 : 0
      });
    }

    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    const stats = computeDeckStats();
    updateRetryBanner();

    if (!activeDeck.length) {
      updateSessionBar(stats);
      updateCompletionBox(stats);
      renderStrip();
      return;
    }

    const q = activeDeck[currentIndex];
    const shuffledOpts = shuffledOptionsMap.get(q.id) || q.options;
    const answerRecord = answersState.get(q.id) || null;

    const topicBadge = document.getElementById('mcq-topic-badge');
    const sectionBadge = document.getElementById('mcq-section-badge');
    const questionText = document.getElementById('mcq-question-text');
    const optionsList = document.getElementById('mcq-options-list');
    const prevBtn = document.getElementById('mcq-prev-btn');
    const nextBtn = document.getElementById('mcq-next-btn');

    if (topicBadge && topicData) {
      topicBadge.textContent = topicData.topic_id.toUpperCase();
    }
    if (sectionBadge) {
      sectionBadge.textContent = q.section || '';
    }
    if (questionText) {
      questionText.textContent = q.question || '';
    }

    if (optionsList) {
      optionsList.replaceChildren();
      for (let i = 0; i < shuffledOpts.length; i++) {
        const opt = shuffledOpts[i];
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mcq-option-btn';

        const letterSpan = document.createElement('span');
        letterSpan.className = 'mcq-opt-letter';
        letterSpan.textContent = LETTERS[i];

        const textSpan = document.createElement('span');
        textSpan.className = 'mcq-opt-text';
        textSpan.textContent = opt.text;

        btn.appendChild(letterSpan);
        btn.appendChild(textSpan);

        if (answerRecord) {
          btn.setAttribute('aria-disabled', 'true');
          if (opt.correct) {
            btn.classList.add('opt-correct');
          } else if (i === answerRecord.chosenShuffledIdx) {
            btn.classList.add('opt-wrong');
          } else {
            btn.classList.add('opt-dimmed');
          }
        } else {
          btn.addEventListener('click', function () {
            handleOptionSelect(q, i);
          });
        }

        li.appendChild(btn);
        optionsList.appendChild(li);
      }
    }

    renderFeedback(q, shuffledOpts, answerRecord);
    updateSessionBar(stats);
    updateCompletionBox(stats);
    renderStrip();

    if (prevBtn) {
      prevBtn.disabled = currentIndex === 0;
    }
    if (nextBtn) {
      nextBtn.disabled = currentIndex >= activeDeck.length - 1;
    }
  }

  // User-initiated navigation: re-render and move focus to the new question heading
  // so keyboard and screen-reader users land on the new content.
  function goTo(index) {
    if (index < 0 || index >= activeDeck.length) return;
    currentIndex = index;
    renderCurrentQuestion();
    const heading = document.getElementById('mcq-question-text');
    if (heading) heading.focus({ preventScroll: false });
  }

  function showDeck(deck) {
    activeDeck = deck.slice();
    // Land on the first unanswered question in the new view, if any.
    let firstOpen = 0;
    for (let i = 0; i < activeDeck.length; i++) {
      if (!answersState.has(activeDeck[i].id)) {
        firstOpen = i;
        break;
      }
    }
    currentIndex = firstOpen;
    renderCurrentQuestion();
  }

  // Full restart: new seed, new question + option order, all answers cleared.
  function restartSession(shuffleQuestions) {
    sessionSeed = newRandomSeed();
    retryMode = false;
    answersState.clear();
    shuffledOptionsMap.clear();
    shuffleOptionsFor(allQuestions);
    baseOrder = shuffleQuestions ? deterministicShuffle(allQuestions, sessionSeed) : allQuestions.slice();
    showDeck(filterBySection(baseOrder, getSelectedSection()));
  }

  function enterRetryMode() {
    const missed = activeDeck.filter(function (q) {
      const st = answersState.get(q.id);
      return st && !st.isCorrect;
    });
    if (!missed.length) return;
    retryMode = true;
    // Clear only the missed answers and reshuffle their options so the retry is a genuine re-test.
    const retrySeed = newRandomSeed();
    for (let i = 0; i < missed.length; i++) {
      answersState.delete(missed[i].id);
      shuffledOptionsMap.set(
        missed[i].id,
        deterministicShuffle(missed[i].options, hash32(String(retrySeed) + ':' + missed[i].id))
      );
    }
    showDeck(missed);
    goTo(0);
  }

  function exitRetryMode() {
    retryMode = false;
    showDeck(filterBySection(baseOrder, getSelectedSection()));
  }

  function bindControls() {
    const prevBtn = document.getElementById('mcq-prev-btn');
    const nextBtn = document.getElementById('mcq-next-btn');
    const reshuffleBtn = document.getElementById('quiz-reshuffle-btn');
    const retryMissedBtn = document.getElementById('quiz-retry-missed-btn');
    const sectionSelect = document.getElementById('quiz-section-select');
    const exitRetryBtn = document.getElementById('quiz-exit-retry-btn');
    const completeRetryBtn = document.getElementById('quiz-complete-retry-btn');
    const completeRestartBtn = document.getElementById('quiz-complete-restart-btn');

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        goTo(currentIndex - 1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        goTo(currentIndex + 1);
      });
    }

    if (reshuffleBtn) {
      reshuffleBtn.addEventListener('click', function () {
        const hasProgress = answersState.size > 0;
        if (hasProgress && !window.confirm('Restart the quiz? Your current answers will be cleared.')) {
          return;
        }
        restartSession(true);
      });
    }

    if (retryMissedBtn) {
      retryMissedBtn.addEventListener('click', enterRetryMode);
    }
    if (completeRetryBtn) {
      completeRetryBtn.addEventListener('click', enterRetryMode);
    }
    if (completeRestartBtn) {
      completeRestartBtn.addEventListener('click', function () {
        restartSession(true);
        goTo(0);
      });
    }
    if (exitRetryBtn) {
      exitRetryBtn.addEventListener('click', exitRetryMode);
    }

    if (sectionSelect) {
      // Section filtering is a non-destructive view: answers and option order are preserved.
      sectionSelect.addEventListener('change', function () {
        if (retryMode) return;
        showDeck(filterBySection(baseOrder, sectionSelect.value));
      });
    }

    document.addEventListener('keydown', function (e) {
      // Never hijack browser/OS shortcuts such as Cmd+A, Ctrl+C, Alt+Left.
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const t = e.target;
      if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return;
      }
      if (!activeDeck.length) return;
      const q = activeDeck[currentIndex];
      const key = e.key.toUpperCase();
      const optionKeys = { '1': 0, 'A': 0, '2': 1, 'B': 1, '3': 2, 'C': 2, '4': 3, 'D': 3 };

      if (Object.prototype.hasOwnProperty.call(optionKeys, key)) {
        if (e.repeat) return;
        handleOptionSelect(q, optionKeys[key]);
      } else if (e.key === 'ArrowRight' && currentIndex < activeDeck.length - 1) {
        e.preventDefault();
        goTo(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        goTo(currentIndex - 1);
      }
    });
  }

  async function initQuiz() {
    const topicSlug = getSafeTopicSlug();
    const titleEl = document.getElementById('quiz-title');
    const guideLink = document.getElementById('quiz-guide-link');
    const guideLabel = document.getElementById('quiz-guide-label');

    bindControls();

    try {
      const response = await fetch('quiz/' + topicSlug + '.json');
      if (!response.ok) {
        throw new Error('Quiz topic not found (' + response.status + ')');
      }
      const data = await response.json();
      topicData = data;
      allQuestions = Array.isArray(data.questions) ? data.questions : [];

      if (titleEl) {
        titleEl.textContent = (data.title || topicSlug.toUpperCase()) + ' — Practice Quiz';
      }
      document.title = (data.title || topicSlug.toUpperCase()) + ' Practice Quiz | ML Certification Hub';

      if (guideLink && data.guide_url) {
        guideLink.setAttribute('href', getSafeGuideHref(data.guide_url, null));
      }
      if (guideLabel && data.title) {
        guideLabel.textContent = 'Open ' + data.topic_id.toUpperCase() + ' Study Guide';
      }

      populateSectionDropdown(allQuestions);
      restartSession(false);
    } catch (err) {
      if (titleEl) {
        titleEl.textContent = 'Practice Quiz Unavailable';
      }
      const questionText = document.getElementById('mcq-question-text');
      if (questionText) {
        questionText.textContent =
          'Could not load the requested topic quiz. Please return to the Hub and select an available quiz.';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initQuiz);
})();
