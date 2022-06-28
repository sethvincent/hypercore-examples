import net from 'net'

import Corestore from 'corestore'
import Hyperswarm from 'hyperswarm'
import ram from 'random-access-memory'

/*
Run this in one terminal window:
`node sketches/replicate-corestore-hyperswarm.js`

Copy the key that is logged.

Run this in a second terminal window passing the key as the first argument:
`node sketches/replicate-corestore-hyperswarm.js <key1> <key2>`
*/

// get the key
const key = process.argv[2]
const key2 = process.argv[3]

const store = new Corestore(ram)
await store.ready()

let core1
let core2
if (!key) {
	core1 = store.get({ name: 'example' })
	await core1.ready()
	console.log(`core1: ${core1.key.toString('hex')}`)
	core2 = store.get({ name: 'example2' })
	await core2.ready()
} else {
	core1 = store.get({ key: Buffer.from(key, 'hex') })
	await core1.ready()
	console.log(`core1: ${core1.key.toString('hex')}`)
	core2 = store.get({ key: Buffer.from(key2, 'hex') })
	await core2.ready()
}

const swarm = new Hyperswarm()

swarm.on('connection', (connection, info) => {
	console.log('connection')
	store.replicate(connection)

	core1.download()
	core2.download()

	core1.on('download', async (index) => {
		const data = await core1.get(index)
		console.log('core1 data', data.toString())
	})

	core2.on('download', async (index) => {
		const data = await core2.get(index)
		console.log('core2 data', data.toString())
	})
})

if (key) {
	// if we passed a key we'll just look for services
	swarm.join(core1.discoveryKey)
} else {
	// otherwise this is the writable core, so we'll add data
	console.log('key:', core1.key.toString('hex'))
	console.log(`run this in a second terminal window passing the key as the first argument:
		node sketches/replicate-corestore-hyperswarm.js ${core1.key.toString('hex')} ${core2.key.toString('hex')}
	`)

	// appending data
	core1.append([
		'a',
		'b',
		'c'
	])

	core2.append([
		'1',
		'2',
		'3'
	])

	// appending data after 10 seconds to see it update live
	setTimeout(() => {
		core1.append([
			'd',
			'e',
			'f'
		])

		core2.append([
			'4',
			'5',
			'6'
		])
	}, 10000)

	swarm.join(core1.discoveryKey)
}
