import { parseCurrency, parsePercent } from './format.js';

export const DEFAULT_SETTINGS = Object.freeze({
  percentRules: [{ from: 0, to: null, percent: 3 }],
  fixedPerShift: 3000,
  userName: '',
  showQuickPad: false,
  theme: 'light'
});

const ALLOWED_THEMES = new Set(['light', 'dark']);
const LEGACY_THEME_MAP = Object.freeze({
  graphite: 'dark',
  slate: 'dark'
});

function cloneRule(rule) {
  return {
    from: rule.from,
    to: rule.to,
    percent: rule.percent
  };
}

function cloneSettings(settings) {
  return {
    percentRules: settings.percentRules.map(cloneRule),
    fixedPerShift: settings.fixedPerShift,
    userName: settings.userName,
    showQuickPad: Boolean(settings.showQuickPad),
    theme: settings.theme
  };
}

function toNonNegativeNumber(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function normalizeRule(rawRule = {}) {
  const fromValue = parseCurrency(rawRule.from);
  const toValue = rawRule.to === null || rawRule.to === '' || typeof rawRule.to === 'undefined'
    ? null
    : parseCurrency(rawRule.to);
  const percentValue = parsePercent(rawRule.percent);

  const from = toNonNegativeNumber(fromValue, 0);
  let to = toValue === null ? null : toNonNegativeNumber(toValue, null);
  const percent = toNonNegativeNumber(percentValue, 0);

  if (to !== null && to <= from) {
    to = null;
  }

  return { from, to, percent };
}

function sortRules(rules) {
  return [...rules].sort((first, second) => {
    if (first.from !== second.from) {
      return first.from - second.from;
    }

    const firstTo = first.to === null ? Number.POSITIVE_INFINITY : first.to;
    const secondTo = second.to === null ? Number.POSITIVE_INFINITY : second.to;
    return firstTo - secondTo;
  });
}

export function normalizeSettings(rawSettings = {}) {
  let percentRules = [];

  if (Array.isArray(rawSettings.percentRules)) {
    percentRules = rawSettings.percentRules
      .map(normalizeRule)
      .filter((rule) => Number.isFinite(rule.percent) && rule.percent >= 0);
  }

  if (percentRules.length === 0) {
    percentRules = DEFAULT_SETTINGS.percentRules.map(cloneRule);
  }

  const hasFixedPerShiftValue = !(
    rawSettings.fixedPerShift === null ||
    rawSettings.fixedPerShift === '' ||
    typeof rawSettings.fixedPerShift === 'undefined'
  );

  const fixedPerShiftRaw = parseCurrency(rawSettings.fixedPerShift);
  const fixedPerShift = hasFixedPerShiftValue
    ? toNonNegativeNumber(fixedPerShiftRaw, DEFAULT_SETTINGS.fixedPerShift)
    : DEFAULT_SETTINGS.fixedPerShift;

  const rawUserName = typeof rawSettings.userName === 'string'
    ? rawSettings.userName
    : (typeof rawSettings.employeeName === 'string' ? rawSettings.employeeName : '');
  const showQuickPad = rawSettings.showQuickPad === true;
  const rawTheme = typeof rawSettings.theme === 'string' ? rawSettings.theme : DEFAULT_SETTINGS.theme;
  const mappedTheme = LEGACY_THEME_MAP[rawTheme] ?? rawTheme;
  const theme = ALLOWED_THEMES.has(mappedTheme) ? mappedTheme : DEFAULT_SETTINGS.theme;

  return {
    percentRules: sortRules(percentRules),
    fixedPerShift,
    userName: rawUserName.trim(),
    showQuickPad,
    theme
  };
}

let settingsState = cloneSettings(DEFAULT_SETTINGS);

export function getSettings() {
  return cloneSettings(settingsState);
}

export function setSettings(nextSettings) {
  settingsState = normalizeSettings(nextSettings);
  return getSettings();
}

export function resetSettings() {
  settingsState = cloneSettings(DEFAULT_SETTINGS);
  return getSettings();
}

export function createRule(rule = {}) {
  return normalizeRule(rule);
}

function nearlyEqual(first, second, epsilon = 0.0001) {
  return Math.abs(first - second) <= epsilon;
}

export function validatePercentRules(percentRules = []) {
  if (!Array.isArray(percentRules) || percentRules.length === 0) {
    return {
      isValid: false,
      message: 'Добавьте хотя бы одно правило процентов.'
    };
  }

  const rules = sortRules(percentRules);

  if (!nearlyEqual(rules[0].from, 0)) {
    return {
      isValid: false,
      message: 'Первое правило должно начинаться с 0.'
    };
  }

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];

    if (!Number.isFinite(rule.from) || rule.from < 0) {
      return {
        isValid: false,
        message: `Проверьте поле «От» в правиле #${index + 1}.`
      };
    }

    if (!Number.isFinite(rule.percent) || rule.percent < 0 || rule.percent > 100) {
      return {
        isValid: false,
        message: `Процент в правиле #${index + 1} должен быть от 0 до 100.`
      };
    }

    if (rule.to !== null && (!Number.isFinite(rule.to) || rule.to <= rule.from)) {
      return {
        isValid: false,
        message: `Поле «До» в правиле #${index + 1} должно быть больше поля «От».`
      };
    }

    if (index < rules.length - 1 && rule.to === null) {
      return {
        isValid: false,
        message: 'Правило с бесконечным диапазоном должно быть последним.'
      };
    }

    if (index === rules.length - 1) {
      break;
    }

    const nextRule = rules[index + 1];
    const currentEnd = rule.to === null ? Number.POSITIVE_INFINITY : rule.to;

    if (currentEnd < nextRule.from && !nearlyEqual(currentEnd, nextRule.from)) {
      return {
        isValid: false,
        message: `Между правилами #${index + 1} и #${index + 2} есть разрыв диапазона.`
      };
    }

    if (currentEnd > nextRule.from && !nearlyEqual(currentEnd, nextRule.from)) {
      return {
        isValid: false,
        message: `Правила #${index + 1} и #${index + 2} пересекаются.`
      };
    }
  }

  if (rules[rules.length - 1].to !== null) {
    return {
      isValid: false,
      message: 'Последнее правило должно иметь пустое поле «До» (∞).'
    };
  }

  return { isValid: true, message: '' };
}
