#!/usr/bin/env node
// Packages the iOS builds into the AutoLink pod at ios/:
//   - lynx-needle.xcframework (from build/ios-*/out static libraries)
//   - addon_use.h (generated weak-napi static registration helper)
//   - lynx-needle.podspec
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function fail(message) {
  console.error(message)
  process.exit(1)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(' ')}`)
  }
}

function resolvePackageRoot(packageName) {
  return path.dirname(require.resolve(`${packageName}/package.json`))
}

function createPodspec({ outDir, name, version, summary, homepage, license, author }) {
  const podspec = `Pod::Spec.new do |s|
  s.name = '${name}'
  s.version = '${version}'
  s.summary = '${summary}'
  s.homepage = '${homepage}'
  s.license = { :type => '${license}' }
  s.author = '${author}'
  s.source = { :path => '..' }
  s.platform = :ios, '12.0'
  s.vendored_frameworks = '${name}.xcframework'
  s.source_files = 'addon_use.h'
  s.public_header_files = 'addon_use.h'
  s.preserve_paths = '${name}.xcframework', 'addon_use.h'
  s.libraries = "c++"
  s.dependency 'LynxWeakNodeAPI/core'
  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'HEADER_SEARCH_PATHS' => '$(inherited) "\${PODS_ROOT}/LynxWeakNodeAPI/packages/weak-node-api/headers" "\${PODS_TARGET_SRCROOT}/../third_party/needle/include"',
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) NAPI_VERSION=8 NAPI_CPP_CUSTOM_NAMESPACE=needle_node_api LYNX_LIBRARY_MANUAL_NAPI_REGISTRATION=1 LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE=1'
  }
end
`
  fs.writeFileSync(path.join(outDir, `${name}.podspec`), podspec)
}

function main() {
  const projectRoot = process.cwd()
  const pkg = readJson(path.join(projectRoot, 'package.json'))
  const name = 'lynx-needle'
  const version = pkg.version || '0.1.0'
  const summary = pkg.description || `${name} N-API addon`
  const homepage = pkg.homepage || 'https://github.com/nhsprite/lynx-needle'
  const license = pkg.license || 'Apache-2.0'
  const author = pkg.author || name
  const weakNodeApiHeaders = path.join(
    resolvePackageRoot('@lynx-js/weak-node-api'),
    'headers'
  )

  // cmake leaves Darwin static libraries in <build-dir>/out (see CMakeLists);
  // weak-node-api headers are only needed to let xcodebuild form an xcframework
  // from a static archive; the pod itself exposes addon_use.h as the public API.
  const candidates = [
    { buildDir: 'build/ios-device' },
    { buildDir: 'build/ios-sim' }
  ]
    .map(({ buildDir }) => ({
      library: path.join(projectRoot, buildDir, 'out', 'libNeedle.a'),
      headers: weakNodeApiHeaders
    }))
    .filter(candidate => fs.existsSync(candidate.library) && fs.existsSync(candidate.headers))

  if (candidates.length === 0) {
    fail('No Darwin static libraries found under build/*/out. Build iOS/macOS first.')
  }

  const outDir = path.join(projectRoot, 'ios')
  const xcframeworkPath = path.join(outDir, `${name}.xcframework`)
  ensureDir(outDir)
  fs.rmSync(xcframeworkPath, { recursive: true, force: true })

  const args = ['-create-xcframework']
  for (const candidate of candidates) {
    args.push('-library', candidate.library, '-headers', candidate.headers)
  }
  args.push('-output', xcframeworkPath)
  run('xcodebuild', args, projectRoot)

  createPodspec({
    outDir,
    name,
    version,
    summary,
    homepage,
    license,
    author
  })

  console.log(`Created iOS SDK pod in ${outDir}`)
}

main()
