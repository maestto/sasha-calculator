const REMOVE_ANIMATION_MS = 160;
const SWIPE_DELETE_THRESHOLD = 40;
const SWIPE_DELETE_MAX = 96;
const SHEET_CLOSE_THRESHOLD = 84;
const SHEET_CLOSE_VELOCITY = 900;

function createRuleRow({ from = 0, to = null, percent = 0 }, formatNumber) {
  const row = document.createElement('div');
  row.className = 'rule-row';

  const fromInput = document.createElement('input');
  fromInput.type = 'text';
  fromInput.inputMode = 'numeric';
  fromInput.className = 'rule-input';
  fromInput.dataset.field = 'from';
  fromInput.placeholder = '0';
  fromInput.value = formatNumber(from);

  const toInput = document.createElement('input');
  toInput.type = 'text';
  toInput.inputMode = 'numeric';
  toInput.className = 'rule-input';
  toInput.dataset.field = 'to';
  toInput.placeholder = '∞';
  toInput.value = to === null ? '' : formatNumber(to);

  const percentInput = document.createElement('input');
  percentInput.type = 'text';
  percentInput.inputMode = 'decimal';
  percentInput.className = 'percent-input';
  percentInput.dataset.field = 'percent';
  percentInput.placeholder = '0';
  percentInput.value = String(percent).replace('.', ',');

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'rule-remove';
  removeButton.dataset.action = 'remove-rule';
  removeButton.textContent = '×';
  removeButton.setAttribute('aria-label', 'Удалить правило');

  row.append(fromInput, toInput, percentInput, removeButton);
  return row;
}

function focusInput(inputElement) {
  requestAnimationFrame(() => {
    inputElement.focus();
  });
}

function parseIntegerInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) {
    return Number.NaN;
  }

  return Number(digits);
}

function syncRuleRemoveButtons(rulesListElement) {
  const rows = [...rulesListElement.querySelectorAll('.rule-row')];
  const isSingleRule = rows.length <= 1;

  rows.forEach((row) => {
    const removeButton = row.querySelector('.rule-remove');

    if (!(removeButton instanceof HTMLButtonElement)) {
      return;
    }

    removeButton.disabled = isSingleRule;
    removeButton.setAttribute('aria-disabled', String(isSingleRule));
  });
}

function pulseMetric(element) {
  if (!element) {
    return;
  }

  element.classList.remove('is-updated');
  void element.offsetWidth;
  element.classList.add('is-updated');

  window.setTimeout(() => {
    element.classList.remove('is-updated');
  }, 280);
}

function setMetricText(element, nextText) {
  if (!element) {
    return;
  }

  const hasChanged = element.textContent !== nextText;
  element.textContent = nextText;

  if (hasChanged) {
    pulseMetric(element);
  }
}

function setupSwipeToDelete({ item, onCommit }) {
  let pointerId = null;
  let touchActive = false;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let axis = null;

  const resetItemPosition = () => {
    item.style.transform = '';
    item.classList.remove('is-swipe-ready');
  };

  const handleMove = (moveX, moveY) => {
    if (axis === null) {
      if (Math.abs(moveX) < 6 && Math.abs(moveY) < 6) {
        return { isHorizontal: false, cancelGesture: false };
      }

      const horizontalIntent = Math.abs(moveX) >= Math.abs(moveY) * 0.55;
      axis = horizontalIntent ? 'x' : 'y';

      if (axis === 'y') {
        return { isHorizontal: false, cancelGesture: true };
      }
    }

    if (axis !== 'x') {
      return { isHorizontal: false, cancelGesture: false };
    }

    deltaX = Math.max(-SWIPE_DELETE_MAX, Math.min(0, moveX));
    item.style.transform = `translateX(${deltaX}px)`;
    item.classList.toggle('is-swipe-ready', deltaX <= -SWIPE_DELETE_THRESHOLD);

    return { isHorizontal: true, cancelGesture: false };
  };

  const finishGesture = () => {
    const shouldRemove = deltaX <= -SWIPE_DELETE_THRESHOLD;

    pointerId = null;
    touchActive = false;
    deltaX = 0;
    axis = null;

    if (shouldRemove) {
      resetItemPosition();
      onCommit();
      return;
    }

    resetItemPosition();
  };

  if ('PointerEvent' in window) {
    item.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      if (event.target instanceof HTMLElement && event.target.closest('.delete-btn')) {
        return;
      }

      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      deltaX = 0;
      axis = null;
    });

    item.addEventListener('pointermove', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }

      const moveX = event.clientX - startX;
      const moveY = event.clientY - startY;
      const moveState = handleMove(moveX, moveY);

      if (moveState.cancelGesture) {
        pointerId = null;
        deltaX = 0;
        axis = null;
        resetItemPosition();
        return;
      }

      if (moveState.isHorizontal) {
        event.preventDefault();
      }
    });

    const onPointerDone = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }

      finishGesture();
    };

    item.addEventListener('pointerup', onPointerDone);
    item.addEventListener('pointercancel', onPointerDone);
  }

  item.addEventListener('touchstart', (event) => {
    if (pointerId !== null) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest('.delete-btn')) {
      return;
    }

    touchActive = true;
    startX = touch.clientX;
    startY = touch.clientY;
    deltaX = 0;
    axis = null;
  }, { passive: true });

  item.addEventListener('touchmove', (event) => {
    if (!touchActive || pointerId !== null) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    const moveX = touch.clientX - startX;
    const moveY = touch.clientY - startY;
    const moveState = handleMove(moveX, moveY);

    if (moveState.cancelGesture) {
      touchActive = false;
      deltaX = 0;
      axis = null;
      resetItemPosition();
      return;
    }

    if (moveState.isHorizontal) {
      event.preventDefault();
    }
  }, { passive: false });

  const onTouchDone = () => {
    if (!touchActive) {
      return;
    }

    finishGesture();
  };

  item.addEventListener('touchend', onTouchDone);
  item.addEventListener('touchcancel', onTouchDone);
}

function bindSheetSwipeClose(sheetElement, onCloseSheet) {
  const panel = sheetElement.querySelector('.sheet-panel');

  if (!panel) {
    return;
  }

  let pointerId = null;
  let touchActive = false;
  let startY = 0;
  let startX = 0;
  let startTime = 0;
  let deltaY = 0;

  const clearDragState = () => {
    sheetElement.classList.remove('is-dragging');
    panel.style.transform = '';
    pointerId = null;
    deltaY = 0;
  };

  const canStartDrag = (target) => {
    if (!sheetElement.classList.contains('is-open')) {
      return false;
    }

    if (!(target instanceof Element)) {
      return false;
    }

    if (target.closest('.sheet-close')) {
      return false;
    }

    return Boolean(target.closest('.sheet-handle, .sheet-header'));
  };

  const beginDrag = (clientX, clientY) => {
    startY = clientY;
    startX = clientX;
    startTime = performance.now();
    deltaY = 0;
    sheetElement.classList.add('is-dragging');
  };

  const moveDrag = (clientX, clientY) => {
    const horizontalDelta = Math.abs(clientX - startX);
    const verticalDelta = clientY - startY;

    if (horizontalDelta > Math.abs(verticalDelta)) {
      return false;
    }

    deltaY = Math.max(0, verticalDelta);
    panel.style.transform = `translateY(${deltaY}px)`;
    return true;
  };

  const endDrag = () => {
    const elapsedMs = Math.max(performance.now() - startTime, 1);
    const velocity = (deltaY / elapsedMs) * 1000;
    const shouldClose = deltaY >= SHEET_CLOSE_THRESHOLD || velocity >= SHEET_CLOSE_VELOCITY;

    clearDragState();

    if (shouldClose) {
      onCloseSheet();
    }
  };

  if ('PointerEvent' in window) {
    panel.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      if (!canStartDrag(event.target)) {
        return;
      }

      pointerId = event.pointerId;
      beginDrag(event.clientX, event.clientY);
      panel.setPointerCapture?.(pointerId);
    });

    panel.addEventListener('pointermove', (event) => {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }

      const isDraggingVertically = moveDrag(event.clientX, event.clientY);

      if (isDraggingVertically) {
        event.preventDefault();
      }
    });

    const onPointerEnd = (event) => {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }

      endDrag();
    };

    panel.addEventListener('pointerup', onPointerEnd);
    panel.addEventListener('pointercancel', onPointerEnd);
  }

  panel.addEventListener('touchstart', (event) => {
    if (pointerId !== null) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    if (!canStartDrag(event.target)) {
      return;
    }

    touchActive = true;
    beginDrag(touch.clientX, touch.clientY);
  }, { passive: true });

  panel.addEventListener('touchmove', (event) => {
    if (!touchActive || pointerId !== null) {
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    const isDraggingVertically = moveDrag(touch.clientX, touch.clientY);

    if (isDraggingVertically) {
      event.preventDefault();
    }
  }, { passive: false });

  const onTouchEnd = () => {
    if (!touchActive) {
      return;
    }

    touchActive = false;
    endDrag();
  };

  panel.addEventListener('touchend', onTouchEnd);
  panel.addEventListener('touchcancel', onTouchEnd);
}

export function renderList({
  shiftListElement,
  cashValues,
  percentRules,
  getPercentForAmount,
  formatCurrency,
  formatPercent,
  onRemove,
  lastAddedIndex = -1
}) {
  const fragment = document.createDocumentFragment();

  cashValues.forEach((amount, index) => {
    const item = document.createElement('li');
    item.className = `shift-item${index === lastAddedIndex ? ' is-adding' : ''}`;

    const shiftMain = document.createElement('div');
    shiftMain.className = 'shift-main';

    const value = document.createElement('span');
    value.className = 'shift-value';
    value.textContent = formatCurrency(amount);

    const meta = document.createElement('span');
    meta.className = 'shift-meta';
    meta.textContent = `Смена ${index + 1} · ${formatPercent(getPercentForAmount(amount, percentRules))}`;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'delete-btn';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', `Удалить смену ${index + 1}`);

    const commitRemove = () => {
      if (shiftListElement.dataset.removeLock === '1') {
        return;
      }

      if (item.classList.contains('is-removing')) {
        return;
      }

      shiftListElement.dataset.removeLock = '1';
      item.classList.add('is-removing');

      window.setTimeout(() => {
        onRemove(index);
        shiftListElement.dataset.removeLock = '0';
      }, REMOVE_ANIMATION_MS);
    };

    removeButton.addEventListener('click', commitRemove);
    setupSwipeToDelete({ item, onCommit: commitRemove });

    shiftMain.append(value, meta);
    item.append(shiftMain, removeButton);
    fragment.append(item);
  });

  shiftListElement.replaceChildren(fragment);
}

export function renderTotals({
  totals,
  formatCurrency,
  elements
}) {
  const shiftCountText = String(totals.shiftsCount);
  const cashText = formatCurrency(totals.totalCash);
  const salaryText = formatCurrency(totals.salary);
  const percentPartText = formatCurrency(totals.percentPart);
  const fixedPartText = formatCurrency(totals.fixedPart);

  setMetricText(elements.shiftCountElement, shiftCountText);
  setMetricText(elements.cashTotalElement, cashText);
  setMetricText(elements.salaryTotalElement, salaryText);
  setMetricText(elements.percentPartElement, percentPartText);
  setMetricText(elements.fixedPartElement, fixedPartText);
  elements.clearButton.disabled = totals.shiftsCount === 0;
}

export function renderSettingsRules({ rulesListElement, rules, formatNumber }) {
  const fragment = document.createDocumentFragment();

  rules.forEach((rule) => {
    fragment.append(createRuleRow(rule, formatNumber));
  });

  if (rules.length === 0) {
    fragment.append(createRuleRow({ from: 0, to: null, percent: 3 }, formatNumber));
  }

  rulesListElement.replaceChildren(fragment);
  syncRuleRemoveButtons(rulesListElement);
}

export function renderRulesError({ rulesErrorElement, message = '' }) {
  if (!rulesErrorElement) {
    return;
  }

  if (!message) {
    rulesErrorElement.textContent = '';
    rulesErrorElement.hidden = true;
    return;
  }

  rulesErrorElement.textContent = message;
  rulesErrorElement.hidden = false;
}

export function readSettingsForm({
  rulesListElement,
  fixedPerShiftInputElement,
  userNameInputElement,
  quickPadToggleInputElement,
  themeButtons
}) {
  const rows = [...rulesListElement.querySelectorAll('.rule-row')];

  const percentRules = rows
    .map((row) => {
      const fromInput = row.querySelector('[data-field="from"]');
      const toInput = row.querySelector('[data-field="to"]');
      const percentInput = row.querySelector('[data-field="percent"]');

      const from = fromInput ? fromInput.value : '';
      const to = toInput ? toInput.value : '';
      const percent = percentInput ? percentInput.value : '';

      if (!from.trim() && !to.trim() && !percent.trim()) {
        return null;
      }

      return {
        from,
        to: to.trim() ? to : null,
        percent
      };
    })
    .filter(Boolean);

  const activeThemeButton = themeButtons.find((button) => button.classList.contains('is-active'));
  const theme = activeThemeButton?.dataset.theme ?? 'light';

  return {
    percentRules,
    fixedPerShift: fixedPerShiftInputElement.value,
    userName: userNameInputElement.value,
    showQuickPad: Boolean(quickPadToggleInputElement?.checked),
    theme
  };
}

export function bindEvents({
  elements,
  handlers,
  formatters
}) {
  const {
    cashForm,
    cashInput,
    clearButton,
    settingsButton,
    exportButton,
    sheetBackdrop,
    settingsSheet,
    exportSheet,
    sheetCloseButtons,
    addRuleButton,
    rulesListElement,
    fixedPerShiftInputElement,
    userNameInputElement,
    quickPadToggleInputElement,
    themeButtons,
    saveSettingsButton,
    nativeShareButton,
    copyPreviewButton,
    downloadTxtButton,
    downloadCsvButton,
    presetButtons,
    undoButton
  } = elements;

  const {
    formatInputAsGroupedInteger,
    sanitizePercentInput
  } = formatters;

  cashInput.addEventListener('input', () => {
    formatInputAsGroupedInteger(cashInput);
  });

  cashForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const isAdded = handlers.onAddCash(cashInput.value);
    cashInput.value = '';

    if (!handlers.isSheetOpen()) {
      focusInput(cashInput);
    }

    if (!isAdded) {
      return;
    }
  });

  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.preset);

      if (!Number.isFinite(value)) {
        return;
      }

      handlers.onPresetCash(value);
      focusInput(cashInput);
    });
  });

  clearButton.addEventListener('click', handlers.onClearCash);
  settingsButton.addEventListener('click', handlers.onOpenSettings);
  exportButton.addEventListener('click', handlers.onOpenExport);
  sheetBackdrop.addEventListener('click', handlers.onCloseSheet);

  bindSheetSwipeClose(settingsSheet, handlers.onCloseSheet);
  bindSheetSwipeClose(exportSheet, handlers.onCloseSheet);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      handlers.onCloseSheet();
    }
  });

  sheetCloseButtons.forEach((button) => {
    button.addEventListener('click', handlers.onCloseSheet);
  });

  addRuleButton.addEventListener('click', () => {
    const ruleRows = [...rulesListElement.querySelectorAll('.rule-row')];
    const lastRow = ruleRows[ruleRows.length - 1];

    let nextFrom = 0;

    if (lastRow) {
      const fromInput = lastRow.querySelector('[data-field="from"]');
      const toInput = lastRow.querySelector('[data-field="to"]');
      const fromValue = parseIntegerInput(fromInput?.value);
      const toValue = parseIntegerInput(toInput?.value);

      if (Number.isFinite(toValue) && toValue >= 0) {
        nextFrom = toValue;
      } else if (Number.isFinite(fromValue) && fromValue >= 0) {
        const inferredTo = fromValue + 1000;

        if (toInput instanceof HTMLInputElement) {
          toInput.value = formatters.formatNumber(inferredTo);
        }

        nextFrom = inferredTo;
      }
    }

    const ruleRow = createRuleRow({ from: nextFrom, to: null, percent: 0 }, formatters.formatNumber);
    rulesListElement.append(ruleRow);
    syncRuleRemoveButtons(rulesListElement);
    handlers.onSettingsInput?.();
  });

  fixedPerShiftInputElement.addEventListener('input', () => {
    formatInputAsGroupedInteger(fixedPerShiftInputElement);
    handlers.onSettingsInput?.();
  });

  userNameInputElement.addEventListener('input', () => {
    handlers.onSettingsInput?.();
  });

  quickPadToggleInputElement.addEventListener('change', () => {
    handlers.onSettingsInput?.();
  });

  themeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextTheme = button.dataset.theme;

      if (!nextTheme) {
        return;
      }

      themeButtons.forEach((item) => {
        item.classList.toggle('is-active', item === button);
      });

      handlers.onThemePreview?.(nextTheme);
      handlers.onSettingsInput?.();
    });
  });

  rulesListElement.addEventListener('input', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.classList.contains('rule-input')) {
      formatInputAsGroupedInteger(target);
      handlers.onSettingsInput?.();
      return;
    }

    if (target.classList.contains('percent-input')) {
      target.value = sanitizePercentInput(target.value);
      handlers.onSettingsInput?.();
    }
  });

  rulesListElement.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (!target.matches('[data-action="remove-rule"]')) {
      return;
    }

    const row = target.closest('.rule-row');

    if (target instanceof HTMLButtonElement && target.disabled) {
      return;
    }

    if (row && rulesListElement.children.length > 1) {
      row.remove();
      handlers.onSettingsInput?.();
    }

    if (rulesListElement.children.length === 0) {
      rulesListElement.append(createRuleRow({ from: 0, to: null, percent: 3 }, formatters.formatNumber));
    }

    syncRuleRemoveButtons(rulesListElement);
  });

  saveSettingsButton.addEventListener('click', () => {
    const rawSettings = readSettingsForm({
      rulesListElement,
      fixedPerShiftInputElement,
      userNameInputElement,
      quickPadToggleInputElement,
      themeButtons
    });

    handlers.onSaveSettings(rawSettings);
  });

  nativeShareButton.addEventListener('click', handlers.onNativeShare);
  copyPreviewButton.addEventListener('click', handlers.onCopyPreview);
  downloadTxtButton.addEventListener('click', handlers.onDownloadTxt);
  downloadCsvButton.addEventListener('click', handlers.onDownloadCsv);
  undoButton.addEventListener('click', handlers.onUndoRemove);

  focusInput(cashInput);
}
