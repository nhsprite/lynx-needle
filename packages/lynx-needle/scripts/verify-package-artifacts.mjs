#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, '..')

const requiredFiles = [
  {
    path: 'third_party/needle/include/needle.h',
    hint: 'Run npm run fetch-engine.'
  },
  {
    path: 'third_party/needle/android-arm64/libneedle.a',
    hint: 'Run npm run fetch-engine.'
  },
  {
    path: 'third_party/needle/android-armv7/libneedle.a',
    hint: 'Run npm run fetch-engine.'
  },
  {
    path: 'third_party/needle/ios-arm64/libneedle.a',
    hint: 'Run npm run fetch-engine.'
  },
  {
    path: 'third_party/needle/ios-sim-arm64/libneedle.a',
    hint: 'Run npm run fetch-engine.'
  },
  {
    path: 'third_party/needle/macos-arm64/libneedle.a',
    hint: 'Run npm run fetch-engine.'
  },
  {
    path: 'ios/lynx-needle.xcframework/Info.plist',
    hint: 'Run npm run build:ios.'
  },
  {
    path: 'ios/lynx-needle.xcframework/ios-arm64/libNeedle.a',
    hint: 'Run npm run build:ios.'
  },
  {
    path: 'ios/lynx-needle.xcframework/ios-arm64-simulator/libNeedle.a',
    hint: 'Run npm run build:ios.'
  },
  {
    path: 'ios/lynx-needle.podspec',
    hint: 'Run npm run build:ios.'
  },
  {
    path: 'ios/addon_use.h',
    hint: 'Run npm run build:ios.'
  }
]

function statFile(relativePath) {
  try {
    const fullPath = path.join(projectRoot, relativePath)
    const stat = fs.statSync(fullPath)
    if (!stat.isFile() || stat.size === 0) {
      return null
    }
    return stat
  } catch {
    return null
  }
}

const missing = requiredFiles.filter(file => !statFile(file.path))

if (missing.length > 0) {
  console.error('Missing required lynx-needle package artifacts:')
  for (const file of missing) {
    console.error(`  - ${file.path}`)
  }

  const hints = [...new Set(missing.map(file => file.hint))]
  console.error('')
  for (const hint of hints) {
    console.error(hint)
  }
  console.error('Then retry npm pack or npm publish from packages/lynx-needle.')
  process.exit(1)
}

console.log(`Verified ${requiredFiles.length} package artifacts.`)
