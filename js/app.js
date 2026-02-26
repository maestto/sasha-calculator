import { calculateSalary, getPercentForAmount } from './calculator.js';
import { saveCashValues, loadCashValues, saveSettings, loadSettings } from './storage.js';
import {
  getSettings,
  setSettings,
  normalizeSettings,
  validatePercentRules
} from './settings.js';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  parseCurrency,
  formatInputAsGroupedInteger,
  sanitizePercentInput
} from './format.js';
import {
  renderList,
  renderTotals,
  renderSettingsRules,
  renderRulesError,
  bindEvents
} from './ui.js';
import {
  exportTXT,
  exportCSV,
  copyText,
  downloadFile
} from './export.js';

const SHEET_TRANSITION_MS = 240;
const UNDO_TIMEOUT_MS = 4200;
const TOAST_TRANSITION_MS = 180;
const LIST_GAP_PX = 10;
let bottomStackSyncFrame = 0;
let fixedStackObserver = null;

const THEME_META_COLORS = {
  light: '#f4f8ff',
  dark: '#121316'
};

const state = {
  cashValues: [],
  settings: getSettings(),
  lastAddedIndex: -1,
  activeSheet: null,
  pendingUndo: null
};

const elements = {
  cashForm: document.getElementById('cashForm'),
  cashInput: document.getElementById('cashInput'),
  shiftList: document.getElementById('shiftList'),
  fixedStack: document.getElementById('fixedStack'),
  shiftCount: document.getElementById('shiftCount'),
  cashTotal: document.getElementById('cashTotal'),
  salaryTotal: document.getElementById('salaryTotal'),
  percentPart: document.getElementById('percentPart'),
  fixedPart: document.getElementById('fixedPart'),
  clearBtn: document.getElementById('clearBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  exportBtn: document.getElementById('exportBtn'),
  themeButtons: [...document.querySelectorAll('.theme-btn')],
  quickPad: document.getElementById('quickPad'),
  presetButtons: [...document.querySelectorAll('.preset-btn')],
  undoToast: document.getElementById('undoToast'),
  undoText: document.getElementById('undoText'),
  undoBtn: document.getElementById('undoBtn'),
  sheetBackdrop: document.getElementById('sheetBackdrop'),
  settingsSheet: document.getElementById('settingsSheet'),
  exportSheet: document.getElementById('exportSheet'),
  sheetCloseButtons: document.querySelectorAll('.sheet-close'),
  rulesList: document.getElementById('rulesList'),
  rulesError: document.getElementById('rulesError'),
  addRuleBtn: document.getElementById('addRuleBtn'),
  fixedPerShiftInput: document.getElementById('fixedPerShiftInput'),
  userNameInput: document.getElementById('userNameInput'),
  quickPadToggle: document.getElementById('quickPadToggle'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  exportPreview: document.getElementById('exportPreview'),
  exportPreviewCopyBtn: document.getElementById('exportPreviewCopyBtn'),
  nativeShareBtn: document.getElementById('nativeShareBtn'),
  exportFallback: document.getElementById('exportFallback'),
  downloadTxtBtn: document.getElementById('downloadTxtBtn'),
  downloadCsvBtn: document.getElementById('downloadCsvBtn'),
  themeColorMeta: document.querySelector('meta[name="theme-color"]')
};

function triggerHaptic(type = 'light') {
  if (!('vibrate' in navigator)) {
    return;
  }

  if (type === 'success') {
    navigator.vibrate([12, 24, 14]);
    return;
  }

  if (type === 'warning') {
    navigator.vibrate(18);
    return;
  }

  navigator.vibrate(8);
}

function getTotals() {
  return calculateSalary(state.cashValues, state.settings);
}

function getExportPayload() {
  return {
    cashValues: state.cashValues,
    totals: getTotals(),
    userName: state.settings.userName,
    exportDate: new Date()
  };
}

function updateExportPreview() {
  elements.exportPreview.value = exportTXT(getExportPayload());
}

function applyTheme(themeName = 'light') {
  const theme = themeName === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;

  if (elements.themeColorMeta) {
    elements.themeColorMeta.setAttribute('content', THEME_META_COLORS[theme]);
  }
}

function syncBottomStackSpace() {
  if (!elements.fixedStack) {
    return;
  }

  const stackHeight = Math.ceil(elements.fixedStack.getBoundingClientRect().height);
  const contentBottomSpace = Math.max(stackHeight + LIST_GAP_PX, 0);

  document.documentElement.style.setProperty('--bottom-stack-space', `${contentBottomSpace}px`);
  document.documentElement.style.setProperty('--toast-offset', `${stackHeight + 12}px`);
}

function scheduleBottomStackSpaceSync() {
  if (bottomStackSyncFrame) {
    window.cancelAnimationFrame(bottomStackSyncFrame);
  }

  bottomStackSyncFrame = window.requestAnimationFrame(() => {
    bottomStackSyncFrame = 0;
    syncBottomStackSpace();
  });
}

function renderApp() {
  applyTheme(state.settings.theme);
  document.documentElement.dataset.showQuickPad = state.settings.showQuickPad ? '1' : '0';

  renderList({
    shiftListElement: elements.shiftList,
    cashValues: state.cashValues,
    percentRules: state.settings.percentRules,
    getPercentForAmount,
    formatCurrency,
    formatPercent,
    onRemove: removeCash,
    lastAddedIndex: state.lastAddedIndex
  });

  renderTotals({
    totals: getTotals(),
    formatCurrency,
    elements: {
      shiftCountElement: elements.shiftCount,
      cashTotalElement: elements.cashTotal,
      salaryTotalElement: elements.salaryTotal,
      percentPartElement: elements.percentPart,
      fixedPartElement: elements.fixedPart,
      clearButton: elements.clearBtn
    }
  });

  updateExportPreview();
  state.lastAddedIndex = -1;
  scheduleBottomStackSpaceSync();
}

function focusCashInput() {
  if (state.activeSheet) {
    return;
  }

  requestAnimationFrame(() => {
    elements.cashInput.focus();
  });
}

function clearSettingsError() {
  renderRulesError({ rulesErrorElement: elements.rulesError, message: '' });
}

function setSettingsError(message) {
  renderRulesError({ rulesErrorElement: elements.rulesError, message });
}

function setExportFallbackVisible(isVisible) {
  if (!elements.exportFallback) {
    return;
  }

  elements.exportFallback.hidden = !isVisible;
}

function setSheetVisibility(sheet, isVisible) {
  if (!sheet) {
    return;
  }

  const panel = sheet.querySelector('.sheet-panel');

  if (panel) {
    panel.style.transform = '';
  }

  sheet.classList.remove('is-dragging');

  if (isVisible) {
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
      sheet.classList.add('is-open');
    });

    return;
  }

  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');

  window.setTimeout(() => {
    if (state.activeSheet !== sheet) {
      sheet.hidden = true;
    }
  }, SHEET_TRANSITION_MS);
}

function openSheet(sheet) {
  if (state.activeSheet === sheet) {
    return;
  }

  if (state.activeSheet) {
    setSheetVisibility(state.activeSheet, false);
  }

  state.activeSheet = sheet;
  elements.sheetBackdrop.hidden = false;
  document.documentElement.style.overflow = 'hidden';

  setSheetVisibility(sheet, true);

  requestAnimationFrame(() => {
    elements.sheetBackdrop.classList.add('is-open');
  });
}

function closeSheet() {
  if (!state.activeSheet) {
    return;
  }

  const closingSheet = state.activeSheet;
  state.activeSheet = null;

  if (closingSheet === elements.settingsSheet) {
    applyTheme(state.settings.theme);
  }

  setSheetVisibility(closingSheet, false);
  elements.sheetBackdrop.classList.remove('is-open');

  window.setTimeout(() => {
    if (!state.activeSheet) {
      elements.sheetBackdrop.hidden = true;
      document.documentElement.style.overflow = '';
      focusCashInput();
    }
  }, SHEET_TRANSITION_MS);
}

function hideUndoToast() {
  elements.undoToast.classList.remove('is-open');

  window.setTimeout(() => {
    if (!elements.undoToast.classList.contains('is-open')) {
      elements.undoToast.hidden = true;
    }
  }, TOAST_TRANSITION_MS);
}

function clearUndoState() {
  if (state.pendingUndo?.timeoutId) {
    window.clearTimeout(state.pendingUndo.timeoutId);
  }

  state.pendingUndo = null;
  hideUndoToast();
}

function showUndoToast(message) {
  elements.undoText.textContent = message;
  elements.undoToast.hidden = false;

  requestAnimationFrame(() => {
    elements.undoToast.classList.add('is-open');
  });
}

function addCash(rawValue) {
  const amount = parseCurrency(rawValue);

  if (!Number.isFinite(amount) || amount < 0) {
    return false;
  }

  state.cashValues.push(amount);
  state.lastAddedIndex = state.cashValues.length - 1;

  saveCashValues(state.cashValues);
  renderApp();
  triggerHaptic('light');
  return true;
}

function applyPreset(amount) {
  if (!Number.isFinite(amount) || amount === 0) {
    return;
  }

  const currentValue = parseCurrency(elements.cashInput.value);
  const base = Number.isFinite(currentValue) && currentValue >= 0 ? currentValue : 0;
  const nextValue = Math.max(0, base + amount);

  elements.cashInput.value = nextValue > 0 ? formatNumber(nextValue) : '';
  triggerHaptic('light');
}

function removeCash(index) {
  if (index < 0 || index >= state.cashValues.length) {
    return;
  }

  const [removedValue] = state.cashValues.splice(index, 1);

  if (!Number.isFinite(removedValue)) {
    return;
  }

  saveCashValues(state.cashValues);
  renderApp();

  if (state.pendingUndo?.timeoutId) {
    window.clearTimeout(state.pendingUndo.timeoutId);
  }

  state.pendingUndo = {
    index,
    value: removedValue,
    timeoutId: window.setTimeout(() => {
      state.pendingUndo = null;
      hideUndoToast();
    }, UNDO_TIMEOUT_MS)
  };

  showUndoToast(`Удалено: ${formatCurrency(removedValue)}`);
  triggerHaptic('warning');
}

function undoRemove() {
  if (!state.pendingUndo) {
    return;
  }

  const { index, value, timeoutId } = state.pendingUndo;

  window.clearTimeout(timeoutId);
  state.pendingUndo = null;

  const insertionIndex = Math.min(Math.max(index, 0), state.cashValues.length);
  state.cashValues.splice(insertionIndex, 0, value);
  state.lastAddedIndex = insertionIndex;

  saveCashValues(state.cashValues);
  renderApp();
  hideUndoToast();
  triggerHaptic('success');
  focusCashInput();
}

function clearCash() {
  state.cashValues = [];
  saveCashValues(state.cashValues);
  renderApp();
  clearUndoState();
  focusCashInput();
  triggerHaptic('warning');
}

function openSettings() {
  clearSettingsError();

  renderSettingsRules({
    rulesListElement: elements.rulesList,
    rules: state.settings.percentRules,
    formatNumber
  });

  elements.fixedPerShiftInput.value = state.settings.fixedPerShift > 0
    ? formatNumber(state.settings.fixedPerShift)
    : '';
  elements.userNameInput.value = state.settings.userName;
  elements.quickPadToggle.checked = Boolean(state.settings.showQuickPad);
  elements.themeButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.theme === state.settings.theme);
  });

  openSheet(elements.settingsSheet);
}

function openExport() {
  setExportFallbackVisible(false);
  updateExportPreview();
  openSheet(elements.exportSheet);
}

function applySettings(rawSettings) {
  const normalizedSettings = normalizeSettings(rawSettings);
  const validation = validatePercentRules(normalizedSettings.percentRules);

  if (!validation.isValid) {
    setSettingsError(validation.message);
    triggerHaptic('warning');
    return;
  }

  clearSettingsError();

  state.settings = setSettings(normalizedSettings);
  saveSettings(state.settings);
  renderApp();
  closeSheet();
  triggerHaptic('success');
}

function downloadTXT() {
  const text = exportTXT(getExportPayload());

  downloadFile({
    filename: 'salary.txt',
    content: text,
    contentType: 'text/plain;charset=utf-8'
  });

  triggerHaptic('light');
}

function downloadCSV() {
  const csv = exportCSV(getExportPayload());

  downloadFile({
    filename: 'salary.csv',
    content: `\uFEFF${csv}`,
    contentType: 'text/csv;charset=utf-8'
  });

  triggerHaptic('light');
}

async function copyExportPreview() {
  const text = elements.exportPreview.value.trim() || exportTXT(getExportPayload());
  const previousLabel = elements.exportPreviewCopyBtn.textContent;

  try {
    await copyText(text);
    elements.exportPreviewCopyBtn.textContent = 'Скопировано';
    triggerHaptic('success');
  } catch (error) {
    elements.exportPreviewCopyBtn.textContent = 'Ошибка';
    triggerHaptic('warning');
  }

  window.setTimeout(() => {
    elements.exportPreviewCopyBtn.textContent = previousLabel;
  }, 1000);
}

async function shareNative() {
  const payload = getExportPayload();
  const shareText = exportTXT(payload);

  if (!navigator.share) {
    setExportFallbackVisible(true);
    triggerHaptic('warning');
    return;
  }

  try {
    await navigator.share({
      title: 'Отчёт по сменам',
      text: shareText
    });

    setExportFallbackVisible(false);
    triggerHaptic('success');
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return;
    }

    setExportFallbackVisible(true);
    triggerHaptic('warning');
  }
}

function onSettingsInput() {
  clearSettingsError();
}

function previewTheme(theme) {
  applyTheme(theme);
}

function loadInitialState() {
  state.cashValues = loadCashValues();
  const storedSettings = loadSettings();
  state.settings = setSettings(storedSettings ?? getSettings());
}

function observeFixedStackHeight() {
  if (!elements.fixedStack || !('ResizeObserver' in window)) {
    return;
  }

  fixedStackObserver = new ResizeObserver(() => {
    scheduleBottomStackSpaceSync();
  });

  fixedStackObserver.observe(elements.fixedStack);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const swUrl = new URL('../service-worker.js', import.meta.url);
    const scopeUrl = new URL('../', import.meta.url);
    await navigator.serviceWorker.register(swUrl, { scope: scopeUrl.pathname });
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}

function init() {
  loadInitialState();

  window.addEventListener('resize', scheduleBottomStackSpaceSync, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleBottomStackSpaceSync, { passive: true });
  }

  observeFixedStackHeight();

  bindEvents({
    elements: {
      cashForm: elements.cashForm,
      cashInput: elements.cashInput,
      clearButton: elements.clearBtn,
      settingsButton: elements.settingsBtn,
      exportButton: elements.exportBtn,
      presetButtons: elements.presetButtons,
      undoButton: elements.undoBtn,
      sheetBackdrop: elements.sheetBackdrop,
      settingsSheet: elements.settingsSheet,
      exportSheet: elements.exportSheet,
      sheetCloseButtons: [...elements.sheetCloseButtons],
      addRuleButton: elements.addRuleBtn,
      rulesListElement: elements.rulesList,
      fixedPerShiftInputElement: elements.fixedPerShiftInput,
      userNameInputElement: elements.userNameInput,
      quickPadToggleInputElement: elements.quickPadToggle,
      themeButtons: elements.themeButtons,
      saveSettingsButton: elements.saveSettingsBtn,
      nativeShareButton: elements.nativeShareBtn,
      copyPreviewButton: elements.exportPreviewCopyBtn,
      downloadTxtButton: elements.downloadTxtBtn,
      downloadCsvButton: elements.downloadCsvBtn
    },
    handlers: {
      onAddCash: addCash,
      onPresetCash: applyPreset,
      onUndoRemove: undoRemove,
      onClearCash: clearCash,
      onOpenSettings: openSettings,
      onOpenExport: openExport,
      onCloseSheet: closeSheet,
      onSaveSettings: applySettings,
      onSettingsInput,
      onThemePreview: previewTheme,
      onNativeShare: shareNative,
      onCopyPreview: copyExportPreview,
      onDownloadTxt: downloadTXT,
      onDownloadCsv: downloadCSV,
      isSheetOpen: () => Boolean(state.activeSheet)
    },
    formatters: {
      formatInputAsGroupedInteger,
      sanitizePercentInput,
      formatNumber
    }
  });

  renderApp();
  scheduleBottomStackSpaceSync();
  window.setTimeout(scheduleBottomStackSpaceSync, 70);
  focusCashInput();
  registerServiceWorker();
}

init();
