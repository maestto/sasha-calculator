const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

export function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return currencyFormatter.format(value).replace(/\u00A0/g, ' ');
}

export function formatCurrency(value) {
  return formatNumber(value) + ' ₽';
}

export function parseCurrency(value) {
  const normalized = String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');

  if (!normalized) {
    return Number.NaN;
  }

  const [integerPart, ...fractionParts] = normalized.split('.');
  const joined = fractionParts.length > 0 ? `${integerPart}.${fractionParts.join('')}` : integerPart;
  const parsed = Number(joined);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '0%';
  }

  return `${percentFormatter.format(value).replace(/\u00A0/g, ' ')}%`;
}

function digitCountBeforeCaret(value, caretPosition) {
  return value.slice(0, caretPosition).replace(/\D/g, '').length;
}

function caretFromDigitCount(value, targetDigitCount) {
  if (targetDigitCount <= 0) {
    return 0;
  }

  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      count += 1;

      if (count >= targetDigitCount) {
        return index + 1;
      }
    }
  }

  return value.length;
}

function groupDigits(value) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function formatInputAsGroupedInteger(inputElement) {
  const rawValue = inputElement.value;
  const caretStart = inputElement.selectionStart ?? rawValue.length;
  const digitsBefore = digitCountBeforeCaret(rawValue, caretStart);

  let digits = rawValue.replace(/\D/g, '');
  digits = digits.replace(/^0+(?=\d)/, '');

  const formatted = groupDigits(digits);
  inputElement.value = formatted;

  const nextCaret = caretFromDigitCount(formatted, digitsBefore);
  inputElement.setSelectionRange(nextCaret, nextCaret);
}

export function sanitizePercentInput(value) {
  const normalized = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');

  if (!normalized) {
    return '';
  }

  const [integerPart, ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, 2);
  const result = fraction ? `${integerPart}.${fraction}` : integerPart;

  return result.replace('.', ',');
}

export function parsePercent(value) {
  const normalized = String(value ?? '').trim().replace(',', '.');

  if (!normalized) {
    return Number.NaN;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
