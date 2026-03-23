/**
 * Helper script to write content to a file from a child process.
 * This is necessary because Turbopack's file watcher (in the same Node process)
 * may not detect fs.writeFileSync from within API route handlers.
 * Writing from a separate process generates an OS-level file event that Turbopack detects.
 *
 * Usage: node write-file.js <base64-encoded-content> <target-file-path>
 */
const fs = require('fs')

const [,, encodedContent, targetPath] = process.argv

if (!encodedContent || !targetPath) {
    console.error('Usage: node write-file.js <base64-content> <file-path>')
    process.exit(1)
}

const content = Buffer.from(encodedContent, 'base64').toString('utf-8')
fs.writeFileSync(targetPath, content, 'utf-8')

// Also update modification time explicitly
const now = new Date()
fs.utimesSync(targetPath, now, now)

console.log(`Written ${content.length} bytes to ${targetPath}`)
