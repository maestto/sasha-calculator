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

export function getPercentForAmount(amount, percentRules = []) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    return 0;
  }

  if (!Array.isArray(percentRules) || percentRules.length === 0) {
    return 0;
  }

  const rules = sortRules(percentRules);
  let fallbackPercent = Number.isFinite(rules[0].percent) ? rules[0].percent : 0;

  for (const rule of rules) {
    const min = Number.isFinite(rule.from) ? rule.from : 0;
    const max = rule.to === null ? Number.POSITIVE_INFINITY : rule.to;
    const percent = Number.isFinite(rule.percent) ? rule.percent : 0;

    if (numericAmount >= min) {
      fallbackPercent = percent;
    }

    if (numericAmount >= min && numericAmount < max) {
      return percent;
    }
  }

  return fallbackPercent;
}

export function calculateSalary(cashValues = [], settings = { percentRules: [], fixedPerShift: 0 }) {
  const safeCashValues = Array.isArray(cashValues) ? cashValues : [];
  const rules = Array.isArray(settings.percentRules) ? settings.percentRules : [];
  const fixedPerShift = Number.isFinite(settings.fixedPerShift) && settings.fixedPerShift >= 0
    ? settings.fixedPerShift
    : 0;

  let totalCash = 0;
  let percentPart = 0;

  for (const rawAmount of safeCashValues) {
    const amount = Number(rawAmount);

    if (!Number.isFinite(amount) || amount < 0) {
      continue;
    }

    totalCash += amount;
    percentPart += amount * (getPercentForAmount(amount, rules) / 100);
  }

  const shiftsCount = safeCashValues.length;
  const fixedPart = shiftsCount * fixedPerShift;
  const salary = percentPart + fixedPart;

  return {
    shiftsCount,
    totalCash,
    percentPart,
    fixedPart,
    salary
  };
}
