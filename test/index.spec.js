const path = require('path')
const execa = require('execa')

const eslintPath = path.resolve(__dirname, '../node_modules/.bin/eslint')

async function lintProject (name) {
  const projectPath = path.resolve(__dirname, name)
  const filesToLint = path.resolve(projectPath, '**')

  return await execa(eslintPath, [`${filesToLint}`], {
    cwd: projectPath
  })
}

test('a default project should pass lint', async () => {
  await lintProject('default')
})

test('should lint .ts file', async () => {
  // TODO:
})

test('should lint vue sfc', async () => {
  // TODO:
})

test('should lint .tsx', async () => {
  // TODO:
})
