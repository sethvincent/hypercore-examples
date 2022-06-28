import Hypercore from 'hypercore'
import ram from 'random-access-memory'

// create a hypercore with values encoded as json
const core1 = new Hypercore(ram, {
	valueEncoding: 'json'
})

// wait for the hypercore to be ready so that its key can be used
await core1.ready()

// register an extension
core1.registerExtension('example', {
	encoding: 'utf-8',
	onmessage: (message) => {
		console.log('message', message)
	}
})

// register an extension with json encoding
const core1JsonExt = core1.registerExtension('json-example', {
	encoding: 'json',
	onmessage: (message) => {
		console.log('json message', message)
	}
})

// create the second hypercore with the first core's key
const core2 = new Hypercore(ram, core1.key, {
	valueEncoding: 'json'
})

// wait for the second hypercore to be ready
await core2.ready()

const ext = core2.registerExtension('example', {
	encoding: 'utf-8'
})

const jsonExt = core2.registerExtension('json-example', {
	encoding: 'json',
	onmessage: (message) => {
		console.log('message from core1', message)
	}
})

// create replication streams for both cores. the first argument indicates whether the core initiated replication
const replicate1 = core1.replicate(true, { keepAlive: false })
const replicate2 = core2.replicate(false, { keepAlive: false })

// pipe the replication streams into each other
replicate1.pipe(replicate2).pipe(replicate1)

await new Promise((resolve) => setImmediate(resolve))

// send a message
ext.send('hi', core2.peers[0])

// send a json message
jsonExt.send({ message: 'hi' }, core2.peers[0])

// send a json message from first core
core1JsonExt.send({ message: 'hello' }, core1.peers[0])
