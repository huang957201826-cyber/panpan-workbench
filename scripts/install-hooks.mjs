#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' })
console.log('已设置 core.hooksPath = .githooks；push 前会跑 npm run gate:dev')
