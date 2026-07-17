/* =========================================================================
 * wizard.js
 * ステップ進行レイヤー（ふつう版の js/core.js・template.lp.js・app.js は無変更）
 * -------------------------------------------------------------------------
 * app.js は #basicFields や #imageCard など「決まった id」に描画するだけで、
 * それがどんな見た目・どのタイミングで画面に出ているかは一切気にしない作り。
 * なのでこのファイルは、既存の要素を「1つずつ見せる／隠す」ことと
 * 「戻る・次へ・進捗バー」を足すことだけに専念する。
 *
 * 起動順：core.js → template.lp.js → app.js → wizard.js
 * app.js の DOMContentLoaded ハンドラ（init）が先に走って画面を組み立て終えた
 * あとに、このファイルの DOMContentLoaded ハンドラが走る。
 * ========================================================================= */

(function () {
  'use strict';

  /**
   * ステップの定義。app.js 側の id とだけ結びつける（テンプレ固有の知識は持たない）。
   * icon/blurb は「今ここで何をする／なぜ必要か」を一言で伝えるための表示用テキストで、
   * ロジックには影響しない（wizard-intro に出すだけ）。
   */
  var STEPS = [
    {
      key: 'preset',
      title: 'プリセット',
      icon: '⚡',
      blurb: '迷ったらプリセットを1つ選ぶだけで、全項目が埋まります。自分で決めたい人はスキップでOK。'
    },
    {
      key: 'basic',
      title: '基本設定',
      icon: '①',
      blurb: '業種・読み手・ゴールの3つを選ぶと、この後の構成がほぼ決まります。'
    },
    {
      key: 'image',
      title: '画像',
      icon: '②',
      blurb: 'LPに使う写真をAIで作る人だけどうぞ。今は用意しなくても先に進めます。',
      // template が imageSlots を持たないときは app.js が #imageCard を hidden にする。
      // その状態をそのまま「このステップは要らない」判定に使う。
      skip: function () {
        var card = document.getElementById('imageCard');
        return !card || card.hidden;
      }
    },
    {
      key: 'info',
      title: '掲載情報',
      icon: '🏷️',
      blurb: '店名・価格など実際の情報。入れておくと、あとの原稿に自動で反映されます（空欄でも進めます）。'
    },
    {
      key: 'advanced',
      title: '詳細設定',
      icon: '🔧',
      blurb: 'こだわりたい人だけ。空欄のままでも次に進めます。'
    },
    {
      key: 'output',
      title: '完成',
      icon: '③',
      blurb: 'あとはコピーして、ChatGPTやClaudeに貼るだけで完成です。'
    }
  ];

  var currentKey = STEPS[0].key;

  function stepEl(key) {
    return document.getElementById('step-' + key);
  }

  function visibleSteps() {
    return STEPS.filter(function (s) {
      return typeof s.skip !== 'function' || !s.skip();
    });
  }

  function currentIndex(steps) {
    var idx = -1;
    steps.forEach(function (s, i) {
      if (s.key === currentKey) idx = i;
    });
    return idx;
  }

  function showStep(key) {
    var steps = visibleSteps();
    if (!steps.some(function (s) { return s.key === key; })) {
      key = steps[0].key;
    }
    currentKey = key;

    STEPS.forEach(function (s) {
      var node = stepEl(s.key);
      if (node) node.hidden = s.key !== key;
    });

    renderProgress();
    renderNav();
    renderIntro();

    var wizard = document.querySelector('.wizard');
    if (wizard && wizard.scrollIntoView) {
      wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function goNext() {
    var steps = visibleSteps();
    var idx = currentIndex(steps);
    if (idx < 0 || idx >= steps.length - 1) return;
    showStep(steps[idx + 1].key);
  }

  function goBack() {
    var steps = visibleSteps();
    var idx = currentIndex(steps);
    if (idx <= 0) return;
    showStep(steps[idx - 1].key);
  }

  function renderProgress() {
    var nav = document.getElementById('wizardProgress');
    if (!nav) return;

    var steps = visibleSteps();
    var idx = currentIndex(steps);

    nav.innerHTML = '';
    steps.forEach(function (s, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wizard-progress__item';
      if (i === idx) btn.classList.add('is-current');
      else if (i < idx) btn.classList.add('is-done');

      var num = document.createElement('span');
      num.className = 'wizard-progress__num';
      num.textContent = String(i + 1);

      var label = document.createElement('span');
      label.className = 'wizard-progress__label';
      label.textContent = s.title;

      btn.appendChild(num);
      btn.appendChild(label);
      btn.addEventListener('click', function () {
        showStep(s.key);
      });

      nav.appendChild(btn);
    });
  }

  /** 今のステップの「一言説明」バーを更新する */
  function renderIntro() {
    var box = document.getElementById('wizardIntro');
    if (!box) return;

    var step = STEPS.filter(function (s) { return s.key === currentKey; })[0];
    if (!step) return;

    box.innerHTML = '';

    var icon = document.createElement('span');
    icon.className = 'wizard-intro__icon';
    icon.textContent = step.icon || '';

    var text = document.createElement('span');
    text.className = 'wizard-intro__text';

    var title = document.createElement('strong');
    title.textContent = step.title;
    text.appendChild(title);
    text.appendChild(document.createTextNode('　' + (step.blurb || '')));

    box.appendChild(icon);
    box.appendChild(text);
  }

  function renderNav() {
    var steps = visibleSteps();
    var idx = currentIndex(steps);

    var back = document.getElementById('wizardBack');
    var next = document.getElementById('wizardNext');
    var hint = document.getElementById('wizardHint');
    if (!back || !next || !hint) return;

    back.classList.toggle('is-invisible', idx <= 0);

    var isLast = idx === steps.length - 1;
    next.classList.toggle('is-invisible', isLast);

    if (isLast) {
      hint.textContent = '完成です。上の出力をコピーして ChatGPT / Claude に貼り付けてください。';
    } else {
      next.textContent = idx === 0 ? 'スキップして次へ →' : '次へ →';
      hint.textContent = 'ステップ ' + (idx + 1) + ' / ' + steps.length;
    }
  }

  /**
   * プリセットを押したら、その場で「完成」まで連れて行く。
   * app.js 側のクリックハンドラ（適用＋コピー）はボタン自体に付いているので、
   * 親要素にバブリングしてくるここでは「押されたあと」に反応するだけでよい。
   */
  function bindPresetShortcut(containerId, buttonSelector) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.addEventListener('click', function (event) {
      if (event.target.closest(buttonSelector)) {
        showStep('output');
      }
    });
  }

  /**
   * 各テキスト欄の下に「例：」を常時表示する。
   * app.js が textarea.placeholder にセットした例文（template.lp.js 側の定義）を
   * そのまま使い回すので、テンプレート固有の知識はここには書かない。
   * placeholder は入力すると消えてしまうので、チュートリアル版では
   * 常に見える形にして「どう書けばいいか」の見本にする。
   */
  function addFieldExamples() {
    ['basicFields', 'infoFields', 'advancedFields'].forEach(function (containerId) {
      var container = document.getElementById(containerId);
      if (!container) return;

      container.querySelectorAll('textarea[placeholder]').forEach(function (area) {
        if (!area.placeholder || area.dataset.exampleAdded) return;
        area.dataset.exampleAdded = '1';

        var hint = document.createElement('div');
        hint.className = 'wizard-example';
        hint.textContent = '例：' + area.placeholder.replace(/^例[）)]\s*/, '');
        area.insertAdjacentElement('afterend', hint);
      });
    });
  }

  function init() {
    var back = document.getElementById('wizardBack');
    var next = document.getElementById('wizardNext');
    if (back) back.addEventListener('click', goBack);
    if (next) next.addEventListener('click', goNext);

    bindPresetShortcut('presets', '.preset-card__apply');
    bindPresetShortcut('userPresets', '.preset-load');

    // タブ切替で別テンプレートに変わると、必要なステップ（画像など）も変わりうるので
    // その場で見え方を再計算する（app.js のタブ切替は同期処理なので、
    // ここに来た時点でフィールドの再描画はもう終わっている）。
    var tabsEl = document.getElementById('tabs');
    if (tabsEl) {
      tabsEl.addEventListener('click', function () {
        addFieldExamples();
        showStep(STEPS[0].key);
      });
    }

    addFieldExamples();
    showStep(STEPS[0].key);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
