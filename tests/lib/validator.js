'use strict';
// Minimal, dependency-free validator for the JSON Schema subset used in
// schema/repair-directory.schema.json (draft 2020-12 keywords actually used):
// type, properties, required, additionalProperties:false, enum, pattern,
// format:date, minLength, minItems, items.
// Returns an array of human-readable error strings (empty = valid).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function checkObject(value, schema, path, errors) {
  const required = schema.required || [];
  for (const key of required) {
    if (!(key in value)) {
      errors.push(path + " is missing required property '" + key + "'");
    }
  }
  const props = schema.properties || {};
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!(key in props)) {
        errors.push(path + " has unexpected property '" + key + "'");
      }
    }
  }
  for (const key of Object.keys(props)) {
    if (key in value) {
      check(value[key], props[key], path ? path + '.' + key : key, errors);
    }
  }
}

function check(value, schema, path, errors) {
  const t = typeOf(value);
  if (schema.type && t !== schema.type) {
    if (schema.type === 'integer') {
      if (t !== 'number' || !Number.isInteger(value)) {
        errors.push(path + ' must be an integer (got ' + t + ')');
        return;
      }
    } else {
      errors.push(path + ' must be of type ' + schema.type + ' (got ' + t + ')');
      return;
    }
  }
  if (schema.type === 'object') {
    checkObject(value, schema, path, errors);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(path + " must be one of " + JSON.stringify(schema.enum) + " (got " + JSON.stringify(value) + ")");
  }
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
    errors.push(path + ' must match pattern ' + schema.pattern + ' (got ' + JSON.stringify(value) + ')');
  }
  if (schema.format === 'date' && typeof value === 'string' && !(DATE_RE.test(value) && !Number.isNaN(Date.parse(value)))) {
    errors.push(path + ' must be an ISO date string YYYY-MM-DD (got ' + JSON.stringify(value) + ')');
  }
  if (schema.minLength != null && typeof value === 'string' && value.length < schema.minLength) {
    errors.push(path + ' must be at least ' + schema.minLength + ' characters');
  }
  if (schema.minItems != null && Array.isArray(value) && value.length < schema.minItems) {
    errors.push(path + ' must contain at least ' + schema.minItems + ' items');
  }
  if (schema.items && Array.isArray(value)) {
    value.forEach((item, i) => check(item, schema.items, path + '[' + i + ']', errors));
  }
}

module.exports = { validate: (data, schema) => {
  const errors = [];
  check(data, schema, 'root', errors);
  return errors;
} };
