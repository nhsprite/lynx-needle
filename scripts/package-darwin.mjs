#!/usr/bin/env node
// Packages the Darwin builds into the iOS pod at ios/:
//   - needle.xcframework (from build/ios-*/out + build/macos/out static libraries)
//   - include/addon_use.h (weak-napi static registration helper)
//   - Loader/LynxNodeAPI.{h,cc} (generated copy of cpp/; edit there)
//   - needle.podspec
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

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

function copyIfExists(from, to) {
  if (fs.existsSync(from)) {
    ensureDir(path.dirname(to))
    fs.copyFileSync(from, to)
  }
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

function createPodspec({ outDir, name, version, summary, homepage, license, author }) {
  const podspec = `Pod::Spec.new do |s|
  s.name = "${name}"
  s.version = "${version}"
  s.summary = "${summary}"
  s.description = <<-DESC
${summary}
  DESC
  s.homepage = "${homepage}"
  s.license = { :type => "${license}" }
  s.author = { "${author}" => "author@example.com" }
  s.source = { :path => "." }
  s.ios.deployment_target = "12.0"
  s.osx.deployment_target = "10.15"
  s.vendored_frameworks = "${name}.xcframework"
  s.source_files = "Loader/*.{h,mm,cc}"
  s.public_header_files = "include/*.h", "Loader/*.h"
  s.preserve_paths = "include/*.h"
  s.libraries = "c++"
  s.xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++17",
    "CLANG_CXX_LIBRARY" => "libc++"
  }
  s.dependency "LynxWeakNodeAPI/core"
end
`
  fs.writeFileSync(path.join(outDir, `${name}.podspec`), podspec)
}

function main() {
  const projectRoot = process.cwd()
  const pkg = readJson(path.join(projectRoot, 'package.json'))
  const name = 'needle'
  const version = pkg.version || '0.1.0'
  const summary = pkg.description || `${name} N-API addon`
  const homepage = pkg.homepage || 'https://example.com'
  const license = pkg.license || 'Apache-2.0'
  const author = pkg.author || name

  // cmake leaves Darwin static libraries in <build-dir>/out (see CMakeLists);
  // cpp/ holds the public headers for every slice.
  const candidates = [
    { buildDir: 'build/ios-device' },
    { buildDir: 'build/ios-sim' },
    { buildDir: 'build/macos' }
  ]
    .map(({ buildDir }) => ({
      library: path.join(projectRoot, buildDir, 'out', `lib${name}.a`),
      headers: path.join(projectRoot, 'cpp')
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

  copyIfExists(path.join(projectRoot, 'cpp/addon_use.h'), path.join(outDir, 'include/addon_use.h'))

  // The iOS pod cannot reference sources outside its root, so sync the shared
  // native loader into Loader/ (generated copies; canonical versions live in
  // cpp/ and are used directly by the Android CMake build).
  for (const f of ['LynxNodeAPI.h', 'LynxNodeAPI.cc']) {
    const from = path.join(projectRoot, 'cpp', f)
    if (!fs.existsSync(from)) fail(`Missing shared loader source: ${from}`)
    fs.copyFileSync(from, path.join(outDir, 'Loader', f))
  }

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
