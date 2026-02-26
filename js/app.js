import { calculateSalary, getPercentForAmount } from './calculator.js';
import { saveCashValues, loadCashValues, saveSettings, loadSettings } from './storage.js';
import { getSettings, setSettings, normalizeSettings } from './settings.js';
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
  bindEvents
} from './ui.js';
import {
  exportTXT,
  exportCSV,
  exportTelegram,
  downloadFile,
  copyText
} from './export.js';

const SHEET_TRANSITION_MS = 240;

const state = {
  cashValues: [],
  settings: getSettings(),
  lastAddedIndex: -1,
  activeSheet: null
};

const elements = {
  cashForm: document.getElementById('cashForm'),
  cashInput: document.getElementById('cashInput'),
  shiftList: document.getElementById('shiftList'),
  shiftCount: document.getElementById('shiftCount'),
  cashTotal: document.getElementById('cashTotal'),
  salaryTotal: document.getElementById('salaryTotal'),
  fixedInfo: document.getElementById('fixedInfo'),
  clearBtn: document.getElementById('clearBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  exportBtn: document.getElementById('exportBtn'),
  sheetBackdrop: document.getElementById('sheetBackdrop'),
  settingsSheet: document.getElementById('settingsSheet'),
  exportSheet: document.getElementById('exportSheet'),
  sheetCloseButtons: document.querySelectorAll('.sheet-close'),
  rulesList: document.getElementById('rulesList'),
  addRuleBtn: document.getElementById('addRuleBtn'),
  fixedPerShiftInput: document.getElementById('fixedPerShiftInput'),
  userNameInput: document.getElementById('userNameInput'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  exportPreview: document.getElementById('exportPreview'),
  copyExportBtn: document.getElementById('copyExportBtn'),
  downloadTxtBtn: document.getElementById('downloadTxtBtn'),
  downloadCsvBtn: document.getElementById('downloadCsvBtn'),
  telegramExportBtn: document.getElementById('telegramExportBtn')
};

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

function renderApp() {
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
    settings: state.settings,
    formatCurrency,
    elements: {
      shiftCountElement: elements.shiftCount,
      cashTotalElement: elements.cashTotal,
      salaryTotalElement: elements.salaryTotal,
      fixedInfoElement: elements.fixedInfo,
      clearButton: elements.clearBtn
    }
  });

  updateExportPreview();
  state.lastAddedIndex = -1;
}

function focusCashInput() {
  if (state.activeSheet) {
    return;
  }

  requestAnimationFrame(() => {
    elements.cashInput.focus();
  });
}

function setSheetVisibility(sheet, isVisible) {
  if (!sheet) {
    return;
  }

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

function addCash(rawValue) {
  const amount = parseCurrency(rawValue);

  if (!Number.isFinite(amount) || amount < 0) {
    return false;
  }

  state.cashValues.push(amount);
  state.lastAddedIndex = state.cashValues.length - 1;

  saveCashValues(state.cashValues);
  renderApp();
  return true;
}

function removeCash(index) {
  if (index < 0 || index >= state.cashValues.length) {
    return;
  }

  state.cashValues.splice(index, 1);
  saveCashValues(state.cashValues);
  renderApp();
}

function clearCash() {
  state.cashValues = [];
  saveCashValues(state.cashValues);
  renderApp();
  focusCashInput();
}

function openSettings() {
  renderSettingsRules({
    rulesListElement: elements.rulesList,
    rules: state.settings.percentRules,
    formatNumber
  });

  elements.fixedPerShiftInput.value = state.settings.fixedPerShift > 0
    ? formatNumber(state.settings.fixedPerShift)
    : '';
  elements.userNameInput.value = state.settings.userName;

  openSheet(elements.settingsSheet);
}

function openExport() {
  updateExportPreview();
  openSheet(elements.exportSheet);
}

function applySettings(rawSettings) {
  state.settings = setSettings(normalizeSettings(rawSettings));
  saveSettings(state.settings);
  renderApp();
  closeSheet();
}

async function copyExport() {
  const text = exportTXT(getExportPayload());
  const previousLabel = elements.copyExportBtn.textContent;

  try {
    await copyText(text);
    elements.copyExportBtn.textContent = 'Скопировано';
  } catch (error) {
    elements.copyExportBtn.textContent = 'Ошибка копирования';
  }

  window.setTimeout(() => {
    elements.copyExportBtn.textContent = previousLabel;
  }, 1000);
}

function downloadTXT() {
  const text = exportTXT(getExportPayload());

  downloadFile({
    filename: 'salary.txt',
    content: text,
    contentType: 'text/plain;charset=utf-8'
  });
}

function downloadCSV() {
  const csv = exportCSV(getExportPayload());

  downloadFile({
    filename: 'salary.csv',
    content: `\uFEFF${csv}`,
    contentType: 'text/csv;charset=utf-8'
  });
}

function sendTelegram() {
  const url = exportTelegram(getExportPayload());
  window.open(url, '_blank', 'noopener,noreferrer');
}

function loadInitialState() {
  state.cashValues = loadCashValues();
  const storedSettings = loadSettings();
  state.settings = setSettings(storedSettings ?? getSettings());
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

  bindEvents({
    elements: {
      cashForm: elements.cashForm,
      cashInput: elements.cashInput,
      clearButton: elements.clearBtn,
      settingsButton: elements.settingsBtn,
      exportButton: elements.exportBtn,
      sheetBackdrop: elements.sheetBackdrop,
      sheetCloseButtons: [...elements.sheetCloseButtons],
      addRuleButton: elements.addRuleBtn,
      rulesListElement: elements.rulesList,
      fixedPerShiftInputElement: elements.fixedPerShiftInput,
      userNameInputElement: elements.userNameInput,
      saveSettingsButton: elements.saveSettingsBtn,
      copyExportButton: elements.copyExportBtn,
      downloadTxtButton: elements.downloadTxtBtn,
      downloadCsvButton: elements.downloadCsvBtn,
      telegramExportButton: elements.telegramExportBtn
    },
    handlers: {
      onAddCash: addCash,
      onClearCash: clearCash,
      onOpenSettings: openSettings,
      onOpenExport: openExport,
      onCloseSheet: closeSheet,
      onSaveSettings: applySettings,
      onCopyExport: copyExport,
      onDownloadTxt: downloadTXT,
      onDownloadCsv: downloadCSV,
      onTelegramExport: sendTelegram,
      isSheetOpen: () => Boolean(state.activeSheet)
    },
    formatters: {
      formatInputAsGroupedInteger,
      sanitizePercentInput,
      formatNumber
    }
  });

  renderApp();
  focusCashInput();
  registerServiceWorker();
}

init();
