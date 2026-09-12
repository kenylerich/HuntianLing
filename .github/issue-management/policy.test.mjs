import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertWorkflowIssueTransitionAllowed,
  countVisibleUnits,
  initializeIssueProjectStatus,
  initializeIssueStartDate,
  initializePullRequestStartDates,
  issueSnapshot,
  parseDeliveryGateCertificate,
  parseReferences,
  projectDate,
  recoveryStatusForBlockedClose,
  retainIssueReferences,
  requiresPullRequestPolicy,
  runLifecycle,
  validateDeliveryGateCertificate,
  validateBody,
  validateIssue,
  validatePullRequest,
  workflowDispatchIssueRequest,
  workflowIssueTransition,
} from './policy.mjs'

const projectStatusOptions = [
  'Inbox',
  'Backlog',
  'Ready',
  'In progress',
  'In review',
  'Done',
  'No action',
].map((name) => ({
  id: `${name.toLowerCase().replaceAll(' ', '-')}-option-id`,
  name,
}))

const projectGraphqlData = ({
  projectItem = true,
  status = 'Inbox',
  priority = null,
  priorityField = true,
  priorityType = 'SINGLE_SELECT',
  priorityIsIssueField = false,
  startDate = null,
  startDateField = true,
  startDateType = 'DATE',
  startDateIsIssueField = false,
} = {}) => ({
  // HuntianLing's issue-management Project is a user-level ProjectV2, not
  // an organization-level one. policy.mjs queries the owner through a
  // union node nested under `repository`, so the mock here mirrors
  // `repository.owner.<User|Organization>.projectV2`.
  repository: {
    owner: {
      __typename: 'User',
      login: 'kenylerich',
      projectV2: {
        id: 'project-id',
        title: 'HuntianLing project',
        fields: {
          nodes: [
            {
              id: 'status-field-id',
              name: 'Status',
              dataType: 'SINGLE_SELECT',
              isIssueField: false,
              options: projectStatusOptions,
            },
            ...(priorityField
              ? [
                  {
                    id: 'priority-project-field-id',
                    name: 'Priority',
                    dataType: priorityType,
                    isIssueField: priorityIsIssueField,
                    options: [],
                  },
                ]
              : []),
            ...(startDateField
              ? [
                  {
                    id: 'start-date-field-id',
                    name: 'Start date',
                    dataType: startDateType,
                    isIssueField: startDateIsIssueField,
                  },
                ]
              : []),
          ],
        },
      },
    },
    issue: {
      id: 'issue-id',
      projectItems: {
        nodes: projectItem
          ? [
              {
                id: 'item-id',
                project: { id: 'project-id' },
                fieldValueByName:
                  status === null
                    ? null
                    : { name: status, optionId: `${status.toLowerCase().replaceAll(' ', '-')}-option-id` },
                priorityValue:
                  priority === null ? null : { name: priority, optionId: `${priority}-option-id` },
                startDateValue: startDate === null ? null : { date: startDate },
              },
            ]
          : [],
      },
    },
  },
})

const mockGraphql = (t, resolve) => {
  const requests = []
  const previousToken = process.env.GH_TOKEN
  process.env.GH_TOKEN = 'test-token'
  t.after(() => {
    if (previousToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousToken
  })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.github.com/graphql')
    assert.equal(options.headers.Authorization, 'Bearer test-token')
    const request = JSON.parse(options.body)
    requests.push(request)
    return Response.json({ data: resolve(request, requests.length - 1) })
  })
  return requests
}

const withDetails = (summary) =>
  `${summary}\n\n<details><summary>验收与细节</summary>待补充。</details>`

const deliveryGateCertificate = [
  '<!-- huntianling-delivery-gate -->',
  '- WorkItem: HTL-42',
  '- Acceptance: passed by acceptance coverage',
  '- Code: PR #17',
  '- Review: approved by reviewer',
  '- CI: passed in CI run 2026-09-10',
  '- Evidence: evidence-board record EV-42',
  '- Gates: passed',
].join('\n')

const legalIssue = {
  title: '完成议题管理校验',
  body: withDetails('完成议题管理校验。'),
  assignees: [],
  labels: [],
  type: 'Idea',
  priority: null,
  status: 'In review',
  state: 'open',
  stateReason: null,
}

const canonicalKinds = [
  'kind/feature',
  'kind/bug-fix',
  'kind/doc',
  'kind/testing',
  'kind/cleanup',
  'kind/dependency',
]

// Keep an independent oracle rather than importing the implementation's reserved set.
const legacyLabels = [
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
]

const reviewedPull = (labels) => ({
  isDraft: false,
  authorType: 'User',
  reviewRequestCount: 1,
  reviewCount: 0,
  labels,
  references: { all: [2], resolving: [], related: [2] },
  issues: new Map([[2, { priority: null }]]),
})

test('counts only text outside details', () => {
  assert.deepEqual(countVisibleUnits('支持 GitHub Project。<details>隐藏文字</details>'), {
    units: 4,
    balanced: true,
    detailsCount: 1,
    allCollapsed: true,
  })
})

test('requires a balanced default-collapsed details region', () => {
  assert.deepEqual(validateBody({ body: '完成工作。', assignees: [] }), [
    '正文必须包含默认收起的 <details> 区域',
  ])
  assert.deepEqual(
    validateBody({
      body: '完成工作。\n\n<details open><summary>细节</summary>待补充。</details>',
      assignees: [],
    }),
    ['details 必须默认收起，不得设置 open'],
  )
  assert.deepEqual(
    validateBody({ body: '完成工作。\n\n<details><summary>细节</summary>', assignees: [] }),
    ['details 标签必须成对闭合'],
  )
})

test('requires Owner for multiple assignees', () => {
  assert.deepEqual(
    validateBody({
      body: withDetails('完成工作。'),
      assignees: ['tianyicui', 'tianyicui-bot'],
    }),
    ['多个 Assignees 时首个非空行必须是 Owner: @login'],
  )
})

test('accepts an intended Owner while assignment permission is pending', () => {
  assert.deepEqual(
    validateBody({
      body: withDetails('Owner: @octocat\n\n完成工作。'),
      assignees: [],
    }),
    [],
  )
  assert.deepEqual(
    validateBody({
      body: withDetails('Owner: @octocat\n\n完成工作。'),
      assignees: ['hubot'],
    }),
    ['零或一个 Assignee 时不得写 Owner 行'],
  )
})

test('allows optional metadata in every open Status', () => {
  assert.deepEqual(validateIssue(legalIssue), [])
  for (const status of ['Inbox', 'Backlog', 'Ready', 'In progress', 'In review']) {
    assert.deepEqual(validateIssue({ ...legalIssue, status }), [])
  }
})

test('rejects metadata prefixes in an Issue title', () => {
  const errors = validateIssue({ ...legalIssue, title: '[Bug] 修复恢复错误' })
  assert.ok(errors.includes('Issue 标题不得带 Type、Priority、Status、area 或 Owner 前缀'))
})

test('reserves PR kind and legacy labels for pull requests', () => {
  for (const label of [
    ...canonicalKinds,
    'kind/experimental',
    ...legacyLabels,
  ]) {
    assert.ok(
      validateIssue({ ...legalIssue, labels: [label] }).some((error) =>
        error.startsWith('Issue 不得使用 PR kind 或旧版标签：'),
      ),
      label,
    )
  }
  assert.deepEqual(validateIssue({ ...legalIssue, labels: ['area/web', 'source/member'] }), [])
})

test('keeps terminal Status aligned with the native close reason', () => {
  assert.deepEqual(
    validateIssue({
      ...legalIssue,
      body: withDetails(`完成议题管理校验。\n\n${deliveryGateCertificate}`),
      status: 'Done',
      state: 'closed',
      stateReason: 'completed',
    }),
    [],
  )
  assert.deepEqual(
    validateIssue({
      ...legalIssue,
      status: 'No action',
      state: 'closed',
      stateReason: 'not_planned',
    }),
    [],
  )
  assert.ok(validateIssue({ ...legalIssue, status: 'Done' }).includes('Done 必须对应 Completed 关闭原因'))
  assert.ok(
    validateIssue({
      ...legalIssue,
      status: 'Done',
      state: 'closed',
      stateReason: 'completed',
    }).includes('Done 必须包含 <!-- huntianling-delivery-gate --> 交付门禁证明块'),
  )
})

test('requires a delivery gate certificate before an Issue can be Done', () => {
  assert.deepEqual(parseDeliveryGateCertificate(deliveryGateCertificate), {
    present: true,
    fields: {
      workItem: 'HTL-42',
      acceptance: 'passed by acceptance coverage',
      code: 'PR #17',
      review: 'approved by reviewer',
      ci: 'passed in CI run 2026-09-10',
      evidence: 'evidence-board record EV-42',
      gates: 'passed',
    },
  })
  assert.deepEqual(validateDeliveryGateCertificate(deliveryGateCertificate), [])
  assert.deepEqual(
    validateDeliveryGateCertificate('<!-- huntianling-delivery-gate -->\n- WorkItem: HTL-42\n- Gates: pending'),
    [
      '交付门禁证明缺少 Acceptance',
      '交付门禁证明缺少 Code',
      '交付门禁证明缺少 Review',
      '交付门禁证明缺少 CI',
      '交付门禁证明缺少 Evidence',
      '交付门禁证明 Gates 仍未完成',
      '交付门禁证明 Gates 必须明确通过',
    ],
  )
  assert.equal(recoveryStatusForBlockedClose('Ready'), 'Ready')
  assert.equal(recoveryStatusForBlockedClose('Done'), 'In review')
  assert.equal(recoveryStatusForBlockedClose(null), 'In review')
})

test('separates resolving and informational references', () => {
  assert.deepEqual(
    parseReferences({
      body: 'Fixes #12\nRelated to #4\nRefs deepseekharness/dsh-test#7',
      repository: 'deepseekharness/dsh-test',
    }),
    { all: [4, 7, 12], resolving: [12], related: [4, 7] },
  )
})

test('converts PR creation timestamps to Shanghai Project dates', () => {
  assert.equal(projectDate('2026-08-27T15:59:59Z', 'Asia/Shanghai'), '2026-08-27')
  assert.equal(projectDate('2026-08-27T16:00:00Z', 'Asia/Shanghai'), '2026-08-28')
  assert.throws(() => projectDate('invalid', 'Asia/Shanghai'), /无效的 PR 创建时间/)
})

test('parses manual workflow event inputs', () => {
  assert.deepEqual(
    workflowDispatchIssueRequest({
      issue_number: '42',
      workflow_event: 'work_started',
    }),
    { number: 42, workflowEvent: 'work_started', status: 'In progress' },
  )
  assert.deepEqual(workflowDispatchIssueRequest({ issue_number: '42' }), {
    number: 42,
    workflowEvent: 'intake',
    status: 'Inbox',
  })
  assert.deepEqual(
    workflowDispatchIssueRequest({
      issue_number: '42',
      workflow_event: 'recover_closed',
    }),
    { number: 42, workflowEvent: 'recover_closed', status: 'In review', issueState: 'open' },
  )
  assert.deepEqual(
    workflowDispatchIssueRequest({
      workflow_event: 'recover_illegal_closed',
    }),
    { workflowEvent: 'recover_illegal_closed', status: 'In review', issueState: 'open' },
  )
  assert.throws(
    () => workflowDispatchIssueRequest({ issue_number: '0' }),
    /issue_number 必须是正整数/,
  )
  assert.throws(
    () => workflowDispatchIssueRequest({ workflow_event: 'triaged' }),
    /issue_number 必须是正整数/,
  )
  assert.throws(
    () => workflowDispatchIssueRequest({ issue_number: '42', workflow_event: 'implementation' }),
    /workflow_event 必须为/,
  )
})

test('initializes every referenced Issue only for a PR opened event', async () => {
  const writes = []
  const pull = {
    createdAt: '2026-08-27T16:00:00Z',
    references: { all: [4, 7, 12] },
  }
  const initialize = async (number, date) => writes.push({ number, date })

  await initializePullRequestStartDates(pull, 'opened', initialize)
  assert.deepEqual(writes, [
    { number: 4, date: '2026-08-28' },
    { number: 7, date: '2026-08-28' },
    { number: 12, date: '2026-08-28' },
  ])

  for (const action of ['edited', 'synchronize', 'reopened']) {
    await initializePullRequestStartDates(pull, action, initialize)
  }
  assert.equal(writes.length, 3)
})

test('reads Priority and Status from Project custom fields', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousGithubToken = process.env.GITHUB_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  delete process.env.GH_TOKEN
  process.env.GITHUB_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousGithubToken === undefined) delete process.env.GITHUB_TOKEN
    else process.env.GITHUB_TOKEN = previousGithubToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })
  const urls = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(url)
    if (url.endsWith('/issues/42')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-id',
        title: 'Project metadata',
        body: null,
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'open',
        state_reason: null,
      })
    }
    assert.equal(url, 'https://api.github.com/graphql')
    assert.equal(options.headers.Authorization, 'Bearer project-token')
    return Response.json({ data: projectGraphqlData({ priority: 'P1' }) })
  })

  const issue = await issueSnapshot(42)

  assert.equal(issue.priority, 'P1')
  assert.equal(issue.status, 'Inbox')
  // The first URL is the REST lookup of the issue itself, which policy.mjs
  // composes from config.organization / config.repository. The second is
  // the GraphQL endpoint that retrieves the Project state.
  assert.deepEqual(urls, [
    'https://api.github.com/repos/kenylerich/HuntianLing/issues/42',
    'https://api.github.com/graphql',
  ])
})

test('writes an empty Project Start Date with the configured field', async (t) => {
  const requests = mockGraphql(t, (request) => {
    if (request.query.includes('query(')) return projectGraphqlData()
    return { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } }
  })

  await initializeIssueStartDate(42, '2026-08-28')

  assert.equal(requests.length, 2)
  assert.match(requests[0].query, /isIssueField/)
  assert.doesNotMatch(requests[0].query, /issueField\s*\{/)
  assert.match(requests[0].query, /priorityValue: fieldValueByName/)
  assert.equal(requests[0].variables.priorityField, 'Priority')
  assert.match(requests[0].query, /ProjectV2ItemFieldDateValue/)
  assert.match(requests[1].query, /updateProjectV2ItemFieldValue/)
  assert.match(requests[1].query, /value: \{date: \$date\}/)
  assert.deepEqual(requests[1].variables, {
    projectId: 'project-id',
    itemId: 'item-id',
    fieldId: 'start-date-field-id',
    date: '2026-08-28',
  })
})

test('preserves an existing Project Start Date', async (t) => {
  const requests = mockGraphql(t, () => projectGraphqlData({ startDate: '2026-08-01' }))

  await initializeIssueStartDate(42, '2026-08-28')

  assert.equal(requests.length, 1)
})

test('writes a default Project Status when the card has none', async (t) => {
  const requests = mockGraphql(t, (request) => {
    if (request.query.includes('query(')) return projectGraphqlData({ status: null })
    return { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } }
  })

  const context = await initializeIssueProjectStatus(42)

  assert.equal(context.item.fieldValueByName.name, 'Inbox')
  assert.equal(requests.length, 2)
  assert.match(requests[1].query, /updateProjectV2ItemFieldValue/)
  assert.deepEqual(requests[1].variables, {
    projectId: 'project-id',
    itemId: 'item-id',
    fieldId: 'status-field-id',
    optionId: 'inbox-option-id',
  })
})

test('adds a missing Project card before writing the default Status', async (t) => {
  const requests = mockGraphql(t, (request) => {
    if (request.query.includes('query(')) return projectGraphqlData({ projectItem: false })
    if (request.query.includes('addProjectV2ItemById')) {
      return { addProjectV2ItemById: { item: { id: 'new-item-id' } } }
    }
    return { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'new-item-id' } } }
  })

  const context = await initializeIssueProjectStatus(42)

  assert.equal(context.item.id, 'new-item-id')
  assert.equal(context.item.fieldValueByName.name, 'Inbox')
  assert.equal(requests.length, 3)
  assert.deepEqual(requests[1].variables, { projectId: 'project-id', contentId: 'issue-id' })
  assert.deepEqual(requests[2].variables, {
    projectId: 'project-id',
    itemId: 'new-item-id',
    fieldId: 'status-field-id',
    optionId: 'inbox-option-id',
  })
})

test('keeps an existing Project Status during backfill', async (t) => {
  const requests = mockGraphql(t, () => projectGraphqlData({ status: 'Ready' }))

  const context = await initializeIssueProjectStatus(42)

  assert.equal(context.item.fieldValueByName.name, 'Ready')
  assert.equal(requests.length, 1)
})

test('reopens completed Issue closes that lack delivery gates and restores the review lane', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url === 'https://api.github.com/graphql') {
      assert.equal(options.headers.Authorization, 'Bearer project-token')
      if (body.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: 'Done' }) })
      return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
    }
    assert.equal(options.headers.Authorization, 'Bearer repository-token')
    if (url.endsWith('/issues/42')) return Response.json({})
    if (url.endsWith('/issues/42/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/42/comments')) return Response.json({ id: 'comment-id' })
    throw new Error(`unexpected request: ${url}`)
  })

  await runLifecycle('issues', {
    action: 'closed',
    issue: {
      number: 42,
      state_reason: 'completed',
      body: withDetails('完成但缺少交付证明。'),
    },
  })

  const reopen = requests.find((request) => request.url.endsWith('/issues/42') && request.method === 'PATCH')
  assert.deepEqual(reopen.body, { state: 'open' })
  const statusWrite = requests.find((request) =>
    request.url === 'https://api.github.com/graphql' &&
    request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrite.body.variables.optionId, 'in-review-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST')
  assert.match(auditComment.body.body, /非法关闭已恢复到 In review/)
  assert.match(auditComment.body.body, /交付门禁证明/)
})

test('writes pass audit when an Issue is closed as no action', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url.endsWith('/issues/42/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/42/comments')) return Response.json({ id: 'comment-id', body: body?.body })
    if (url === 'https://api.github.com/graphql') {
      if (body.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: 'In review' }) })
      return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
    }
    if (url.endsWith('/issues/42')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-id',
        title: '转为不做任务',
        body: withDetails('不做该议题。'),
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'closed',
        state_reason: 'not_planned',
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })

  await runLifecycle('issues', {
    action: 'closed',
    issue: {
      number: 42,
      state_reason: 'not_planned',
    },
  })

  const statusWrite = requests.find(
    (request) =>
      request.url === 'https://api.github.com/graphql' &&
      request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrite.body.variables.optionId, 'no-action-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST')
  assert.ok(auditComment?.body?.body.includes('✅ Issue policy 通过'))
  assert.ok(auditComment?.body?.body.includes('No action 泳道校验通过'))
})

test('writes pass audit when an Issue is closed as completed with delivery gates', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url.endsWith('/issues/42/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/42/comments')) return Response.json({ id: 'comment-id', body: body?.body })
    if (url === 'https://api.github.com/graphql') {
      if (body.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: 'In review' }) })
      return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
    }
    if (url.endsWith('/issues/42')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-id',
        title: '完成并交付的任务',
        body: `${withDetails('完成并交付。')}\n\n${deliveryGateCertificate}`,
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'closed',
        state_reason: 'completed',
      })
    }
    throw new Error(`unexpected request: ${url}`)
  })

  await runLifecycle('issues', {
    action: 'closed',
    issue: {
      number: 42,
      state_reason: 'completed',
    },
  })

  const statusWrite = requests.find(
    (request) =>
      request.url === 'https://api.github.com/graphql' &&
      request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrite.body.variables.optionId, 'done-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST')
  assert.ok(auditComment?.body?.body.includes('✅ Issue policy 通过'))
  assert.ok(auditComment?.body?.body.includes('Done 泳道校验通过'))
})

test('blocks lane transition when policy gate checks fail', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url.endsWith('/issues/42')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-id',
        title: '[Bug] 阻塞前端任务',
        body: withDetails('执行前门禁拦截测试。'),
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'open',
        state_reason: null,
      })
    }
    if (url.endsWith('/issues/42/comments?per_page=100')) {
      return Response.json([])
    }
    if (url.endsWith('/issues/42/comments')) {
      return Response.json({ id: 'comment-id', body: body?.body })
    }
    assert.equal(url, 'https://api.github.com/graphql')
    assert.equal(options.headers.Authorization, 'Bearer project-token')
    if (body?.query?.includes('query(')) {
      return Response.json({ data: projectGraphqlData({ status: 'Inbox' }) })
    }
    if (body?.query?.includes('updateProjectV2ItemFieldValue')) {
      assert.fail('lane transition should be blocked before status update')
    }
    throw new Error(`unexpected request: ${url}`)
  })

  await assert.rejects(
    runLifecycle('workflow_dispatch', {
      inputs: {
        issue_number: '42',
        workflow_event: 'triaged',
      },
    }),
    /在 triaged 前未通过泳道门禁/,
  )

  const auditComment = requests.find(
    (request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST',
  )
  assert.ok(auditComment?.body?.body.includes('Issue 标题不得带 Type、Priority、Status、area 或 Owner 前缀'))
})

test('writes pass audit when lane transition gate checks pass', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url.endsWith('/issues/42')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-id',
        title: '完成并有闭环证据的任务',
        body: withDetails('执行流转门禁通过示例。'),
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'open',
        state_reason: null,
      })
    }
    if (url.endsWith('/issues/42/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/42/comments')) return Response.json({ id: 'comment-id', body: body?.body })
    assert.equal(url, 'https://api.github.com/graphql')
    assert.equal(options.headers.Authorization, 'Bearer project-token')
    if (body.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: 'Inbox' }) })
    return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
  })

  await runLifecycle('workflow_dispatch', {
    inputs: {
      issue_number: '42',
      workflow_event: 'triaged',
    },
  })

  const statusWrite = requests.find(
    (request) =>
      request.url === 'https://api.github.com/graphql' &&
      request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrite.body.variables.optionId, 'backlog-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST')
  assert.ok(auditComment?.body?.body.includes('✅ Issue policy 通过'))
  assert.ok(auditComment?.body?.body.includes('泳道事件 triaged 到 Backlog 的门禁检查通过'))
})

test('checks no_action transition and writes pass audit', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url.endsWith('/issues/42')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      if (method === 'PATCH') return Response.json({})
      return Response.json({
        node_id: 'issue-id',
        title: '停办并保留证据的任务',
        body: withDetails('执行 no_action 门禁通过示例。'),
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'open',
        state_reason: null,
      })
    }
    if (url.endsWith('/issues/42/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/42/comments')) return Response.json({ id: 'comment-id', body: body?.body })
    assert.equal(url, 'https://api.github.com/graphql')
    assert.equal(options.headers.Authorization, 'Bearer project-token')
    if (body.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: 'In review' }) })
      return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
  })

  await runLifecycle('workflow_dispatch', {
    inputs: {
      issue_number: '42',
      workflow_event: 'no_action',
    },
  })

  const reopen = requests.find((request) => request.url.endsWith('/issues/42') && request.method === 'PATCH')
  assert.deepEqual(reopen.body, { state: 'closed', state_reason: 'not_planned' })
  const statusWrite = requests.find(
    (request) =>
      request.url === 'https://api.github.com/graphql' &&
      request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrite.body.variables.optionId, 'no-action-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST')
  assert.ok(auditComment?.body?.body.includes('✅ Issue policy 通过'))
  assert.ok(auditComment?.body?.body.includes('泳道事件 no_action 到 No action 的门禁检查通过'))
})

test('checks completed transition with delivery gate certificate and writes pass audit', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url.endsWith('/issues/42')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      if (method === 'PATCH') return Response.json({})
      return Response.json({
        node_id: 'issue-id',
        title: '完成并交付的任务',
        body: `${withDetails('完成并交付的任务。')}\n\n${deliveryGateCertificate}`,
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'open',
        state_reason: null,
      })
    }
    if (url.endsWith('/issues/42/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/42/comments')) return Response.json({ id: 'comment-id', body: body?.body })
    assert.equal(url, 'https://api.github.com/graphql')
    assert.equal(options.headers.Authorization, 'Bearer project-token')
    if (body.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: 'In review' }) })
      return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
  })

  await runLifecycle('workflow_dispatch', {
    inputs: {
      issue_number: '42',
      workflow_event: 'completed',
    },
  })

  const closeRequest = requests.find((request) => request.url.endsWith('/issues/42') && request.method === 'PATCH')
  assert.deepEqual(closeRequest.body, { state: 'closed', state_reason: 'completed' })
  const statusWrite = requests.find(
    (request) =>
      request.url === 'https://api.github.com/graphql' &&
      request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrite.body.variables.optionId, 'done-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST')
  assert.ok(auditComment?.body?.body.includes('✅ Issue policy 通过'))
  assert.ok(auditComment?.body?.body.includes('泳道事件 completed 到 Done 的门禁检查通过'))
})

test('workflow dispatch can recover an already closed Issue card', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })
    if (url.endsWith('/issues/42') && method === 'GET') {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-id',
        title: '恢复非法关闭卡片',
        body: withDetails('完成但缺少门禁证明。'),
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'closed',
        state_reason: 'completed',
      })
    }
    if (url === 'https://api.github.com/graphql') {
      assert.equal(options.headers.Authorization, 'Bearer project-token')
      if (body.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: 'Done' }) })
      return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
    }
    assert.equal(options.headers.Authorization, 'Bearer repository-token')
    if (url.endsWith('/issues/42') && method === 'PATCH') return Response.json({})
    if (url.endsWith('/issues/42/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/42/comments')) return Response.json({ id: 'comment-id' })
    throw new Error(`unexpected request: ${url}`)
  })

  await runLifecycle('workflow_dispatch', {
    inputs: {
      issue_number: '42',
      workflow_event: 'recover_closed',
    },
  })

  const reopen = requests.find((request) => request.url.endsWith('/issues/42') && request.method === 'PATCH')
  assert.deepEqual(reopen.body, { state: 'open' })
  const statusWrites = requests.filter((request) =>
    request.url === 'https://api.github.com/graphql' &&
    request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrites.at(-1).body.variables.optionId, 'in-review-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/42/comments') && request.method === 'POST')
  assert.match(auditComment.body.body, /非法关闭已恢复到 In review/)
})

test('scheduled lifecycle recovers illegal completed closes without touching gated Done cards', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })

  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : null
    requests.push({ url, method, body })

    if (url.endsWith('/issues?state=closed&per_page=100&page=1')) {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json([
        { number: 41, state_reason: 'completed' },
        { number: 42, state_reason: 'not_planned' },
        { number: 43, state_reason: 'completed', pull_request: {} },
        { number: 44, state_reason: 'completed' },
      ])
    }
    if (url.endsWith('/issues/41') && method === 'GET') {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-41-id',
        title: '恢复缺证据卡片',
        body: withDetails('完成但缺少交付证明。'),
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'closed',
        state_reason: 'completed',
      })
    }
    if (url.endsWith('/issues/44') && method === 'GET') {
      assert.equal(options.headers.Authorization, 'Bearer repository-token')
      return Response.json({
        node_id: 'issue-44-id',
        title: '保持合法完成卡片',
        body: `${withDetails('合法完成。')}\n\n${deliveryGateCertificate}`,
        assignees: [],
        labels: [],
        type: { name: 'Task' },
        state: 'closed',
        state_reason: 'completed',
      })
    }
    if (url === 'https://api.github.com/graphql') {
      assert.equal(options.headers.Authorization, 'Bearer project-token')
      if (body.query.includes('query(')) {
        return Response.json({
          data: projectGraphqlData({ status: 'Done' }),
        })
      }
      return Response.json({
        data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } },
      })
    }

    assert.equal(options.headers.Authorization, 'Bearer repository-token')
    if (url.endsWith('/issues/41') && method === 'PATCH') return Response.json({})
    if (url.endsWith('/issues/41/comments?per_page=100')) return Response.json([])
    if (url.endsWith('/issues/41/comments')) return Response.json({ id: 'comment-id' })
    throw new Error(`unexpected request: ${url}`)
  })

  await runLifecycle('schedule', {})

  const reopens = requests.filter((request) => request.method === 'PATCH' && request.url.endsWith('/issues/41'))
  assert.deepEqual(reopens.map((request) => request.body), [{ state: 'open' }])
  assert.equal(requests.some((request) => request.method === 'PATCH' && request.url.endsWith('/issues/44')), false)
  const statusWrites = requests.filter((request) =>
    request.url === 'https://api.github.com/graphql' &&
    request.body?.query.includes('updateProjectV2ItemFieldValue'),
  )
  assert.equal(statusWrites.length, 1)
  assert.equal(statusWrites[0].body.variables.optionId, 'in-review-option-id')
  const auditComment = requests.find((request) => request.url.endsWith('/issues/41/comments') && request.method === 'POST')
  assert.match(auditComment.body.body, /非法关闭已恢复到 In review/)
  assert.match(auditComment.body.body, /交付门禁证明/)
})

test('adds a referenced Issue to the Project before setting Start Date', async (t) => {
  const requests = mockGraphql(t, (request) => {
    if (request.query.includes('query(')) return projectGraphqlData({ projectItem: false })
    if (request.query.includes('addProjectV2ItemById')) {
      return { addProjectV2ItemById: { item: { id: 'new-item-id' } } }
    }
    return { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'new-item-id' } } }
  })

  await initializeIssueStartDate(42, '2026-08-28')

  assert.equal(requests.length, 3)
  assert.deepEqual(requests[1].variables, { projectId: 'project-id', contentId: 'issue-id' })
  assert.deepEqual(requests[2].variables, {
    projectId: 'project-id',
    itemId: 'new-item-id',
    fieldId: 'start-date-field-id',
    date: '2026-08-28',
  })
})

test('rejects a missing, non-Date, or Issue-level Start Date field', async (t) => {
  let response = projectGraphqlData({ startDateField: false })
  const requests = mockGraphql(t, () => response)

  await assert.rejects(initializeIssueStartDate(42, '2026-08-28'), /Project 缺少 Start date 字段/)
  response = projectGraphqlData({ startDateType: 'TEXT' })
  await assert.rejects(initializeIssueStartDate(42, '2026-08-28'), /Start date 字段必须为 Date/)
  response = projectGraphqlData({ startDateIsIssueField: true })
  await assert.rejects(
    initializeIssueStartDate(42, '2026-08-28'),
    /Start date 字段必须为 Project Date 字段/,
  )
  assert.equal(requests.length, 3)
})

test('rejects a missing, non-select, or Issue-level Priority field', async (t) => {
  let response = projectGraphqlData({ priorityField: false })
  const requests = mockGraphql(t, () => response)

  await assert.rejects(initializeIssueStartDate(42, '2026-08-28'), /Project 缺少 Priority 字段/)
  response = projectGraphqlData({ priorityType: 'TEXT' })
  await assert.rejects(
    initializeIssueStartDate(42, '2026-08-28'),
    /Priority 字段必须为 Single Select/,
  )
  response = projectGraphqlData({ priorityIsIssueField: true })
  await assert.rejects(
    initializeIssueStartDate(42, '2026-08-28'),
    /Priority 字段必须为 Project custom field/,
  )
  assert.equal(requests.length, 3)
})

test('does not treat pull request references as Issue associations', () => {
  const references = {
    all: [123, 1180, 1181],
    resolving: [123, 1180],
    related: [1181],
  }
  const issues = new Map([
    [1180, {}],
    [1181, {}],
  ])

  assert.deepEqual(retainIssueReferences(references, issues), {
    all: [1180, 1181],
    resolving: [1180],
    related: [1181],
  })
})

test('allows informational references without cross-object constraints', () => {
  const errors = validatePullRequest({
    isDraft: false,
    authorType: 'User',
    reviewRequestCount: 1,
    reviewCount: 0,
    labels: ['kind/cleanup', 'area/infra'],
    references: { all: [4], resolving: [], related: [4] },
    issues: new Map([[4, { type: 'Bug', priority: 'P0', labels: ['area/web'] }]]),
  })
  assert.deepEqual(errors, [])
})

test('enforces highest resolving Priority without Type or area synchronization', () => {
  const pull = {
    isDraft: false,
    authorType: 'User',
    reviewRequestCount: 0,
    reviewCount: 1,
    labels: ['kind/cleanup', 'p0', 'area/web'],
    references: { all: [2, 3], resolving: [2, 3], related: [] },
    issues: new Map([
      [2, { type: 'Feature', priority: 'P2', status: 'In progress', labels: ['area/web'] }],
      [3, { type: 'Bug', priority: 'P0', status: 'In progress', labels: ['area/session'] }],
    ]),
  }
  assert.deepEqual(validatePullRequest(pull), [])
  assert.ok(
    validatePullRequest({ ...pull, labels: ['kind/cleanup', 'p2', 'area/web'] }).includes(
      'PR Priority 应为 p0',
    ),
  )
})

test('requires policy only after a human PR enters review', () => {
  assert.equal(
    requiresPullRequestPolicy({
      isDraft: false,
      authorType: 'User',
      reviewRequestCount: 1,
      reviewCount: 0,
    }),
    true,
  )
  assert.equal(
    requiresPullRequestPolicy({
      isDraft: false,
      authorType: 'User',
      reviewRequestCount: 0,
      reviewCount: 0,
    }),
    false,
  )
})

test('maps workflow events to Project Status lanes', () => {
  assert.deepEqual(workflowIssueTransition('intake'), { status: 'Inbox', from: ['Inbox'] })
  assert.deepEqual(workflowIssueTransition('triaged'), { status: 'Backlog', from: ['Inbox'] })
  assert.deepEqual(workflowIssueTransition('ready'), { status: 'Ready', from: ['Backlog'] })
  assert.deepEqual(workflowIssueTransition('work_started'), { status: 'In progress', from: ['Ready'] })
  assert.deepEqual(workflowIssueTransition('review_requested'), { status: 'In review', from: ['In progress'] })
  assert.deepEqual(workflowIssueTransition('changes_requested'), { status: 'In progress', from: ['In review'] })
  assert.deepEqual(workflowIssueTransition('completed'), {
    status: 'Done',
    from: ['In review'],
    issueState: 'closed',
    stateReason: 'completed',
  })
  assert.deepEqual(workflowIssueTransition('no_action'), {
    status: 'No action',
    from: ['Inbox', 'Backlog', 'Ready', 'In progress', 'In review'],
    issueState: 'closed',
    stateReason: 'not_planned',
  })
  assert.throws(() => workflowIssueTransition('pull_request_opened'), /workflow_event 必须为/)
})

test('blocks workflow events that skip the required Status lane', () => {
  assert.equal(assertWorkflowIssueTransitionAllowed('Ready', 'work_started'), undefined)
  assert.equal(assertWorkflowIssueTransitionAllowed('In progress', 'work_started'), undefined)
  assert.throws(
    () => assertWorkflowIssueTransitionAllowed('Backlog', 'work_started'),
    /requires current Status Ready/,
  )
  assert.throws(
    () => assertWorkflowIssueTransitionAllowed('Ready', 'completed'),
    /requires current Status In review/,
  )
})

test('keeps workflow status projection independent of PR metadata enforcement', () => {
  const pull = {
    isDraft: false,
    authorType: 'User',
    reviewRequestCount: 1,
    reviewCount: 0,
    labels: [],
    references: { all: [2], resolving: [2], related: [] },
    issues: new Map([[2, { priority: null }]]),
  }

  assert.ok(validatePullRequest(pull).length > 0)
  assert.equal(workflowIssueTransition('review_requested').status, 'In review')
})

test('exempts Draft, Bot, and App PRs', () => {
  const invalid = {
    isDraft: false,
    labels: [],
    references: { all: [], resolving: [], related: [] },
    issues: new Map(),
    reviewRequestCount: 1,
    reviewCount: 0,
  }
  assert.deepEqual(validatePullRequest({ ...invalid, authorType: 'Bot' }), [])
  assert.deepEqual(validatePullRequest({ ...invalid, authorType: 'App' }), [])
  assert.deepEqual(validatePullRequest({ ...invalid, authorType: 'User', isDraft: true }), [])
  assert.ok(validatePullRequest({ ...invalid, authorType: 'User' }).length > 0)
})

test('requires repository PR labels in the enforcement scope', () => {
  const errors = validatePullRequest({
    isDraft: false,
    authorType: 'User',
    reviewRequestCount: 1,
    reviewCount: 0,
    labels: [],
    references: { all: [2], resolving: [], related: [2] },
    issues: new Map([[2, { priority: null }]]),
  })
  assert.ok(errors.includes('PR 必须恰好有一个允许的 kind/*，当前为 0'))
  assert.ok(errors.includes('PR 必须至少有一个 area/*'))
})

test('accepts exactly the canonical kinds with extensible areas', () => {
  for (const kind of canonicalKinds) {
    assert.deepEqual(validatePullRequest(reviewedPull([kind, 'area/future-domain'])), [], kind)
  }
})

test('rejects multiple, unknown, legacy, and Issue-source PR labels', () => {
  assert.ok(
    validatePullRequest(
      reviewedPull(['kind/feature', 'kind/doc', 'area/web']),
    ).includes('PR 必须恰好有一个允许的 kind/*，当前为 2'),
  )
  assert.ok(
    validatePullRequest(reviewedPull(['kind/experimental', 'area/web'])).includes(
      'PR 含不支持的 kind/*：kind/experimental',
    ),
  )
  for (const label of legacyLabels) {
    assert.ok(
      validatePullRequest(reviewedPull(['kind/feature', 'area/web', label])).some((error) =>
        error.startsWith('PR 含旧版标签：'),
      ),
      label,
    )
  }
  assert.ok(
    validatePullRequest(
      reviewedPull(['kind/feature', 'area/web', 'source/internal-pr']),
    ).includes('source/* 仅用于 Issue：source/internal-pr'),
  )
})

test('allows missing Priority only when resolving Issues are also unprioritized', () => {
  const pull = {
    isDraft: false,
    authorType: 'User',
    reviewRequestCount: 1,
    reviewCount: 0,
    labels: ['kind/feature', 'area/web'],
    references: { all: [2], resolving: [2], related: [] },
    issues: new Map([[2, { priority: null, status: 'In progress' }]]),
  }
  assert.deepEqual(validatePullRequest(pull), [])
  assert.ok(
    validatePullRequest({ ...pull, issues: new Map([[2, { priority: 'P2', status: 'In progress' }]]) }).includes(
      'PR Priority 应为 p2',
    ),
  )
  assert.ok(
    validatePullRequest({ ...pull, labels: [...pull.labels, 'p2'] }).includes(
      '有 Priority 的解决型 PR 要求每个被解决 Issue 都设置 Priority',
    ),
  )
})

test('blocks resolving PRs before the workflow starts development', () => {
  const pull = {
    isDraft: true,
    authorType: 'User',
    reviewRequestCount: 0,
    reviewCount: 0,
    labels: [],
    references: { all: [2], resolving: [2], related: [] },
    issues: new Map([[2, { priority: null, status: 'Ready' }]]),
  }

  assert.ok(
    validatePullRequest(pull).includes(
      '#2 必须先通过工作流进入 In progress 或 In review，当前 Status 为 Ready',
    ),
  )
})

test('rejects negated and mixed gate decisions instead of matching success substrings', () => {
  for (const decision of ['not passed', 'not approved', '未通过：待审核', 'pass but CI failed', 'success pending review']) {
    const body = deliveryGateCertificate.replace('- Gates: passed', `- Gates: ${decision}`)
    assert.ok(validateDeliveryGateCertificate(body).length > 0, decision)
  }
  for (const decision of ['passed', 'PASS', 'approved', '已通过']) {
    const body = deliveryGateCertificate.replace('- Gates: passed', `- Gates: ${decision}`)
    assert.deepEqual(validateDeliveryGateCertificate(body), [], decision)
  }
})

test('recovery rechecks current Issue state and repairs a stale certified Done projection', async (t) => {
  const previousGhToken = process.env.GH_TOKEN
  const previousProjectToken = process.env.PROJECT_TOKEN
  process.env.GH_TOKEN = 'repository-token'
  process.env.PROJECT_TOKEN = 'project-token'
  t.after(() => {
    if (previousGhToken === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = previousGhToken
    if (previousProjectToken === undefined) delete process.env.PROJECT_TOKEN
    else process.env.PROJECT_TOKEN = previousProjectToken
  })
  let current = { state: 'open', reason: 'reopened', status: 'In progress', certificate: false }
  const mutations = []
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const method = options.method ?? 'GET'
    if (url.endsWith('/issues/42') && method === 'GET') {
      return Response.json({
        node_id: 'issue-id', title: '核对交付状态',
        body: withDetails('核对状态。') + (current.certificate ? `\n${deliveryGateCertificate}` : ''),
        assignees: [], labels: [], type: { name: 'Task' },
        state: current.state, state_reason: current.reason,
      })
    }
    if (url === 'https://api.github.com/graphql') {
      const request = JSON.parse(options.body)
      if (request.query.includes('query(')) return Response.json({ data: projectGraphqlData({ status: current.status }) })
      assert.ok(request.query.includes('updateProjectV2ItemFieldValue'))
      mutations.push(request.variables)
      return Response.json({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'item-id' } } } })
    }
    throw new Error(`unexpected mutation or request: ${method} ${url}`)
  })
  const recover = () => runLifecycle('workflow_dispatch', { inputs: { issue_number: '42', workflow_event: 'recover_closed' } })
  await recover()
  assert.deepEqual(mutations, [])
  current = { state: 'closed', reason: 'not_planned', status: 'No action', certificate: false }
  await recover()
  assert.deepEqual(mutations, [])
  current = { state: 'closed', reason: 'completed', status: 'In review', certificate: true }
  await recover()
  assert.equal(mutations.length, 1)
  assert.equal(mutations[0].optionId, 'done-option-id')
  current = { ...current, status: 'Done' }
  await recover()
  assert.equal(mutations.length, 1)
})
