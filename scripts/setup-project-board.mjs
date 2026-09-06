#!/usr/bin/env node
/**
 * Provision HuntianLing Issue Management (user Project #2) so
 * issue-lifecycle.yml can add Issues and set Status / Priority / Start Date.
 *
 * Requires a token that can write user-owned Project V2. A classic PAT with
 * `repo` + `project` works; a fine-grained PAT typically does not.
 *
 *   GH_TOKEN=ghp_... node scripts/setup-project-board.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(
  fs.readFileSync(path.join(here, '../.github/issue-management/config.json'), 'utf8'),
);

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  process.stderr.write('GH_TOKEN or GITHUB_TOKEN is required.\n');
  process.exit(1);
}

const STATUS_OPTIONS = config.statuses.map((name) => ({
  name,
  description: '',
  color: statusColor(name),
}));

const PRIORITY_OPTIONS = [
  { name: 'p0', description: '', color: 'RED' },
  { name: 'p1', description: '', color: 'ORANGE' },
  { name: 'p2', description: '', color: 'YELLOW' },
  { name: 'p3', description: '', color: 'GRAY' },
];

function statusColor(name) {
  switch (name) {
    case 'Inbox':
      return 'GRAY';
    case 'Backlog':
      return 'BLUE';
    case 'Ready':
      return 'GREEN';
    case 'In progress':
      return 'YELLOW';
    case 'In review':
      return 'PURPLE';
    case 'Done':
      return 'GREEN';
    case 'No action':
      return 'RED';
    default:
      return 'GRAY';
  }
}

async function graphql(query, variables) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'huntianling-setup-project-board',
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }
  return payload.data;
}

function fieldName(node) {
  return node?.name ?? null;
}

async function main() {
  const data = await graphql(
    `query ($login: String!, $number: Int!, $owner: String!, $repo: String!) {
      user(login: $login) {
        projectV2(number: $number) {
          id
          title
          url
          fields(first: 50) {
            nodes {
              ... on ProjectV2Field { id name dataType }
              ... on ProjectV2SingleSelectField { id name dataType options { id name } }
              ... on ProjectV2IterationField { id name dataType }
            }
          }
        }
      }
      repository(owner: $owner, name: $repo) { id nameWithOwner }
    }`,
    {
      login: config.organization,
      number: config.projectNumber,
      owner: config.organization,
      repo: config.repository,
    },
  );

  const project = data.user?.projectV2;
  if (!project) {
    throw new Error(
      `Project #${config.projectNumber} was not readable. Use a classic PAT with the project scope, or a GitHub App with user Projects write.`,
    );
  }
  if (project.title !== config.projectTitle) {
    throw new Error(
      `Project title is ${JSON.stringify(project.title)}, expected ${JSON.stringify(config.projectTitle)}`,
    );
  }

  process.stdout.write(`Project ${project.url}\n`);

  const fields = (project.fields.nodes ?? []).filter(Boolean);
  const byName = new Map(fields.map((field) => [fieldName(field), field]));

  if (!byName.has('Status')) {
    process.stdout.write('Creating Status field.\n');
    await graphql(
      `mutation ($projectId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
        createProjectV2Field(input: {
          projectId: $projectId
          dataType: SINGLE_SELECT
          name: "Status"
          singleSelectOptions: $options
        }) { projectV2Field { ... on ProjectV2SingleSelectField { id name } } }
      }`,
      { projectId: project.id, options: STATUS_OPTIONS },
    );
  } else {
    process.stdout.write('Status field already present.\n');
  }

  if (!byName.has(config.priorityField)) {
    process.stdout.write(`Creating ${config.priorityField} field.\n`);
    await graphql(
      `mutation ($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
        createProjectV2Field(input: {
          projectId: $projectId
          dataType: SINGLE_SELECT
          name: $name
          singleSelectOptions: $options
        }) { projectV2Field { ... on ProjectV2SingleSelectField { id name } } }
      }`,
      { projectId: project.id, name: config.priorityField, options: PRIORITY_OPTIONS },
    );
  } else {
    process.stdout.write(`${config.priorityField} field already present.\n`);
  }

  if (!byName.has(config.startDateField)) {
    process.stdout.write(`Creating ${config.startDateField} field.\n`);
    await graphql(
      `mutation ($projectId: ID!, $name: String!) {
        createProjectV2Field(input: {
          projectId: $projectId
          dataType: DATE
          name: $name
        }) { projectV2Field { ... on ProjectV2Field { id name } } }
      }`,
      { projectId: project.id, name: config.startDateField },
    );
  } else {
    process.stdout.write(`${config.startDateField} field already present.\n`);
  }

  const repo = data.repository;
  if (!repo) throw new Error(`Repository ${config.organization}/${config.repository} was not readable.`);
  process.stdout.write(`Linking ${repo.nameWithOwner} to the Project.\n`);
  await graphql(
    `mutation ($projectId: ID!, $repositoryId: ID!) {
      linkProjectV2ToRepository(input: { projectId: $projectId, repositoryId: $repositoryId }) {
        repository { id }
      }
    }`,
    { projectId: project.id, repositoryId: repo.id },
  );

  process.stdout.write('PASS project board is ready for issue-lifecycle.yml.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
