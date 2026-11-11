import { readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
const files = readdirSync('test').filter(name => name.endsWith('.test.js')).map(name => `test/${name}`)
const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit', env: { ...process.env, RUN_MONGO_TESTS: '1' } })
child.on('error', () => { console.error('Không khởi động được kiểm thử.'); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
