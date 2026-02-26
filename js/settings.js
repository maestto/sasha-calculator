import { parseCurrency, parsePercent } from './format.js';

export const DEFAULT_SETTINGS = Object.freeze({
  percentRules: [{ from: 0, to: null, percent: 3 }],
  fixedPerShift: 3000,
  userName: ''
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
    userName: settings.userName
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

  return {
    percentRules: sortRules(percentRules),
    fixedPerShift,
    userName: rawUserName.trim()
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
