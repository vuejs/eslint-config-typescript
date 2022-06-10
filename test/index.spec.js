const path = require('path')
const execa = require('execa')

const eslintPath = path.resolve(__dirname, '../node_modules/.bin/eslint')

async function lintProject (name) {
  const projectPath = path.resolve(__dirname, 'fixtures', name)

  try {
    return await execa(
      eslintPath,
      [
        `${projectPath}/`,
        '--ext',
        '.vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts',
        '--no-ignore'
      ],
      {
        cwd: projectPath,
      }
    )
  } catch (e) {
    return e
  }
}

test('a default project should pass lint', async () => {
  const { stdout } = await lintProject('default')
  expect(stdout).toEqual('')
})

test('should lint .ts file', async () => {
  const { stdout } = await lintProject('ts')
  expect(stdout).toMatch('@typescript-eslint/no-empty-interface')
})

test('should lint .vue file', async () => {
  const { stdout } = await lintProject('sfc')
  expect(stdout).toMatch('@typescript-eslint/no-empty-interface')
})

test('should lint .tsx', async () => {
  const { stdout } = await lintProject('tsx')
  expect(stdout).not.toMatch('Parsing error')
  expect(stdout).toMatch('@typescript-eslint/no-empty-interface')
})

test('should lint tsx block in .vue file', async () => {
  const { stdout } = await lintProject('tsx-in-sfc')
  expect(stdout).not.toMatch('Parsing error')
  expect(stdout).toMatch('@typescript-eslint/no-empty-interface')
})

test('should not override eslint:recommended rules for normal js files', async () => {
  const { stdout } = await lintProject('allow-js')
  // errors in .vue file
  expect(stdout).toMatch('no-const-assign')

  // errors in .js file
  expect(stdout).toMatch('no-undef')
})
