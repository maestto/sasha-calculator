import { formatCurrency } from './format.js';

function formatExportDate(exportDate = new Date()) {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(exportDate);
}

function normalizeName(userName = '') {
  return String(userName ?? '').trim();
}

function escapeCsv(value) {
  const text = String(value ?? '');

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function buildShiftLines(cashValues = []) {
  if (cashValues.length === 0) {
    return ['—'];
  }

  return cashValues.map((value, index) => `${index + 1}. ${formatCurrency(value)}`);
}

export function exportTXT({ cashValues = [], totals, userName = '', exportDate = new Date() }) {
  const safeName = normalizeName(userName);
  const formattedDate = formatExportDate(exportDate);

  const lines = [
    `Дата экспорта: ${formattedDate}`,
    safeName ? `Отчёт для: ${safeName}` : null,
    `Смен: ${totals.shiftsCount}`,
    `Касса: ${formatCurrency(totals.totalCash)}`,
    `Зарплата: ${formatCurrency(totals.salary)}`,
    '',
    'Список смен:',
    ...buildShiftLines(cashValues)
  ].filter(Boolean);

  return lines.join('\n');
}

export function exportCSV({ cashValues = [], userName = '', exportDate = new Date() }) {
  const safeName = normalizeName(userName);
  const formattedDate = formatExportDate(exportDate);
  const lines = ['Shift,Cash,RUB,UserName,ExportDate'];

  cashValues.forEach((value, index) => {
    lines.push(`${index + 1},${value},${value},${escapeCsv(safeName)},${escapeCsv(formattedDate)}`);
  });

  return lines.join('\n');
}

export function exportTelegram({ cashValues = [], totals, userName = '', exportDate = new Date() }) {
  const safeName = normalizeName(userName);
  const formattedDate = formatExportDate(exportDate);

  const text = [
    `Дата экспорта: ${formattedDate}`,
    safeName ? `Отчёт для: ${safeName}` : null,
    `Смен: ${totals.shiftsCount}`,
    `Касса: ${formatCurrency(totals.totalCash)}`,
    `Зарплата: ${formatCurrency(totals.salary)}`,
    '',
    'Список смен:',
    ...buildShiftLines(cashValues)
  ].filter(Boolean).join('\n');

  return `https://t.me/share/url?text=${encodeURIComponent(text)}`;
}

export function downloadFile({ filename, content, contentType }) {
  const blob = new Blob([content], { type: contentType });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}

export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  const success = document.execCommand('copy');
  textArea.remove();
  return success;
}
