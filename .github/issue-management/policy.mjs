#!/usr/bin/env node

import fs from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import config from './config.json' with { type: 'json' }

const API_VERSION = '2026-03-10'
const BODY_LIMIT = 50
const AUDIT_MARKER = '<!-- dsh-issue-policy -->'
const DELIVERY_GATE_MARKER = '<!-- huntianling-delivery-gate -->'
const OWNER_LINE = /^Owner: @([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)$/
const TYPES = new Set(['Idea', 'Feature', 'Bug', 'Research', 'Task'])
const PRIORITIES = ['p0', 'p1', 'p2', 'p3']
const PR_KINDS = new Set([
  'kind/feature',
  'kind/bug-fix',
  'kind/doc',
  'kind/testing',
  'kind/cleanup',
  'kind/dependency',
])
// Retired label aliases stay reserved so they cannot be recreated.
const LEGACY_LABELS = new Set([
  'kind/bug',
  'kind/documentation',
  'feature',
  'bug-fix',
  'doc',
  'cleanup',
  'testing',
  'dependencies',
  'ci',
  'cli',
  'llm',
  'web-search',
])
const TERMINAL_STATUSES = new Set(['Done', 'No action'])
const OPEN_STATUSES = new Set(['Inbox', 'Backlog', 'Ready', 'In progress', 'In review'])
const DEFAULT_ISSUE_STATUS = 'Inbox'
const CODE_SUBMISSION_STATUSES = new Set(['In progress', 'In review'])
const RECOVER_CLOSED_WORKFLOW_EVENT = 'recover_closed'
const RECOVER_ILLEGAL_CLOSED_WORKFLOW_EVENT = 'recover_illegal_closed'
const WORKFLOW_EVENT_TRANSITIONS = new Map([
  ['intake', { status: 'Inbox', from: ['Inbox'] }],
  ['triaged', { status: 'Backlog', from: ['Inbox'] }],
  ['ready', { status: 'Ready', from: ['Backlog'] }],
  ['work_started', { status: 'In progress', from: ['Ready'] }],
  ['review_requested', { status: 'In review', from: ['In progress'] }],
  ['changes_requested', { status: 'In progress', from: ['In review'] }],
  ['completed', { status: 'Done', from: ['In review'], issueState: 'closed', stateReason: 'completed' }],
  [
    'no_action',
    {
      status: 'No action',
      from: ['Inbox', 'Backlog', 'Ready', 'In progress', 'In review'],
      issueState: 'closed',
      stateReason: 'not_planned',
    },
  ],
])
const DELIVERY_GATE_FIELDS = [
  ['workItem', 'WorkItem'],
  ['acceptance', 'Acceptance'],
  ['code', 'Code'],
  ['review', 'Review'],
  ['ci', 'CI'],
  ['evidence', 'Evidence'],
  ['gates', 'Gates'],
]
const DELIVERY_GATE_FIELD_ALIASES = new Map([
  ['workitem', 'workItem'],
  ['work_item', 'workItem'],
  ['acceptance', 'acceptance'],
  ['code', 'code'],
  ['review', 'review'],
  ['ci', 'ci'],
  ['evidence', 'evidence'],
  ['gate', 'gates'],
  ['gates', 'gates'],
])

if (typeof config.lifecycleActor !== 'string' || !config.lifecycleActor) {
  throw new Error('config.lifecycleActor 未设置')
}
if (typeof config.priorityField !== 'string' || !config.priorityField) {
  throw new Error('config.priorityField 未设置')
}
if (typeof config.startDateField !== 'string' || !config.startDateField) {
  throw new Error('config.startDateField 未设置')
}
if (typeof config.projectTimeZone !== 'string' || !config.projectTimeZone) {
  throw new Error('config.projectTimeZone 未设置')
}
for (const status of new Set([...WORKFLOW_EVENT_TRANSITIONS.values()].map((event) => event.status))) {
  if (!config.statuses.includes(status)) throw new Error(`config.statuses 缺少 ${status}`)
}
Intl.DateTimeFormat('en-US', { timeZone: config.projectTimeZone })

/**
 * Return Markdown outside balanced details elements.
 * @param {string} body Markdown body.
 * @returns {{text: string, balanced: boolean, detailsCount: number, allCollapsed: boolean}} Visible source and details shape.
 */
export function extractOutsideDetails(body) {
  const source = body.replace(/<!--[\s\S]*?-->/g, '')
  const tag = /<\/?details\b[^>]*>/gi
  let depth = 0
  let cursor = 0
  let balanced = true
  let text = ''
  let detailsCount = 0
  let allCollapsed = true

  for (const match of source.matchAll(tag)) {
    const index = match.index ?? 0
    if (depth === 0) text += source.slice(cursor, index)
    if (/^<\//.test(match[0])) {
      if (depth === 0) balanced = false
      else depth -= 1
    } else {
      depth += 1
      detailsCount += 1
      if (/\sopen(?:\s|=|>)/i.test(match[0])) allCollapsed = false
    }
    cursor = index + match[0].length
  }

  if (depth === 0) text += source.slice(cursor)
  if (depth !== 0) balanced = false
  return { text, balanced, detailsCount, allCollapsed }
}

/**
 * Count Chinese characters and contiguous Latin, numeric, or code tokens.
 * @param {string} body Markdown body.
 * @returns {{units: number, balanced: boolean, detailsCount: number, allCollapsed: boolean}} Visible unit count and details shape.
 */
export function countVisibleUnits(body) {
  const outside = extractOutsideDetails(body)
  const visible = outside.text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:[A-Za-z]+|#\d+|#x[0-9A-Fa-f]+);/g, ' ')
    .replace(/[\u0060*~\[\]{}()<>#!|]/g, ' ')
  const han = visible.match(/\p{Script=Han}/gu)?.length ?? 0
  const tokens = visible.match(/[\p{Script=Latin}\p{Number}_./:@+-]+/gu)?.length ?? 0
  return {
    units: han + tokens,
    balanced: outside.balanced,
    detailsCount: outside.detailsCount,
    allCollapsed: outside.allCollapsed,
  }
}

function firstNonblankLine(body) {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)
}

/**
 * Validate required body sections and check Owner against assignees.
 * @param {{body: string, assignees: string[], allowUnassignedOwner?: boolean}} input Body input.
 * @returns {string[]} Validation errors.
 */
export function validateBody({
  body,
  assignees,
  allowUnassignedOwner = config.allowUnassignedOwner ?? false,
}) {
  const errors = []
  const count = countVisibleUnits(body)
  const owner = firstNonblankLine(body)?.match(OWNER_LINE)?.[1] ?? null
  const normalized = [...new Set(assignees.map((login) => login.toLowerCase()))]

  if (!count.balanced) errors.push('details 标签必须成对闭合')
  if (count.detailsCount === 0) errors.push('正文必须包含默认收起的 <details> 区域')
  if (!count.allCollapsed) errors.push('details 必须默认收起，不得设置 open')
  if (count.units > BODY_LIMIT) {
    errors.push(`正文外露部分为 ${count.units} 单位，超过 50 单位`)
  }
  if (normalized.length >= 2 && !owner) {
    errors.push('多个 Assignees 时首个非空行必须是 Owner: @login')
  } else if (normalized.length >= 2 && !normalized.includes(owner.toLowerCase())) {
    errors.push('Owner 必须属于 Assignees')
  } else if (
    normalized.length < 2 &&
    owner &&
    !(normalized.length === 0 && allowUnassignedOwner)
  ) {
    errors.push('零或一个 Assignee 时不得写 Owner 行')
  }
  return errors
}

/**
 * Decide whether the human-review policy applies to a PR.
 * @param {{isDraft: boolean, authorType: string, reviewRequestCount: number, reviewCount: number}} input PR state.
 * @returns {boolean} Whether the PR policy is mandatory.
 */
export function requiresPullRequestPolicy({
  isDraft,
  authorType,
  reviewRequestCount,
  reviewCount,
}) {
  const automated = authorType === 'Bot' || authorType === 'App'
  return !isDraft && !automated && (reviewRequestCount > 0 || reviewCount > 0)
}

/**
 * Resolve a workflow event to the Project lane and optional native Issue state.
 * @param {string} workflowEvent Workflow event id.
 * @returns {{status: string, from: string[], issueState?: string, stateReason?: string}} Project and Issue transition.
 */
export function workflowIssueTransition(workflowEvent) {
  const transition = WORKFLOW_EVENT_TRANSITIONS.get(workflowEvent)
  if (!transition) {
    throw new Error(
      `workflow_event 必须为：${[
        ...WORKFLOW_EVENT_TRANSITIONS.keys(),
        RECOVER_CLOSED_WORKFLOW_EVENT,
        RECOVER_ILLEGAL_CLOSED_WORKFLOW_EVENT,
      ].join(', ')}`,
    )
  }
  return transition
}

/**
 * Validate one workflow-driven Project Status movement.
 * @param {string|null} currentStatus Current Project Status.
 * @param {string} workflowEvent Workflow event id.
 * @returns {void} Resolves when the transition is allowed.
 */
export function assertWorkflowIssueTransitionAllowed(currentStatus, workflowEvent) {
  const transition = workflowIssueTransition(workflowEvent)
  if (currentStatus === transition.status) return
  if (!transition.from.includes(currentStatus)) {
    throw new Error(
      `workflow_event ${workflowEvent} requires current Status ${transition.from.join(' or ')}, got ${currentStatus ?? 'empty'}`,
    )
  }
}

/**
 * Parse the visible delivery gate certificate from an Issue body.
 * @param {string} body Issue Markdown body.
 * @returns {{present: boolean, fields: Record<string, string>}} Parsed certificate fields.
 */
export function parseDeliveryGateCertificate(body) {
  const markerIndex = body.indexOf(DELIVERY_GATE_MARKER)
  if (markerIndex === -1) return { present: false, fields: {} }
  const fields = {}
  const source = body.slice(markerIndex + DELIVERY_GATE_MARKER.length)
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:[-*]\s*)?([A-Za-z_]+)\s*[:：]\s*(.+?)\s*$/)
    if (!match) continue
    const key = DELIVERY_GATE_FIELD_ALIASES.get(match[1].toLowerCase())
    if (key !== undefined && fields[key] === undefined) fields[key] = match[2].trim()
  }
  return { present: true, fields }
}

function deliveryGateValueIncomplete(value) {
  return /^(?:-|n\/a|na|none|null|无|待补|待定|pending|missing|blocked|failed|fail|not done|未完成|缺失|阻塞|失败|未通过)\s*$/iu.test(
    value.trim(),
  )
}

/**
 * Validate that a completed Issue has a delivery certificate that points at
 * WorkItem evidence and the gate result.
 * @param {string} body Issue Markdown body.
 * @returns {string[]} Delivery gate errors.
 */
export function validateDeliveryGateCertificate(body) {
  const certificate = parseDeliveryGateCertificate(body)
  if (!certificate.present) {
    return [`Done 必须包含 ${DELIVERY_GATE_MARKER} 交付门禁证明块`]
  }
  const errors = []
  for (const [key, label] of DELIVERY_GATE_FIELDS) {
    const value = certificate.fields[key]
    if (value === undefined) {
      errors.push(`交付门禁证明缺少 ${label}`)
    } else if (deliveryGateValueIncomplete(value)) {
      errors.push(`交付门禁证明 ${label} 仍未完成`)
    }
  }
  const gateValue = certificate.fields.gates ?? ''
  if (
    gateValue &&
    !/^(?:passed|pass|green|approved|ok|success|succeeded|通过|已通过|放行|成功)$/iu.test(gateValue.trim())
  ) {
    errors.push('交付门禁证明 Gates 必须明确通过')
  }
  return errors
}

/**
 * Pick the Project lane used when a completed close is rejected.
 * @param {string|null} currentStatus Current Project Status.
 * @returns {string} Recovery Project Status.
 */
export function recoveryStatusForBlockedClose(currentStatus) {
  if (currentStatus && OPEN_STATUSES.has(currentStatus)) return currentStatus
  return 'In review'
}

/**
 * Parse manual Issue workflow inputs from workflow_dispatch.
 * @param {Record<string, unknown>} inputs GitHub workflow inputs.
 * @returns {{number?: number, workflowEvent: string, status: string, issueState?: string, stateReason?: string}} Workflow request.
 */
export function workflowDispatchIssueRequest(inputs = {}) {
  const workflowEvent = String(inputs.workflow_event ?? 'intake').trim() || 'intake'
  if (workflowEvent === RECOVER_ILLEGAL_CLOSED_WORKFLOW_EVENT) {
    return {
      workflowEvent,
      status: 'In review',
      issueState: 'open',
    }
  }

  const rawNumber = String(inputs.issue_number ?? '').trim()
  if (!/^[1-9]\d*$/.test(rawNumber)) {
    throw new Error('workflow_dispatch issue_number 必须是正整数')
  }
  const number = Number(rawNumber)
  if (!Number.isSafeInteger(number)) {
    throw new Error('workflow_dispatch issue_number 超出安全整数范围')
  }

  if (workflowEvent === RECOVER_CLOSED_WORKFLOW_EVENT) {
    return {
      number,
      workflowEvent,
      status: 'In review',
      issueState: 'open',
    }
  }
  const transition = workflowIssueTransition(workflowEvent)
  return {
    number,
    workflowEvent,
    status: transition.status,
    ...(transition.issueState !== undefined ? { issueState: transition.issueState } : {}),
    ...(transition.stateReason !== undefined ? { stateReason: transition.stateReason } : {}),
  }
}

/**
 * Convert a GitHub timestamp to a Project date in one configured time zone.
 * @param {string} timestamp ISO timestamp.
 * @param {string} timeZone IANA time-zone name.
 * @returns {string} Calendar date in YYYY-MM-DD form.
 */
export function projectDate(timestamp, timeZone = config.projectTimeZone) {
  const instant = new Date(timestamp)
  if (Number.isNaN(instant.getTime())) throw new Error(`无效的 PR 创建时间：${timestamp}`)
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function stripIgnoredMarkdown(body) {
  const lines = body.replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)
  const kept = []
  let fence = null
  for (const line of lines) {
    const marker = line.match(/^\s*([\u0060~]{3,})/)
    if (marker) {
      if (fence === null) fence = marker[1][0]
      else if (marker[1][0] === fence) fence = null
      continue
    }
    if (fence === null) kept.push(line)
  }
  return kept.join('\n').replace(/\u0060[^\u0060]*\u0060/g, ' ')
}

/**
 * Parse same-repository resolving and informational references.
 * @param {{body: string, repository: string}} input PR body and repository.
 * @returns {{all: number[], resolving: number[], related: number[]}} References.
 */
export function parseReferences({ body, repository }) {
  const source = stripIgnoredMarkdown(body)
  const expected = repository.toLowerCase()
  const all = new Set()
  const resolving = new Set()
  const reference =
    /(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#|#)(\d+)|https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/issues\/(\d+)/gi
  const closing =
    /\b(?:close(?:s|d)?|fix(?:es|ed)?|resolve(?:s|d)?)\s*:?\s+(?:(?:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#|#)(\d+)|https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/issues\/(\d+))/gi

  for (const match of source.matchAll(reference)) {
    const explicit = (match[1] ?? match[3] ?? '').toLowerCase()
    const number = Number(match[2] ?? match[4])
    if (!explicit || explicit === expected) all.add(number)
  }
  for (const match of source.matchAll(closing)) {
    const explicit = (match[1] ?? match[3] ?? '').toLowerCase()
    const number = Number(match[2] ?? match[4])
    if (!explicit || explicit === expected) {
      all.add(number)
      resolving.add(number)
    }
  }
  return {
    all: [...all].sort((left, right) => left - right),
    resolving: [...resolving].sort((left, right) => left - right),
    related: [...all].filter((number) => !resolving.has(number)).sort((a, b) => a - b),
  }
}

/**
 * Retain only references that resolve to Issues rather than pull requests.
 * @param {{all: number[], resolving: number[], related: number[]}} references Parsed references.
 * @param {Map<number, unknown>} issues Resolved same-repository Issues.
 * @returns {{all: number[], resolving: number[], related: number[]}} Issue-only references.
 */
export function retainIssueReferences(references, issues) {
  return {
    all: references.all.filter((number) => issues.has(number)),
    resolving: references.resolving.filter((number) => issues.has(number)),
    related: references.related.filter((number) => issues.has(number)),
  }
}

/**
 * Validate one Issue with its Project status.
 * @param {{title: string, body: string, assignees: string[], labels: string[], type: string|null, priority: string|null, status: string|null, state: string, stateReason: string|null}} issue Issue snapshot.
 * @returns {string[]} Validation errors.
 */
export function validateIssue(issue) {
  const errors = validateBody(issue)
  const status = issue.status
  const invalidLabels = issue.labels.filter(
    (label) => label.startsWith('kind/') || LEGACY_LABELS.has(label),
  )

  if (!/\p{Script=Han}/u.test(issue.title)) errors.push('Issue 标题必须包含中文')
  if (invalidLabels.length > 0) {
    errors.push(`Issue 不得使用 PR kind 或旧版标签：${invalidLabels.join(', ')}`)
  }
  if (
    /^\s*(?:\[(?:Idea|Feature|Bug|Research|Task|P[0-3]|Inbox|Backlog|Ready|In progress|In review|Done|No action|Owner|area\/[^\]]+)[^\]]*\]|(?:Idea|Feature|Bug|Research|Task|P[0-3]|Inbox|Backlog|Ready|In progress|In review|Done|No action|Owner|area\/[^:： ]+)\s*[:：-])/iu.test(
      issue.title,
    )
  ) {
    errors.push('Issue 标题不得带 Type、Priority、Status、area 或 Owner 前缀')
  }
  if (!TYPES.has(issue.type ?? '')) errors.push('Type 必须是五种原生英文 Type 之一')
  if (!status || !config.statuses.includes(status)) errors.push('Issue 必须在 Project 中且具有合法 Status')
  if (issue.priority !== null && !PRIORITIES.includes(issue.priority.toLowerCase())) {
    errors.push('Priority 必须为空或为 P0–P3')
  }
  if (status === 'Done' && (issue.state !== 'closed' || issue.stateReason !== 'completed')) {
    errors.push('Done 必须对应 Completed 关闭原因')
  }
  if (status === 'Done') {
    errors.push(...validateDeliveryGateCertificate(issue.body))
  }
  if (
    status === 'No action' &&
    (issue.state !== 'closed' || issue.stateReason !== 'not_planned')
  ) {
    errors.push('No action 必须对应 Not planned 关闭原因')
  }
  if (!['Done', 'No action'].includes(status ?? '') && issue.state !== 'open') {
    errors.push(`${status} 必须对应开放 Issue`)
  }
  return errors
}

/**
 * Validate PR metadata and its referenced Issues.
 * @param {{authorType: string, labels: string[], references: ReturnType<typeof parseReferences>, issues: Map<number, {priority: string|null}>}} input PR snapshot.
 * @returns {string[]} Validation errors.
 */
export function validatePullRequest(input) {
  const errors = []
  for (const number of input.references.resolving) {
    const issue = input.issues.get(number)
    if (!issue) continue
    if (!CODE_SUBMISSION_STATUSES.has(issue.status ?? null)) {
      errors.push(
        `#${number} 必须先通过工作流进入 In progress 或 In review，当前 Status 为 ${issue.status ?? '空'}`,
      )
    }
  }
  if (!requiresPullRequestPolicy(input)) return errors
  const kinds = input.labels.filter((label) => PR_KINDS.has(label))
  const unknownKinds = input.labels.filter(
    (label) => label.startsWith('kind/') && !PR_KINDS.has(label) && !LEGACY_LABELS.has(label),
  )
  const legacyLabels = input.labels.filter((label) => LEGACY_LABELS.has(label))
  const sourceLabels = input.labels.filter((label) => label.startsWith('source/'))
  const priorities = input.labels.filter((label) => PRIORITIES.includes(label))
  const areas = input.labels.filter((label) => label.startsWith('area/'))

  if (input.references.all.length === 0) errors.push('PR 正文必须引用至少一个同仓库 Issue')
  if (kinds.length !== 1) {
    errors.push(`PR 必须恰好有一个允许的 kind/*，当前为 ${kinds.length}`)
  }
  if (unknownKinds.length > 0) {
    errors.push(`PR 含不支持的 kind/*：${unknownKinds.join(', ')}`)
  }
  if (legacyLabels.length > 0) errors.push(`PR 含旧版标签：${legacyLabels.join(', ')}`)
  if (sourceLabels.length > 0) errors.push(`source/* 仅用于 Issue：${sourceLabels.join(', ')}`)
  if (priorities.length > 1) errors.push(`PR 最多有一个 p0–p3，当前为 ${priorities.length}`)
  if (areas.length === 0) errors.push('PR 必须至少有一个 area/*')
  for (const number of input.references.all) {
    if (!input.issues.has(number)) errors.push(`#${number} 不是同仓库 Issue`)
  }

  const resolving = input.references.resolving
    .map((number) => [number, input.issues.get(number)])
    .filter((entry) => entry[1])
  if (resolving.length === 0) return errors

  const issuePriorities = resolving
    .map(([, issue]) => issue.priority?.toLowerCase())
    .filter((priority) => PRIORITIES.includes(priority))
  if (priorities.length === 0 && issuePriorities.length > 0) {
    const highest = issuePriorities.sort(
      (left, right) => PRIORITIES.indexOf(left) - PRIORITIES.indexOf(right),
    )[0]
    errors.push(`PR Priority 应为 ${highest}`)
  } else if (priorities.length === 1 && issuePriorities.length !== resolving.length) {
    errors.push('有 Priority 的解决型 PR 要求每个被解决 Issue 都设置 Priority')
  } else if (priorities.length === 1) {
    const highest = issuePriorities.sort(
      (left, right) => PRIORITIES.indexOf(left) - PRIORITIES.indexOf(right),
    )[0]
    if (priorities[0] !== highest) errors.push(`PR Priority 应为 ${highest}`)
  }
  return errors
}

function token() {
  const value = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (!value) throw new Error('GH_TOKEN 或 GITHUB_TOKEN 未设置')
  return value
}

function projectToken() {
  return process.env.PROJECT_TOKEN || token()
}

async function api(path, options = {}) {
  const response = await fetch(`${process.env.GITHUB_API_URL ?? 'https://api.github.com'}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token()}`,
      'X-GitHub-Api-Version': API_VERSION,
      'User-Agent': 'dsh-issue-policy',
      ...options.headers,
    },
  })
  if (options.allow404 && response.status === 404) return null
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${options.method ?? 'GET'} ${path}: ${response.status} ${body}`)
  }
  if (response.status === 204) return null
  return response.json()
}

async function graphql(query, variables) {
  const result = await api('/graphql', {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
    headers: {
      Authorization: `Bearer ${projectToken()}`,
      'Content-Type': 'application/json',
    },
  })
  if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join('; '))
  return result.data
}

/**
 * Read one Issue together with its Project planning values.
 * @param {number} number Same-repository Issue number.
 * @param {string|null|undefined} status Optional known Project status.
 * @returns {Promise<object|null>} Issue snapshot, or null when the number identifies a pull request.
 */
export async function issueSnapshot(number, status = undefined) {
  const issue = await api(`/repos/${config.organization}/${config.repository}/issues/${number}`)
  if (issue.pull_request) return null
  const context = await projectContext(number)
  return {
    number,
    nodeId: issue.node_id,
    title: issue.title,
    body: issue.body ?? '',
    assignees: issue.assignees.map((assignee) => assignee.login),
    labels: issue.labels.map((label) => label.name),
    type: issue.type?.name ?? null,
    priority: context.item?.priorityValue?.name ?? null,
    status: status === undefined ? (context.item?.fieldValueByName?.name ?? null) : status,
    state: issue.state,
    stateReason: issue.state_reason ?? null,
  }
}

async function projectContext(number, includeStartDate = false) {
  const data = await graphql(
    `query(
      $organization: String!
      $repository: String!
      $number: Int!
      $project: Int!
      $includeStartDate: Boolean!
      $priorityField: String!
      $startDateField: String!
    ) {
      repository(owner: $organization, name: $repository) {
        owner {
          __typename
          ... on User { login projectV2(number: $project) { id title fields(first: 50) { nodes { ... on ProjectV2Field { id name dataType isIssueField } ... on ProjectV2SingleSelectField { id name dataType isIssueField options { id name } } } } } }
          ... on Organization { login projectV2(number: $project) { id title fields(first: 50) { nodes { ... on ProjectV2Field { id name dataType isIssueField } ... on ProjectV2SingleSelectField { id name dataType isIssueField options { id name } } } } } }
        }
        issue(number: $number) {
          id
          projectItems(first: 20, includeArchived: true) {
            nodes {
              id
              project { id }
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
              }
              priorityValue: fieldValueByName(name: $priorityField) {
                ... on ProjectV2ItemFieldSingleSelectValue { name optionId }
              }
              startDateValue: fieldValueByName(name: $startDateField)
                @include(if: $includeStartDate) {
                ... on ProjectV2ItemFieldDateValue { date }
              }
            }
          }
        }
      }
    }`,
    {
      organization: config.organization,
      repository: config.repository,
      number,
      project: config.projectNumber,
      includeStartDate,
      priorityField: config.priorityField,
      startDateField: config.startDateField,
    },
  )
  const project = data.repository?.owner?.projectV2
  const issue = data.repository?.issue
  if (!project || project.title !== config.projectTitle) throw new Error('目标 Project 不存在或标题不匹配')
  if (!issue) throw new Error(`#${number} 不存在`)
  const statusField = project.fields.nodes.find((field) => field?.name === 'Status')
  if (!statusField) throw new Error('Project 缺少 Status 字段')
  const priorityField = project.fields.nodes.find((field) => field?.name === config.priorityField)
  if (!priorityField) throw new Error(`Project 缺少 ${config.priorityField} 字段`)
  if (priorityField.dataType !== 'SINGLE_SELECT') {
    throw new Error(`Project ${config.priorityField} 字段必须为 Single Select`)
  }
  if (priorityField.isIssueField) {
    throw new Error(`Project ${config.priorityField} 字段必须为 Project custom field`)
  }
  const startDateField = includeStartDate
    ? project.fields.nodes.find((field) => field?.name === config.startDateField)
    : null
  if (includeStartDate && !startDateField) {
    throw new Error(`Project 缺少 ${config.startDateField} 字段`)
  }
  if (startDateField && startDateField.dataType !== 'DATE') {
    throw new Error(`Project ${config.startDateField} 字段必须为 Date`)
  }
  if (startDateField?.isIssueField) {
    throw new Error(`Project ${config.startDateField} 字段必须为 Project Date 字段`)
  }
  const item = issue.projectItems.nodes.find((candidate) => candidate.project.id === project.id)
  return { project, issue, statusField, priorityField, startDateField, item }
}

async function ensureProjectItem(number, includeStartDate = false) {
  const context = await projectContext(number, includeStartDate)
  if (context.item) return context
  const data = await graphql(
    `mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }`,
    { projectId: context.project.id, contentId: context.issue.id },
  )
  return {
    ...context,
    item: {
      id: data.addProjectV2ItemById.item.id,
      fieldValueByName: null,
      priorityValue: null,
      startDateValue: null,
    },
  }
}

/**
 * Initialize one Issue's Project Start Date when it is empty.
 * @param {number} number Same-repository Issue number.
 * @param {string} date Date in YYYY-MM-DD form.
 * @returns {Promise<void>} Resolves after the conditional Project update.
 */
export async function initializeIssueStartDate(number, date) {
  const context = await ensureProjectItem(number, true)
  if (context.item.startDateValue?.date) return
  await graphql(
    `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId,
        itemId: $itemId,
        fieldId: $fieldId,
        value: {date: $date}
      }) { projectV2Item { id } }
    }`,
    {
      projectId: context.project.id,
      itemId: context.item.id,
      fieldId: context.startDateField.id,
      date,
    },
  )
}

/**
 * Initialize every referenced Issue from a newly opened PR.
 * @param {{createdAt: string, references: {all: number[]}}} pull Pull-request snapshot.
 * @param {string} action Pull-request event action.
 * @param {(number: number, date: string) => Promise<void>} initialize Date writer.
 * @returns {Promise<void>} Resolves after all eligible Issues are processed.
 */
export async function initializePullRequestStartDates(
  pull,
  action,
  initialize = initializeIssueStartDate,
) {
  if (action !== 'opened') return
  const date = projectDate(pull.createdAt)
  for (const number of pull.references.all) await initialize(number, date)
}

async function updateStatus(context, status) {
  const option = context.statusField.options.find((candidate) => candidate.name === status)
  if (!option) throw new Error(`Status 不存在：${status}`)
  if (context.item.fieldValueByName?.name === status) return
  await graphql(
    `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId,
        itemId: $itemId,
        fieldId: $fieldId,
        value: {singleSelectOptionId: $optionId}
      }) { projectV2Item { id } }
    }`,
    {
      projectId: context.project.id,
      itemId: context.item.id,
      fieldId: context.statusField.id,
      optionId: option.id,
    },
  )
}

/**
 * Add one Issue to the Project and write a default Status when the item has none.
 * @param {number} number Same-repository Issue number.
 * @param {string} status Status used only when the Project item has no Status.
 * @returns {Promise<object>} Project context with a non-empty Status value.
 */
export async function initializeIssueProjectStatus(
  number,
  status = DEFAULT_ISSUE_STATUS,
) {
  const context = await ensureProjectItem(number)
  if (context.item.fieldValueByName?.name) return context
  const option = context.statusField.options.find((candidate) => candidate.name === status)
  if (!option) throw new Error(`Status 不存在：${status}`)
  await updateStatus(context, status)
  return {
    ...context,
    item: {
      ...context.item,
      fieldValueByName: { name: status, optionId: option.id },
    },
  }
}

async function updateIssueState(number, state, stateReason) {
  await api(`/repos/${config.organization}/${config.repository}/issues/${number}`, {
    method: 'PATCH',
    body: JSON.stringify({
      state,
      ...(stateReason !== undefined ? { state_reason: stateReason } : {}),
    }),
    headers: { 'Content-Type': 'application/json' },
  })
}

async function setStatus(number, status) {
  await updateStatus(await ensureProjectItem(number), status)
}

async function listClosedCompletedIssueNumbers() {
  const numbers = []
  for (let page = 1; ; page += 1) {
    const issues = await api(
      `/repos/${config.organization}/${config.repository}/issues?state=closed&per_page=100&page=${page}`,
    )
    for (const issue of issues) {
      if (!issue.pull_request && issue.state_reason === 'completed') numbers.push(issue.number)
    }
    if (issues.length < 100) return numbers
  }
}

async function assertIssueReadyForLaneTransition(number, workflowEvent, currentStatus) {
  const issue = await issueSnapshot(number, currentStatus)
  if (issue === null) throw new Error(`#${number} 不是 Issue`)
  const errors = validateIssue(issue)
  const completedErrors = workflowEvent === 'completed' ? validateDeliveryGateCertificate(issue.body) : []
  if (workflowEvent === 'completed') {
    errors.push(...completedErrors)
  }
  if (errors.length > 0) {
    return { passed: false, errors, completedErrors }
  }
  return { passed: true, errors: [], completedErrors: [] }
}

async function applyIssueWorkflowTransition(request) {
  if (request.workflowEvent === RECOVER_ILLEGAL_CLOSED_WORKFLOW_EVENT) {
    await recoverIllegalClosedIssues()
    return
  }
  if (request.workflowEvent === RECOVER_CLOSED_WORKFLOW_EVENT) {
    await recoverClosedIssue(request.number)
    return
  }
  const context = await initializeIssueProjectStatus(request.number)
  assertWorkflowIssueTransitionAllowed(context.item.fieldValueByName?.name ?? null, request.workflowEvent)
  const gateCheck = await assertIssueReadyForLaneTransition(
    request.number,
    request.workflowEvent,
    context.item.fieldValueByName?.name ?? null,
  )
  if (!gateCheck.passed) {
    await upsertAudit(
      request.number,
      gateCheck.errors,
    )
    if (request.workflowEvent === 'completed' && gateCheck.completedErrors.length > 0) {
      throw new Error(`Issue #${request.number} 缺少交付门禁证明，不能完成关闭`)
    }
    throw new Error(`Issue #${request.number} 在 ${request.workflowEvent} 前未通过泳道门禁`)
  }
  if (request.issueState) {
    await updateIssueState(request.number, request.issueState, request.stateReason)
  }
  await updateStatus(context, request.status)
  await auditIssue(
    request.number,
    [],
    request.status,
    `泳道事件 ${request.workflowEvent} 到 ${request.status} 的门禁检查通过`,
    request.issueState,
    request.stateReason,
  )
}

async function handleClosedIssue(eventIssue) {
  const number = eventIssue.number
  const context = await initializeIssueProjectStatus(number)
  if (eventIssue.state_reason === 'not_planned') {
    await updateStatus(context, 'No action')
    await auditIssue(
      number,
      [],
      'No action',
      `Issue #${number} 已按 ${eventIssue.state_reason} 关闭，No action 泳道校验通过`,
      'closed',
      'not_planned',
    )
    return
  }

  const issueBody =
    typeof eventIssue.body === 'string'
      ? eventIssue.body
      : ((await issueSnapshot(number, context.item.fieldValueByName?.name ?? undefined))?.body ?? '')
  const errors = validateDeliveryGateCertificate(issueBody)
  if (errors.length > 0) {
    const recoveryStatus = recoveryStatusForBlockedClose(context.item.fieldValueByName?.name ?? null)
    await updateIssueState(number, 'open')
    await updateStatus(context, recoveryStatus)
    await upsertAudit(number, [
      ...errors,
      `非法关闭已恢复到 ${recoveryStatus}，需要补齐未完成任务、证据和门禁检查后再关闭`,
    ])
    return
  }

  await updateStatus(context, 'Done')
  await auditIssue(
    number,
    [],
    'Done',
    `Issue #${number} 已完成关闭，Done 泳道校验通过`,
    'closed',
    'completed',
  )
}

async function recoverClosedIssue(number) {
  const issue = await issueSnapshot(number)
  if (issue === null) throw new Error(`#${number} 不是 Issue`)
  if (issue.state !== 'closed' || issue.stateReason !== 'completed') {
    return { number, recovered: false, reason: 'not_completed_close' }
  }
  const errors = validateDeliveryGateCertificate(issue.body)
  if (errors.length === 0) {
    if (issue.status !== 'Done') await setStatus(number, 'Done')
    process.stdout.write(`Issue #${number} 已有交付门禁证明，保持关闭。\n`)
    return { number, recovered: false, reason: 'delivery_gate_present' }
  }
  const recoveryStatus = recoveryStatusForBlockedClose(issue.status)
  if (issue.state !== 'open') await updateIssueState(number, 'open')
  await setStatus(number, recoveryStatus)
  await upsertAudit(number, [
    ...errors,
    `非法关闭已恢复到 ${recoveryStatus}，需要补齐未完成任务、证据和门禁检查后再关闭`,
  ])
  return { number, recovered: true, status: recoveryStatus }
}

export async function recoverIllegalClosedIssues() {
  const numbers = await listClosedCompletedIssueNumbers()
  const recovered = []
  const skipped = []
  for (const number of numbers) {
    const result = await recoverClosedIssue(number)
    if (result.recovered) recovered.push({ number: result.number, status: result.status })
    else skipped.push({ number: result.number, reason: result.reason })
  }
  process.stdout.write(
    `Recovered ${recovered.length} illegal completed Issue close(s); skipped ${skipped.length} gated Issue close(s).\n`,
  )
  return { recovered, skipped }
}

async function upsertAudit(number, errors, passMessage = '') {
  const comments = await api(
    `/repos/${config.organization}/${config.repository}/issues/${number}/comments?per_page=100`,
  )
  const existing = comments.find(
    (comment) => comment.user?.type === 'Bot' && comment.body?.includes(AUDIT_MARKER),
  )
  if (errors.length === 0) {
    if (!passMessage) {
      if (existing) {
        await api(`/repos/${config.organization}/${config.repository}/issues/comments/${existing.id}`, {
          method: 'DELETE',
        })
      }
      return
    }
    const body = `${AUDIT_MARKER}\n✅ Issue policy 通过：\n\n- ${passMessage}`
    if (existing) {
      if (existing.body === body) return
      await api(`/repos/${config.organization}/${config.repository}/issues/comments/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
        headers: { 'Content-Type': 'application/json' },
      })
      return
    }
    await api(`/repos/${config.organization}/${config.repository}/issues/${number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
      headers: { 'Content-Type': 'application/json' },
    })
    return
  }
  const body = `${AUDIT_MARKER}\n⚠️ Issue policy 未通过：\n\n${errors.map((error) => `- ${error}`).join('\n')}`
  if (existing) {
    if (existing.body === body) return
    await api(`/repos/${config.organization}/${config.repository}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
      headers: { 'Content-Type': 'application/json' },
    })
  } else {
    await api(`/repos/${config.organization}/${config.repository}/issues/${number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function auditIssue(
  number,
  extraErrors = [],
  status = undefined,
  passMessage = '',
  issueState = undefined,
  stateReason = undefined,
) {
  const issue = await issueSnapshot(number, status)
  if (!issue) return []
  const checkedIssue = {
    ...issue,
    ...(issueState !== undefined ? { state: issueState } : {}),
    ...(stateReason !== undefined ? { stateReason } : {}),
  }
  const errors = [...extraErrors, ...validateIssue(checkedIssue)]
  const finalPassMessage = errors.length
    ? ''
    : (passMessage || `Issue #${number} 当前状态 ${checkedIssue.status ?? 'In review'} 的泳道校验通过`)
  await upsertAudit(number, errors, finalPassMessage)
  return errors
}

async function resolvingReferencesSnapshot(number, pull) {
  const references = parseReferences({
    body: pull.body ?? '',
    repository: `${config.organization}/${config.repository}`,
  })
  const issues = new Map()
  for (const issueNumber of references.all) {
    const issue = await issueSnapshot(issueNumber, null)
    if (issue) issues.set(issueNumber, issue)
  }
  return {
    number,
    references: retainIssueReferences(references, issues),
    issues,
  }
}

async function pullRequestSnapshot(number) {
  const [pull, reviewRequests, reviews] = await Promise.all([
    api(`/repos/${config.organization}/${config.repository}/pulls/${number}`),
    api(`/repos/${config.organization}/${config.repository}/pulls/${number}/requested_reviewers`),
    api(`/repos/${config.organization}/${config.repository}/pulls/${number}/reviews?per_page=100`),
  ])
  const resolving = await resolvingReferencesSnapshot(number, pull)
  return {
    ...resolving,
    isDraft: pull.draft,
    authorType: pull.user?.type ?? 'User',
    reviewRequestCount: reviewRequests.users.length + reviewRequests.teams.length,
    reviewCount: reviews.length,
    labels: pull.labels.map((label) => label.name),
  }
}

async function lifecyclePullRequestSnapshot(number) {
  const pull = await api(`/repos/${config.organization}/${config.repository}/pulls/${number}`)
  return {
    ...(await resolvingReferencesSnapshot(number, pull)),
    createdAt: pull.created_at,
  }
}

async function runPullRequestCheck(event) {
  const pull = await pullRequestSnapshot(event.pull_request.number)
  const errors = validatePullRequest(pull)
  if (errors.length > 0) {
    for (const error of errors) process.stdout.write(`::error::${error}\n`)
    throw new Error(`Issue policy 未通过，共 ${errors.length} 项`)
  }
  process.stdout.write(
    requiresPullRequestPolicy(pull) ? 'Issue policy 通过。\n' : 'PR 尚未进入 Issue policy 强制范围。\n',
  )
}

export async function runLifecycle(eventName, event) {
  if (eventName === 'schedule') {
    await recoverIllegalClosedIssues()
    return
  }

  if (eventName === 'issues') {
    const number = event.issue.number
    if (event.action === 'opened') await setStatus(number, 'Inbox')
    if (event.action === 'closed') {
      await handleClosedIssue(event.issue)
      return
    }
    if (event.action === 'reopened') {
      await setStatus(number, 'Inbox')
    }
    await initializeIssueProjectStatus(number)
    await auditIssue(number)
    return
  }

  if (eventName === 'workflow_dispatch') {
    const request = workflowDispatchIssueRequest(event.inputs ?? {})
    await applyIssueWorkflowTransition(request)
    return
  }

  if (eventName === 'pull_request' && event.action === 'opened') {
    const pull = await lifecyclePullRequestSnapshot(event.pull_request.number)
    await initializePullRequestStartDates(pull, event.action)
  }
}

function readEvent() {
  if (!process.env.GITHUB_EVENT_PATH) throw new Error('GITHUB_EVENT_PATH 未设置')
  return JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
}

async function main(argv) {
  const [command] = argv
  if (command === 'pr') await runPullRequestCheck(readEvent())
  else if (command === 'lifecycle') await runLifecycle(process.env.GITHUB_EVENT_NAME, readEvent())
  else throw new Error('用法：policy.mjs pr|lifecycle')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
