/* =========================================================================
 * v2/js/app.js
 * まだスケルトン。今できているのは「入口の分岐」で画面を切り替えるところまで。
 * template.lp.js / template.visual.js / template.icon.js / core.js は
 * ../js/ からそのまま読み込んでいて、ここでは一切コピーしない
 * （ロジックの二重管理を避けるため）。
 *
 * 次に作るもの（NOTES.md 参照）：
 *   - プリセット一覧（説明文を常時表示、クリックでは即上書きしない）
 *   - 内容確認・コピー画面
 *   - 基本設定を3項目（業種・読み手・ゴール）に絞ったステップ
 * ========================================================================= */

(function () {
  'use strict';

  // v2 はまだ「LP作成」1テンプレートだけ対応。タブ切替は後で足す。
  var template = window.PromptMaker.getTemplate('lp');

  // 「自分で決める」ルートで選んだ3項目だけの状態。プリセット側の state とは別に持つ。
  var manualState = null;

  // 手動ルートの画像ステップ用（v1 の imageStore / refLockStore と同じ役割）。
  var manualImages = {};
  var manualRefLock = {};

  // 内容確認画面（confirmStep）が今どちらのルートから来たか・何を build() するか。
  var confirmState = null;
  var confirmReturnTo = 'presetStep';

  // フォルダ準備（旧ステップ0）を任意画面にしたので、開いた元の画面へ戻れるよう覚えておく。
  var folderReturnTo = 'entryStep';

  // 選んだ入口によって、必要なステップ数と出口を変える。
  var currentRoute = 'entry';

  var ROUTE_LABELS = {
    entry: 'はじめ方を選択中',
    preset: 'すぐ作るコース',
    manual: '自分らしく作るコース',
    original: 'AIとゼロから作るコース'
  };

  var ROUTE_FLOWS = {
    entry: [
      { id: 'entryStep', label: '作り方を選ぶ' }
    ],
    preset: [
      { id: 'entryStep', label: '作り方' },
      { id: 'presetStep', label: '見本を選ぶ' },
      { id: 'confirmStep', label: '確認・コピー' }
    ],
    manual: [
      { id: 'entryStep', label: '作り方' },
      { id: 'basicStep', label: '方向' },
      { id: 'imageStep', label: '画像' },
      { id: 'infoStep', label: '掲載情報' },
      { id: 'advancedStep', label: '仕上げ' },
      { id: 'confirmStep', label: '完成' }
    ],
    original: [
      { id: 'entryStep', label: '作り方' },
      { id: 'originalStep', label: '制作環境' },
      { id: 'basicStep', label: '方向' },
      { id: 'imageStep', label: '画像' },
      { id: 'infoStep', label: '掲載情報' },
      { id: 'advancedStep', label: '仕上げ' },
      { id: 'confirmStep', label: '完成' }
    ]
  };

  var STEP_GUIDE = {
    entryStep: {
      eyebrow: 'まずはここから',
      message: '難しい言葉は使いません。今日の目的に合う作り方を一緒に選びましょう。',
      image: 'mascot-plain.webp'
    },
    originalStep: {
      eyebrow: '最初のタスク',
      message: 'ここでは制作の置き場所だけ整えます。AIから完了報告を受けたらチェックして、次へ進みましょう。',
      image: 'mascot-setup.webp'
    },
    presetStep: {
      eyebrow: '雰囲気が近ければOK',
      message: '完全に同じ業種でなくても大丈夫。色や空気感が近い見本を一つ選んでください。',
      image: 'mascot-think.webp'
    },
    basicStep: {
      eyebrow: 'まずは3つだけ',
      message: '今の時点で一番近い答えを選べば十分です。あとから何度でも変更できます。',
      image: 'mascot-think.webp'
    },
    imageStep: {
      eyebrow: 'ここは飛ばしてもOK',
      message: '画像を使うなら、生成してアップロードするだけ。リネームと軽量化はLPmakerに任せてください。',
      image: 'mascot-image.webp'
    },
    infoStep: {
      eyebrow: '分かる範囲だけ',
      message: '店名や価格など、間違えたくない情報を入れます。未定の項目は空欄で進めます。',
      image: 'mascot-setup.webp'
    },
    advancedStep: {
      eyebrow: 'あと一歩です',
      message: '雰囲気や文章量を調整する仕上げです。こだわらなければ、そのまま次へ進めます。',
      image: 'mascot-think.webp'
    },
    confirmStep: {
      eyebrow: 'ここまでできました',
      message: '内容を確認してコピーしましょう。あとはCodexやClaudeが、LPの実装を引き継げます。',
      image: 'mascot-launch.webp'
    },
    folderStep: {
      eyebrow: '公開したくなったときに',
      message: 'フォルダとGitHubの準備だけを、いつでもここから行えます。今はスキップしても大丈夫です。',
      image: 'mascot-setup.webp'
    }
  };

  // v2/ から見た assets の相対パス（../js/app.js の ASSET_DIR と同じ考え方）。
  var ASSET_DIR = '../assets/presets';
  var ASSET_VERSION = '20260718-4';
  var IMAGE_EXTS = ['webp', 'png', 'jpg', 'jpeg'];

  /**
   * プリセットの見本画像を読み込む。拡張子を順に試すフォールバック付き。
   * 画像が無い/読めない場合でも card 側の見た目・クリック挙動は変えない
   * （旧版は「画像が読めた時だけ拡大ボタンが出る」という一貫性の無さが
   * 分かりにくさの原因だったので、v2 では読み込み結果に関係なく
   * 「アイコン＋名前＋説明文」は常に同じ形で見えるようにする）。
   */
  function loadPresetImage(preset, img, onLoad, onFail) {
    if (!preset.id) {
      onFail();
      return;
    }
    var basePath = ASSET_DIR + '/' + template.id + '/' + preset.id;
    var extensions = template.id === 'icon' ? ['svg', 'png', 'webp', 'jpg', 'jpeg'] : IMAGE_EXTS;
    var candidates = extensions.map(function (ext) { return basePath + '.' + ext + '?v=' + ASSET_VERSION; });
    var index = 0;

    img.addEventListener('load', function () {
      onLoad(img.currentSrc || img.src);
    });
    img.addEventListener('error', function () {
      index += 1;
      if (index < candidates.length) {
        img.src = candidates[index];
      } else {
        onFail();
      }
    });
    img.src = candidates[0];
  }

  /** defaults と preset.values を、配列参照を共有しないよう複製しながら合成する。
   *  js/app.js の createState() と同じ考え方（同じ問題を再発明しない）。 */
  function createState() {
    var merged = {};
    Array.prototype.forEach.call(arguments, function (source) {
      if (!source) return;
      Object.assign(merged, JSON.parse(JSON.stringify(source)));
    });
    return merged;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function updateGuide(stepId) {
    var flow = stepId === 'folderStep'
      ? [{ id: 'folderStep', label: '公開の準備' }]
      : (ROUTE_FLOWS[currentRoute] || ROUTE_FLOWS.entry);
    var currentIndex = flow.map(function (step) { return step.id; }).indexOf(stepId);
    if (currentIndex < 0) currentIndex = 0;

    var list = document.getElementById('progressItems');
    var panel = document.getElementById('progressPanel');
    var bar = document.getElementById('progressBar');
    if (list && panel && bar) {
      list.innerHTML = '';
      list.style.setProperty('--step-count', flow.length);
      panel.style.setProperty('--step-count', flow.length);
      flow.forEach(function (step, index) {
        var item = el('li', 'v2-progress__item');
        if (index < currentIndex) item.classList.add('is-done');
        if (index === currentIndex) {
          item.classList.add('is-current');
          item.setAttribute('aria-current', 'step');
        }
        item.appendChild(el('span', 'v2-progress__dot', index < currentIndex ? '✓' : '•'));
        item.appendChild(el('span', 'v2-progress__label', step.label));
        list.appendChild(item);
      });
      bar.style.width = flow.length > 1 ? ((currentIndex / (flow.length - 1)) * 100) + '%' : '0%';
    }

    var guide = STEP_GUIDE[stepId] || STEP_GUIDE.entryStep;
    var eyebrow = document.getElementById('companionEyebrow');
    var message = document.getElementById('companionMessage');
    var image = document.getElementById('companionImage');
    var routeLabel = document.getElementById('routeLabel');
    if (eyebrow) eyebrow.textContent = guide.eyebrow;
    if (message) message.textContent = guide.message;
    if (image) image.src = '../assets/mascot/' + guide.image;
    if (routeLabel) routeLabel.textContent = stepId === 'folderStep' ? 'フォルダ・GitHubの準備' : ROUTE_LABELS[currentRoute];
  }

  function show(id) {
    ['folderStep', 'entryStep', 'originalStep', 'presetStep', 'confirmStep', 'basicStep', 'imageStep', 'infoStep', 'advancedStep']
      .forEach(function (sectionId) {
        var section = document.getElementById(sectionId);
        if (section) section.hidden = sectionId !== id;
      });
    updateGuide(id);
  }

  /** いま表示中のステップIDを返す（フォルダ準備から元の画面へ戻るため）。 */
  function currentStep() {
    var ids = ['folderStep', 'entryStep', 'originalStep', 'presetStep', 'confirmStep', 'basicStep', 'imageStep', 'infoStep', 'advancedStep'];
    for (var i = 0; i < ids.length; i++) {
      var s = document.getElementById(ids[i]);
      if (s && !s.hidden) return ids[i];
    }
    return 'entryStep';
  }

  /* ------------------------------------------------------------------
   * プリセット一覧
   * ------------------------------------------------------------------
   * app.js（1画面版）と違い、クリックしても即・適用＋コピーはしない。
   * ここでは「選ぶ」だけで、内容確認画面（confirmStep）に進むだけにする。
   * サムネイル画像には依存しない：アイコン・名前・説明文だけで
   * どのカードも同じ見た目になるようにする（一発でわかる、を優先）。
   * ------------------------------------------------------------------ */

  function renderPresetCard(preset) {
    var card = el('button', 'v2-preset-card');
    if (template.id === 'icon') card.classList.add('v2-preset-card--icon');
    card.type = 'button';

    // サムネイル領域：読めるまでは絵文字＋ウォッシュの土台。読めたら差し替わる。
    // 読み込みに成功しても失敗しても、カードの見た目の骨組みとクリック挙動は変えない。
    var thumb = el('div', 'v2-preset-card__thumb');
    thumb.appendChild(el('span', 'v2-preset-card__thumb-icon', preset.icon || ''));
    var img = el('img', 'v2-preset-card__thumb-img');
    img.alt = preset.name + ' の仕上がり例';
    img.loading = 'eager';
    img.decoding = 'async';
    thumb.appendChild(img);
    card.appendChild(thumb);

    loadPresetImage(
      preset,
      img,
      function (src) {
        thumb.classList.add('has-image');
        preset._loadedSrc = src;
      },
      function () {
        img.remove();
      }
    );

    var head = el('div', 'v2-preset-card__head');
    head.appendChild(el('span', 'v2-preset-card__name', preset.name));
    card.appendChild(head);

    if (preset.description) {
      card.appendChild(el('p', 'v2-preset-card__desc', preset.description));
    }

    card.addEventListener('click', function () {
      showConfirmForPreset(preset);
    });

    return card;
  }

  function renderPresets() {
    var list = document.getElementById('presetList');
    if (!list || !template) return;
    list.innerHTML = '';
    template.presets.forEach(function (preset) {
      list.appendChild(renderPresetCard(preset));
    });
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：①基本設定（3項目だけ）
   * ------------------------------------------------------------------
   * トーン・ボリューム・出力タイプは、素人が一発でわかる基準からあえて外し、
   * 別の場所（詳細設定）に回す前提。ここでは業種・読み手・ゴールだけ。
   * ------------------------------------------------------------------ */

  var MANUAL_FIELD_KEYS = ['type', 'reader', 'goal'];

  function normalizeOption(option) {
    return typeof option === 'string' ? { value: option, label: option } : option;
  }

  function renderBasicField(field) {
    var wrap = el('div', 'v2-field');
    wrap.appendChild(el('p', 'v2-field__label', (field.icon ? field.icon + ' ' : '') + field.label));

    var chips = el('div', 'chips');
    field.options.map(normalizeOption).forEach(function (option) {
      var chip = el('button', 'chip', option.label);
      chip.type = 'button';
      if (manualState[field.key] === option.value) chip.classList.add('is-active');
      chip.addEventListener('click', function () {
        manualState[field.key] = option.value;
        renderBasicFields();
      });
      chips.appendChild(chip);
    });

    wrap.appendChild(chips);
    return wrap;
  }

  function renderBasicFields() {
    if (!manualState) manualState = createState(template.defaults);
    var container = document.getElementById('basicFields');
    if (!container) return;
    container.innerHTML = '';
    MANUAL_FIELD_KEYS.forEach(function (key) {
      var field = template.fields.filter(function (f) { return f.key === key; })[0];
      if (field) container.appendChild(renderBasicField(field));
    });
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：②画像（任意）
   * ------------------------------------------------------------------
   * ロジック（WebP変換・ZIP書き出し・クリップボード）は imageWorkflow.js を
   * そのまま呼ぶ。ここに書くのは DOM の組み立てだけ（v1 の renderImageSlots と
   * 同じ役割分担）。
   * ------------------------------------------------------------------ */

  function syncManualImagesToState() {
    manualState._images = Object.keys(manualImages).map(function (id) {
      return { id: id, file: manualImages[id].file };
    });
  }

  function syncManualRefLockToState() {
    manualState._refLock = Object.assign({}, manualRefLock);
  }

  function renderImageSlotRow(slot) {
    var row = el('div', 'imgslot');

    var head = el('div', 'imgslot__head');
    head.appendChild(el('span', 'imgslot__label', slot.label));
    head.appendChild(el('span', 'imgslot__ratio', slot.ratio));

    var refLockLabel = el('label', 'imgslot__reflock');
    var refCheckbox = document.createElement('input');
    refCheckbox.type = 'checkbox';
    refCheckbox.checked = !!manualRefLock[slot.id];
    refCheckbox.addEventListener('change', function () {
      if (refCheckbox.checked) manualRefLock[slot.id] = true; else delete manualRefLock[slot.id];
      syncManualRefLockToState();
      renderImageStep(); // 参照ロックの注記が prompt に付く/消えるので作り直す
    });
    refLockLabel.appendChild(refCheckbox);
    refLockLabel.appendChild(el('span', null, '実物を反映（写真を崩さない）'));
    head.appendChild(refLockLabel);

    row.appendChild(head);

    var acts = el('div', 'imgslot__acts');

    var copyBtn = el('button', 'imgslot__btn', '📋 プロンプト');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', function () {
      ImageWorkflow.writeClipboard(slot.prompt, function (ok) {
        copyBtn.textContent = ok ? '✅ コピー済み' : 'コピー失敗';
        setTimeout(function () { copyBtn.textContent = '📋 プロンプト'; }, 1500);
      });
    });
    acts.appendChild(copyBtn);

    var pickLabel = el('label', 'imgslot__btn');
    pickLabel.appendChild(el('span', null, '🖼 画像を選ぶ'));
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        ImageWorkflow.toWebpDataURL(file, reader.result, function (finalDataURL) {
          manualImages[slot.id] = { file: ImageWorkflow.slotFileName(slot.id, finalDataURL), dataURL: finalDataURL };
          syncManualImagesToState();
          renderImageStep();
        });
      };
      reader.readAsDataURL(file);
    });
    pickLabel.appendChild(fileInput);
    acts.appendChild(pickLabel);

    row.appendChild(acts);

    var thumb = el('div', 'imgslot__thumb');
    if (manualImages[slot.id]) {
      var img = el('img');
      img.src = manualImages[slot.id].dataURL;
      img.alt = slot.label;
      thumb.appendChild(img);
      thumb.classList.add('has');
      var rm = el('button', 'imgslot__rm', '×');
      rm.type = 'button';
      rm.addEventListener('click', function () {
        delete manualImages[slot.id];
        syncManualImagesToState();
        renderImageStep();
      });
      thumb.appendChild(rm);
    }
    row.appendChild(thumb);

    return row;
  }

  function renderImageStep() {
    if (!manualState) manualState = createState(template.defaults);
    syncManualRefLockToState();

    var hasSlots = typeof template.imageSlots === 'function';
    var slots = hasSlots ? template.imageSlots(manualState) : [];

    var container = document.getElementById('v2ImageSlots');
    container.innerHTML = '';
    slots.forEach(function (slot) {
      container.appendChild(renderImageSlotRow(slot));
    });

    var total = slots.length;
    var done = slots.filter(function (s) { return manualImages[s.id]; }).length;
    var countEl = document.getElementById('v2ImageCount');
    if (countEl) countEl.textContent = total ? done + ' / ' + total + ' 枚セット済み' : '';

    var zipBtn = document.getElementById('v2ImageZip');
    if (zipBtn) zipBtn.disabled = done === 0;
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：③掲載情報（任意）
   * ------------------------------------------------------------------
   * ラベル文言は業種で変わることがある（例：メニュー欄は「看板メニュー」
   * 「料金プラン」など業種ごとの言葉に、特徴欄も同様）。この判断は
   * template.inputLabelOf() に任せ、ここでは「動的ラベルがあれば使う、
   * なければ FIELDS の既定ラベル」というルールだけを持つ
   * （app.js 側は業種の知識を一切持たない、という設計方針を踏襲）。
   * repeater（商品・メニュー／リンク）の行management は v1 の
   * renderRepeaterField と同じ考え方だが、state は manualState を直接使う。
   * ------------------------------------------------------------------ */

  var INFO_FIELD_KEYS = ['infoName', 'menuItems', 'infoDate', 'infoPlace', 'infoMapUrl', 'infoFeature', 'mascot', 'links'];

  function resolveFieldLabel(field) {
    var dynamicLabel = typeof template.inputLabelOf === 'function'
      ? template.inputLabelOf(field.key, manualState)
      : null;
    return dynamicLabel || field.label;
  }

  function renderInfoFieldHeader(field) {
    var header = el('div', 'field-header');
    var label = el('span', 'field-label');
    label.appendChild(el('span', 'field-icon', field.icon || ''));
    label.appendChild(el('span', null, resolveFieldLabel(field)));
    header.appendChild(label);
    if (field.hint) header.appendChild(el('span', 'field-hint', field.hint));
    return header;
  }

  function renderInfoTextareaField(field) {
    var wrap = el('div', 'field');
    wrap.appendChild(renderInfoFieldHeader(field));

    var area = el('textarea', 'textarea');
    area.rows = field.rows || 2;
    area.placeholder = field.placeholder || '';
    area.value = manualState[field.key] || '';
    area.addEventListener('input', function () {
      manualState[field.key] = area.value;
    });

    wrap.appendChild(area);
    return wrap;
  }

  /** 1件も入っていなければ、空の1行を見せる（v1 の repeaterItems と同じ考え方） */
  function infoRepeaterItems(field) {
    var list = manualState[field.key];
    return Array.isArray(list) && list.length ? list : [{}];
  }

  function setInfoRepeaterItemValue(fieldKey, index, subKey, value) {
    var items = Array.isArray(manualState[fieldKey])
      ? manualState[fieldKey].map(function (item) { return Object.assign({}, item); })
      : [];
    if (!items[index]) items[index] = {};
    items[index][subKey] = value;
    manualState[fieldKey] = items;
  }

  function renderInfoRepeaterRows(field, rowsContainer) {
    var items = infoRepeaterItems(field);
    rowsContainer.innerHTML = '';

    items.forEach(function (item, index) {
      var row = el('div', 'repeater__row');

      field.itemFields.forEach(function (sub) {
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'repeater__input';
        input.placeholder = sub.placeholder || '';
        input.value = item[sub.key] || '';
        if (sub.flex) input.style.flexGrow = String(sub.flex);

        input.addEventListener('input', function () {
          setInfoRepeaterItemValue(field.key, index, sub.key, input.value);
        });

        row.appendChild(input);
      });

      var remove = el('button', 'repeater__remove', '×');
      remove.type = 'button';
      remove.title = 'この行を削除';
      remove.disabled = items.length <= 1;
      if (items.length <= 1) remove.classList.add('is-disabled');

      remove.addEventListener('click', function () {
        var arr = Array.isArray(manualState[field.key]) ? manualState[field.key].slice() : [];
        arr.splice(index, 1);
        manualState[field.key] = arr;
        renderInfoRepeaterRows(field, rowsContainer);
      });

      row.appendChild(remove);
      rowsContainer.appendChild(row);
    });
  }

  function renderInfoRepeaterField(field) {
    var wrap = el('div', 'field');
    wrap.appendChild(renderInfoFieldHeader(field));

    var rowsContainer = el('div', 'repeater__rows');
    wrap.appendChild(rowsContainer);
    renderInfoRepeaterRows(field, rowsContainer);

    var addBtn = el('button', 'repeater__add', field.addLabel || '＋ 追加');
    addBtn.type = 'button';
    addBtn.addEventListener('click', function () {
      var arr = Array.isArray(manualState[field.key]) ? manualState[field.key].slice() : [];
      arr.push({});
      manualState[field.key] = arr;
      renderInfoRepeaterRows(field, rowsContainer);

      var rows = rowsContainer.querySelectorAll('.repeater__row');
      var lastRow = rows[rows.length - 1];
      var firstInput = lastRow && lastRow.querySelector('input');
      if (firstInput) firstInput.focus();
    });
    wrap.appendChild(addBtn);

    return wrap;
  }

  function renderInfoField(field) {
    if (field.type === 'textarea') return renderInfoTextareaField(field);
    if (field.type === 'repeater') return renderInfoRepeaterField(field);
    return null;
  }

  function renderInfoFields() {
    if (!manualState) manualState = createState(template.defaults);
    var container = document.getElementById('infoFields');
    if (!container) return;
    container.innerHTML = '';
    INFO_FIELD_KEYS.forEach(function (key) {
      var field = template.fields.filter(function (f) { return f.key === key; })[0];
      if (!field) return;
      var node = renderInfoField(field);
      if (node) container.appendChild(node);
    });
  }

  /* ------------------------------------------------------------------
   * 自分で決めるルート：④詳細設定（任意）
   * ------------------------------------------------------------------
   * トーン・ボリューム・出力タイプ（chips）と、参考・補足（textarea）。
   * ①〜③ではあえて出さなかった項目をここにまとめる。
   * chips は renderBasicField と同じ考え方（.v2-field / .v2-field__label /
   * chips / chip を流用）、textarea は③と同じ renderInfoTextareaField を
   * そのまま使う（ref・extra は inputLabelOf の対象外なので既定ラベルに
   * フォールバックするだけで、③専用のロジックではない）。
   * ------------------------------------------------------------------ */

  var ADVANCED_FIELD_KEYS = ['tone', 'volume', 'output', 'ref', 'extra'];

  function renderAdvancedChipsField(field) {
    var wrap = el('div', 'v2-field');
    wrap.appendChild(el('p', 'v2-field__label', (field.icon ? field.icon + ' ' : '') + field.label));

    var chips = el('div', 'chips');
    field.options.map(normalizeOption).forEach(function (option) {
      var chip = el('button', 'chip', option.label);
      chip.type = 'button';
      if (manualState[field.key] === option.value) chip.classList.add('is-active');
      chip.addEventListener('click', function () {
        manualState[field.key] = option.value;
        renderAdvancedFields();
      });
      chips.appendChild(chip);
    });

    wrap.appendChild(chips);
    return wrap;
  }

  function renderAdvancedField(field) {
    if (field.type === 'chips') return renderAdvancedChipsField(field);
    if (field.type === 'textarea') return renderInfoTextareaField(field);
    return null;
  }

  function renderAdvancedFields() {
    if (!manualState) manualState = createState(template.defaults);
    var container = document.getElementById('advancedFields');
    if (!container) return;
    container.innerHTML = '';
    ADVANCED_FIELD_KEYS.forEach(function (key) {
      var field = template.fields.filter(function (f) { return f.key === key; })[0];
      if (!field) return;
      var node = renderAdvancedField(field);
      if (node) container.appendChild(node);
    });
  }

  /* ------------------------------------------------------------------
   * 内容確認・コピー画面
   * ------------------------------------------------------------------
   * プリセット経由・自分で決める経由のどちらから来ても、
   * 同じ画面（confirmState を build するだけ）で受け止める。
   * confirmReturnTo だけがルートごとの「戻る先」を覚えている。
   * ------------------------------------------------------------------ */

  function buildSpecPairsFromState(state) {
    return template.fields
      .filter(function (field) { return field.group === 'basic'; })
      .map(function (field) { return { label: field.label, value: state[field.key] }; })
      .filter(function (pair) { return pair.value && pair.value !== 'なし'; });
  }

  /** サムネイル領域の中身を差し替える。preset が無い（＝自分で決めるルート）ときは
   *  画像を試さず、絵文字だけのプレースホルダのままにする。 */
  function applyConfirmThumb(preset) {
    var thumb = document.getElementById('confirmThumb');
    var thumbIcon = document.getElementById('confirmThumbIcon');
    var thumbImg = document.getElementById('confirmThumbImg');

    thumbIcon.textContent = (preset && preset.icon) || '📝';
    thumb.classList.remove('has-image');
    thumbImg.removeAttribute('src');

    if (!preset) return;

    if (preset._loadedSrc) {
      thumbImg.src = preset._loadedSrc;
      thumbImg.alt = preset.name + ' の仕上がり例';
      thumb.classList.add('has-image');
    } else {
      loadPresetImage(preset, thumbImg, function (src) {
        preset._loadedSrc = src;
        thumb.classList.add('has-image');
      }, function () {
        thumbImg.removeAttribute('src');
      });
    }
  }

  function renderConfirmSpecs(state) {
    var specs = document.getElementById('confirmSpecs');
    specs.innerHTML = '';
    buildSpecPairsFromState(state).forEach(function (pair) {
      specs.appendChild(el('dt', null, pair.label));
      specs.appendChild(el('dd', null, pair.value));
    });
  }

  function showConfirmForPreset(preset) {
    confirmState = createState(template.defaults, preset.values);
    confirmReturnTo = 'presetStep';

    document.getElementById('confirmName').textContent =
      preset.icon ? preset.icon + ' ' + preset.name : preset.name;
    document.getElementById('confirmDesc').textContent = preset.description || '';
    applyConfirmThumb(preset);
    renderConfirmSpecs(confirmState);

    show('confirmStep');
  }

  function showConfirmForManualState(state) {
    confirmState = state;
    confirmReturnTo = 'advancedStep';

    document.getElementById('confirmName').textContent = '自分で決めた設定';
    document.getElementById('confirmDesc').textContent = '';
    applyConfirmThumb(null);
    renderConfirmSpecs(confirmState);

    show('confirmStep');
  }

  function copyConfirmState(button) {
    if (!confirmState || !template) return;
    var text = template.build(confirmState);

    ImageWorkflow.writeClipboard(text, function (ok) {
      button.textContent = ok ? '✅ コピーできました' : 'コピーできませんでした';
      if (ok) {
        document.getElementById('companionEyebrow').textContent = 'おつかれさまでした';
        document.getElementById('companionMessage').textContent =
          '指示書の準備は完了です。CodexやClaudeへ貼り付ければ、ここから先も一緒に制作できます。';
      }
      setTimeout(function () {
        button.textContent = 'この内容でコピーする';
      }, 1800);
    });
  }

  function validProjectName(value) {
    return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value);
  }

  function buildOriginalPrompt(projectName) {
    return [
      'これからオリジナルLPを制作します。今回は制作環境の準備だけを行い、LP本体の実装にはまだ進まないでください。',
      '',
      'プロジェクト名: ' + projectName,
      '',
      '次のタスクを上から順番に実行してください。',
      '1. 「' + projectName + '」フォルダを作成し、その中へ移動する。',
      '2. Gitを初期化し、mainブランチを用意する。',
      '3. brief / content / design / assets/images / src / workflow の各フォルダを作る。',
      '4. AGENTS.md、CLAUDE.md、workflow/progress.yml、workflow/decisions.md、workflow/qa-checklist.mdを作る。',
      '5. GitHubに「' + projectName + '」という公開リポジトリを作る。すでに存在する場合は上書きせず報告する。',
      '6. ローカルをGitHubのリポジトリへ接続し、最初のコミットをmainへpushする。',
      '7. progress.ymlでは「制作環境の準備」だけをcompletedにし、それ以降はpendingにする。',
      '',
      '安全ルール:',
      '- 既存ファイルや既存リポジトリを削除・上書きしない。',
      '- GitHub認証やリポジトリ公開範囲の確認が必要なら、勝手に決めず質問する。',
      '- 各タスクの結果を確認してから次へ進む。',
      '',
      '完了したら、フォルダの場所、GitHubリポジトリURL、最初のコミットIDを示し、',
      '最後に「フォルダとリポジトリの準備ができました」と報告してください。'
    ].join('\n');
  }

  function updateOriginalSetup() {
    var input = document.getElementById('projectName');
    var prompt = document.getElementById('originalPrompt');
    var copyButton = document.getElementById('originalPrepareCopy');
    var ready = document.getElementById('originalReady');
    var next = document.getElementById('originalNext');
    var hint = document.getElementById('projectNameHint');
    if (!input || !prompt || !copyButton || !ready || !next) return;

    var projectName = input.value.trim().toLowerCase();
    var valid = validProjectName(projectName);
    prompt.textContent = valid
      ? buildOriginalPrompt(projectName)
      : 'プロジェクト名を入力すると、ここにCodex・Claude共通の準備指示書が表示されます。';
    copyButton.disabled = !valid;
    ready.disabled = !valid;
    next.disabled = !valid || !ready.checked;
    input.setAttribute('aria-invalid', input.value && !valid ? 'true' : 'false');
    if (hint) {
      hint.textContent = input.value && !valid
        ? '半角英数字とハイフンで、2文字以上にしてください。例：mochi-cafe-lp'
        : '半角英数字とハイフンがおすすめです。あとから変更できます。';
    }
  }

  function init() {
    var presetBtn = document.getElementById('choicePreset');
    var manualBtn = document.getElementById('choiceManual');
    var originalBtn = document.getElementById('choiceOriginal');
    var originalNameInput = document.getElementById('projectName');
    var originalCopyBtn = document.getElementById('originalPrepareCopy');
    var originalReady = document.getElementById('originalReady');
    var originalNextBtn = document.getElementById('originalNext');
    var originalBackBtn = document.getElementById('originalBack');
    var restartBtn = document.getElementById('restartFlow');
    var folderCopyBtn = document.getElementById('folderCopy');
    var folderDoneBtn = document.getElementById('folderDone');
    var confirmCopyBtn = document.getElementById('confirmCopy');
    var confirmBackBtn = document.getElementById('confirmBack');
    var basicNextBtn = document.getElementById('basicNext');
    var basicBackBtn = document.getElementById('basicBack');
    var imageNextBtn = document.getElementById('imageNext');
    var imageBackBtn = document.getElementById('imageBack');
    var imageZipBtn = document.getElementById('v2ImageZip');
    var infoNextBtn = document.getElementById('infoNext');
    var infoBackBtn = document.getElementById('infoBack');
    var advancedNextBtn = document.getElementById('advancedNext');
    var advancedBackBtn = document.getElementById('advancedBack');

    if (presetBtn) {
      presetBtn.addEventListener('click', function () {
        currentRoute = 'preset';
        renderPresets();
        show('presetStep');
      });
    }
    if (manualBtn) {
      manualBtn.addEventListener('click', function () {
        currentRoute = 'manual';
        renderBasicFields();
        show('basicStep');
      });
    }
    if (originalBtn) {
      originalBtn.addEventListener('click', function () {
        currentRoute = 'original';
        updateOriginalSetup();
        show('originalStep');
      });
    }
    if (originalNameInput) {
      originalNameInput.addEventListener('input', function () {
        // 名前を変えたら、以前のリポジトリに対する完了チェックは無効にする。
        if (originalReady) originalReady.checked = false;
        updateOriginalSetup();
      });
    }
    if (originalReady) {
      originalReady.addEventListener('change', updateOriginalSetup);
    }
    if (originalCopyBtn) {
      originalCopyBtn.addEventListener('click', function () {
        var prompt = document.getElementById('originalPrompt').textContent;
        ImageWorkflow.writeClipboard(prompt, function (ok) {
          originalCopyBtn.textContent = ok ? '✅ コピーしました' : 'コピーできませんでした';
          setTimeout(function () { originalCopyBtn.textContent = '指示書をコピー'; }, 1800);
        });
      });
    }
    if (originalNextBtn) {
      originalNextBtn.addEventListener('click', function () {
        if (originalNextBtn.disabled) return;
        renderBasicFields();
        show('basicStep');
      });
    }
    if (originalBackBtn) {
      originalBackBtn.addEventListener('click', function () {
        currentRoute = 'entry';
        show('entryStep');
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        currentRoute = 'entry';
        show('entryStep');
      });
    }
    if (confirmCopyBtn) {
      confirmCopyBtn.addEventListener('click', function () {
        copyConfirmState(confirmCopyBtn);
      });
    }
    if (confirmBackBtn) {
      confirmBackBtn.addEventListener('click', function () {
        show(confirmReturnTo);
      });
    }
    if (basicNextBtn) {
      basicNextBtn.addEventListener('click', function () {
        // template が画像スロットを持つときだけ②へ。持たなければ③掲載情報へ直接進む。
        if (typeof template.imageSlots === 'function') {
          renderImageStep();
          show('imageStep');
        } else {
          renderInfoFields();
          show('infoStep');
        }
      });
    }
    if (basicBackBtn) {
      basicBackBtn.addEventListener('click', function () {
        show(currentRoute === 'original' ? 'originalStep' : 'entryStep');
      });
    }
    if (imageNextBtn) {
      imageNextBtn.addEventListener('click', function () {
        renderInfoFields();
        show('infoStep');
      });
    }
    if (imageBackBtn) {
      imageBackBtn.addEventListener('click', function () {
        show('basicStep');
      });
    }
    if (infoNextBtn) {
      infoNextBtn.addEventListener('click', function () {
        renderAdvancedFields();
        show('advancedStep');
      });
    }
    if (infoBackBtn) {
      infoBackBtn.addEventListener('click', function () {
        show(typeof template.imageSlots === 'function' ? 'imageStep' : 'basicStep');
      });
    }
    if (advancedNextBtn) {
      advancedNextBtn.addEventListener('click', function () {
        showConfirmForManualState(createState(manualState));
      });
    }
    if (advancedBackBtn) {
      advancedBackBtn.addEventListener('click', function () {
        show('infoStep');
      });
    }
    if (imageZipBtn) {
      imageZipBtn.addEventListener('click', function () {
        var ok = ImageWorkflow.downloadImagesZip(manualImages, 'lp-images.zip');
        imageZipBtn.textContent = ok ? '✅ 書き出しました' : '先に画像をセットしてね';
        setTimeout(function () { imageZipBtn.textContent = '🗂 画像を書き出す（zip）'; }, 1800);
      });
    }

    // ステップ0：フォルダ準備。コピーは失敗しても致命的ではないので、
    // クリップボードAPIが使えない環境でも次へ進めることだけは保証する。
    if (folderCopyBtn) {
      folderCopyBtn.addEventListener('click', function () {
        var text = document.getElementById('folderPrompt').textContent;
        ImageWorkflow.writeClipboard(text, function (ok) {
          folderCopyBtn.textContent = ok ? '✅ コピーしました' : 'コピーできませんでした';
          setTimeout(function () {
            folderCopyBtn.textContent = 'コピーする';
          }, 1800);
        });
      });
    }
    if (folderDoneBtn) {
      folderDoneBtn.addEventListener('click', function () {
        show(folderReturnTo);
      });
    }

    // フッターの「公開用の準備（任意）」から、いつでもフォルダ準備画面を開ける。
    var openFolderBtn = document.getElementById('openFolderStep');
    if (openFolderBtn) {
      openFolderBtn.addEventListener('click', function (e) {
        e.preventDefault();
        folderReturnTo = currentStep();
        show('folderStep');
      });
    }

    updateOriginalSetup();
    show('entryStep');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
