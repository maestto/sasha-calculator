const CASH_VALUES_KEY = 'cashValues';
const LEGACY_CASH_VALUES_KEY = 'salaryCalculatorCashValues';
const SETTINGS_KEY = 'settings';

export function saveCashValues(cashValues = []) {
  localStorage.setItem(CASH_VALUES_KEY, JSON.stringify(cashValues));
}

export function loadCashValues() {
  try {
    const rawValue = localStorage.getItem(CASH_VALUES_KEY) ?? localStorage.getItem(LEGACY_CASH_VALUES_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value >= 0);
  } catch (error) {
    return [];
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings() {
  try {
    const rawValue = localStorage.getItem(SETTINGS_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    return null;
  }
}
