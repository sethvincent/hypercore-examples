import Autobase from "autobase"
import Keychain from 'keypear'
import Sqlite from 'better-sqlite3'
import Corestore from 'corestore'
import ram from 'random-access-memory'

const db = new Sqlite(':memory:')
const db2 = new Sqlite(':memory:')
const keychain = new Keychain()
const keychain2 = new Keychain()
const corestore = new Corestore(ram)
const autobase = new Autobase(corestore, keychain.sub('example'), {
    autostart: false
})

const autobase2 = new Autobase(corestore, keychain2.sub('example2'), {
    autostart: false
})

db.exec('CREATE TABLE IF NOT EXISTS posts (key TEXT PRIMARY KEY, title TEXT, content TEXT)')
db2.exec('CREATE TABLE IF NOT EXISTS posts (key TEXT PRIMARY KEY, title TEXT, content TEXT)')

await autobase.addInput(autobase.localInputKey)
await autobase.addInput(autobase2.localInputKey)
await autobase2.addInput(autobase2.localInputKey)
await autobase2.addInput(autobase.localInputKey)

function encode (data) {
    return JSON.stringify(data)
}

function decode (json) {
    return JSON.parse(json)
}

function upsert (db, data) {
    const statement = db.prepare('INSERT OR REPLACE INTO posts (key, title, content) VALUES (?, ?, ?)')
    statement.run(data.key, data.title, data.content)
}

const index = autobase.start({
    views: 1,
    open: (core) => {
        return [core]
    },
    apply: (core, batch) => {
        for (const { value } of batch) {
            const data = decode(value)
            upsert(db, data)
        }
        return core.append(batch)
    }
})

await autobase.append(encode({ key: '1', title: 'hello', content: 'world' }))
await autobase2.append(encode({ key: '2', title: 'hello2', content: 'world2' }))
await autobase.append(encode({ key: '3', title: 'hello3', content: 'world3' }))

const index2 = autobase2.start({
    views: 1,
    open: (core) => {
        return [core]
    },
    apply: (core, batch) => {
        for (const { value } of batch) {
            const data = decode(value)
            upsert(db2, data)
        }
        return core.append(batch)
    }
})

await autobase2.append(encode({ key: '4', title: 'hello4', content: 'world4' }))
await autobase.append(encode({ key: '1', title: 'hello-updated', content: 'world-updated' }))

await index.update()
await index2.update()
console.log('db1', db.prepare('SELECT * FROM posts').all())
console.log('db2', db2.prepare('SELECT * FROM posts').all())
