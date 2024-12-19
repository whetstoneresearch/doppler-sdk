module.exports = {
  disableEmoji: false,
  format: '{type}{scope}: {emoji}{subject}',
  list: ['build', 'feat', 'fix', 'refactor', 'style', 'typo'],
  maxMessageLength: 64,
  minMessageLength: 3,
  questions: ['type', 'scope', 'subject', 'body', 'breaking', 'issues', 'lerna'],
  scopes: ['', 'finess'],
  types: {
    build: {
      description: 'Build and CI/CD',
      emoji: '🤖',
      value: 'build'
    },
    feat: {
      description: 'A new feature',
      emoji: '🚀',
      value: 'feat'
    },
    fix: {
      description: 'Fix a big',
      emoji: '🔥',
      value: 'fix'
    },
    refactor: {
      description: 'Neither a bug or a feature',
      emoji: '💡',
      value: 'refactor'
    },
    typo: {
      description: 'Typo and content related',
      emoji: '👀',
      value: 'typo'
    },
    style: {
      description: 'Visual changes only',
      emoji: '🕊️ ',
      value: 'style'
    },
    messages: {
      type: 'Select the type of change that you\'re committing:',
      customScope: 'Select the scope this component affects:',
      subject: 'Write a short, imperative mood description of the change:\n',
      body: 'Provide a longer description of the change:\n ',
      breaking: 'List any breaking changes:\n',
      footer: 'Issues this commit closes, e.g #123:',
      confirmCommit: 'The packages that this commit has affected\n',
    },
  }
};
