const { parse } = require('csv-parse/sync');
const { validateEmail } = require('./validators');

function parseCSV(buffer) {
  const content = buffer.toString('utf-8');

  // Tenta detectar o delimitador
  const firstLine = content.split('\n')[0];
  const delimiter = firstLine.includes(';') ? ';' : ',';

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    bom: true,
  });

  const leads = [];
  const errors = [];

  records.forEach((record, index) => {
    // Normaliza nomes de colunas (case insensitive)
    const normalized = {};
    Object.keys(record).forEach(key => {
      normalized[key.toLowerCase().trim()] = record[key];
    });

    const email = normalized.email || normalized['e-mail'] || normalized.mail || '';
    const name = normalized.name || normalized.nome || normalized.first_name || '';

    if (!email) {
      errors.push(`Linha ${index + 2}: E-mail não encontrado`);
      return;
    }

    if (!validateEmail(email)) {
      errors.push(`Linha ${index + 2}: E-mail inválido (${email})`);
      return;
    }

    leads.push({
      email: email.toLowerCase().trim(),
      name: name.trim() || null,
    });
  });

  // Remover duplicados dentro do CSV
  const seen = new Set();
  const uniqueLeads = leads.filter(lead => {
    if (seen.has(lead.email)) return false;
    seen.add(lead.email);
    return true;
  });

  const duplicatesRemoved = leads.length - uniqueLeads.length;

  return {
    leads: uniqueLeads,
    errors,
    totalParsed: records.length,
    duplicatesRemoved,
  };
}

module.exports = { parseCSV };
