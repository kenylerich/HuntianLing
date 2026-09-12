#!/usr/bin/env node
/**
 * Depth-1 sensor for HuntianLing self-harness artifacts.
 * Rejects missing required fields and role-boundary leaks.
 */
import { readFileSync } from 'node:fs';

const file = process.argv.slice(2).find((arg) => arg !== '--');
if (!file) {
  console.error('usage: node .agents/skills/huntianling-self-harness/validate.mjs <artifact.json>');
  process.exit(2);
}

const data = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];

function requireKey(obj, key) {
  if (obj[key] === undefined || obj[key] === null) {
    errors.push(`missing ${key}`);
  }
}

function forbidKeys(obj, keys) {
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) {
      errors.push(`forbidden field ${key}`);
    }
  }
}

function requireNonEmptyArray(obj, key) {
  requireKey(obj, key);
  if (!Array.isArray(obj[key]) || obj[key].length === 0) {
    errors.push(`${key} must be a non-empty array`);
  }
}

const role = data.role;
if (!role) {
  errors.push('missing role');
}

switch (role) {
  case 'mkt':
    requireNonEmptyArray(data, 'rawQuotes');
    requireKey(data, 'goal');
    requireKey(data, 'confirmed');
    forbidKeys(data, ['technicalDesign', 'files', 'filePaths', 'code']);
    if (Array.isArray(data.rawQuotes)) {
      for (const [i, quote] of data.rawQuotes.entries()) {
        if (!quote?.text) {
          errors.push(`rawQuotes[${i}] missing text`);
        }
      }
    }
    break;
  case 'planner':
    requireNonEmptyArray(data, 'reqIds');
    requireKey(data, 'outcome');
    requireNonEmptyArray(data, 'acceptance');
    forbidKeys(data, ['files', 'filePaths', 'technicalDesign', 'code']);
    if (Array.isArray(data.reqIds)) {
      for (const id of data.reqIds) {
        if (typeof id !== 'string' || !id.startsWith('REQ-')) {
          errors.push(`reqIds entry must be a REQ-* id: ${id}`);
        }
      }
    }
    break;
  case 'environment':
    requireKey(data, 'commands');
    requireKey(data, 'ready');
    if (data.commands && typeof data.commands === 'object') {
      for (const name of ['lint', 'hygiene']) {
        if (data.commands[name] === 'pass') {
          errors.push(`${name} cannot be pass while the package script still probe-fails`);
        }
      }
      if (data.ready === true) {
        for (const name of ['typecheck', 'test']) {
          if (data.commands[name] !== 'pass') {
            errors.push(`ready true requires commands.${name} pass`);
          }
        }
      }
    }
    break;
  case 'generator':
    requireNonEmptyArray(data, 'files');
    requireKey(data, 'selfCheck');
    forbidKeys(data, ['accepted', 'delivered']);
    if (data.selfCheck && typeof data.selfCheck === 'object') {
      for (const name of ['lint', 'hygiene']) {
        if (data.selfCheck[name] === 'pass') {
          errors.push(`selfCheck.${name} cannot be pass while the package script still probe-fails`);
        }
      }
    }
    break;
  case 'repair':
    requireKey(data, 'from');
    requireKey(data, 'to');
    requireKey(data, 'handoffKind');
    requireKey(data, 'round');
    if (data.handoffKind !== 'repair') {
      errors.push('handoffKind must be repair');
    }
    if (data.from !== 'evaluator' || data.to !== 'generator') {
      errors.push('repair handoff must be evaluator to generator');
    }
    requireNonEmptyArray(data, 'failedCriteria');
    break;
  case 'evaluator':
    if (data.independent !== true) {
      errors.push('independent must be true');
    }
    requireNonEmptyArray(data, 'criteria');
    requireKey(data, 'decision');
    if (data.decision === 'pass' && Array.isArray(data.criteria)) {
      if (data.criteria.some((row) => row.result !== 'pass')) {
        errors.push('decision pass requires every criterion pass');
      }
    }
    if (data.decision !== 'pass' && data.decision !== 'revision-required') {
      errors.push('decision must be pass or revision-required');
    }
    break;
  default:
    if (role) {
      errors.push(`unknown role ${role}`);
    }
}

if (errors.length > 0) {
  console.error(`${file}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`${file}: ok (${role})`);
