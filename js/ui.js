const REMOVE_ANIMATION_MS = 160;

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
    meta.textContent = formatPercent(getPercentForAmount(amount, percentRules));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'delete-btn';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', `Удалить смену ${index + 1}`);

    removeButton.addEventListener('click', () => {
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
    });

    shiftMain.append(value, meta);
    item.append(shiftMain, removeButton);
    fragment.append(item);
  });

  shiftListElement.replaceChildren(fragment);
}

export function renderTotals({
  totals,
  settings,
  formatCurrency,
  elements
}) {
  elements.shiftCountElement.textContent = String(totals.shiftsCount);
  elements.cashTotalElement.textContent = formatCurrency(totals.totalCash);
  elements.salaryTotalElement.textContent = formatCurrency(totals.salary);
  elements.fixedInfoElement.textContent = `Фикс: ${formatCurrency(settings.fixedPerShift)} / смена`;
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
}

export function readSettingsForm({
  rulesListElement,
  fixedPerShiftInputElement,
  userNameInputElement
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

  return {
    percentRules,
    fixedPerShift: fixedPerShiftInputElement.value,
    userName: userNameInputElement.value
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
    sheetCloseButtons,
    addRuleButton,
    rulesListElement,
    fixedPerShiftInputElement,
    userNameInputElement,
    saveSettingsButton,
    copyExportButton,
    downloadTxtButton,
    downloadCsvButton,
    telegramExportButton
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

  clearButton.addEventListener('click', handlers.onClearCash);
  settingsButton.addEventListener('click', handlers.onOpenSettings);
  exportButton.addEventListener('click', handlers.onOpenExport);
  sheetBackdrop.addEventListener('click', handlers.onCloseSheet);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      handlers.onCloseSheet();
    }
  });

  sheetCloseButtons.forEach((button) => {
    button.addEventListener('click', handlers.onCloseSheet);
  });

  addRuleButton.addEventListener('click', () => {
    const ruleRow = createRuleRow({ from: 0, to: null, percent: 0 }, formatters.formatNumber);
    rulesListElement.append(ruleRow);
  });

  fixedPerShiftInputElement.addEventListener('input', () => {
    formatInputAsGroupedInteger(fixedPerShiftInputElement);
  });

  rulesListElement.addEventListener('input', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.classList.contains('rule-input')) {
      formatInputAsGroupedInteger(target);
      return;
    }

    if (target.classList.contains('percent-input')) {
      target.value = sanitizePercentInput(target.value);
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
    if (row) {
      row.remove();
    }

    if (rulesListElement.children.length === 0) {
      rulesListElement.append(createRuleRow({ from: 0, to: null, percent: 3 }, formatters.formatNumber));
    }
  });

  saveSettingsButton.addEventListener('click', () => {
    const rawSettings = readSettingsForm({
      rulesListElement,
      fixedPerShiftInputElement,
      userNameInputElement
    });

    handlers.onSaveSettings(rawSettings);
  });

  copyExportButton.addEventListener('click', handlers.onCopyExport);
  downloadTxtButton.addEventListener('click', handlers.onDownloadTxt);
  downloadCsvButton.addEventListener('click', handlers.onDownloadCsv);
  telegramExportButton.addEventListener('click', handlers.onTelegramExport);

  focusInput(cashInput);
}
