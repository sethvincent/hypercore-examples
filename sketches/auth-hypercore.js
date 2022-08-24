import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'
import ram from 'random-access-memory'
import crypto from 'hypercore-crypto'

/*
Run this in one terminal window:
`node sketches/auth-hypercore.js`

Copy the command that is logged.

Run this in a second terminal window passing the key as the first argument:
`node sketches/auth-hypercore.js <key> <publicKey>`

Run that second command within a few seconds and you'll see a live update of the data being logged.
*/

// get the key
const key = process.argv[2]
const publicKey = process.argv[3] ? Buffer.from(process.argv[3], 'hex') : undefined

let keyPair
if (!key) {
	keyPair = crypto.keyPair()
}

// create a hypercore. if a key was passed it'll be used to create a readable core, otherwise it'll be writable
const core = new Hypercore(ram, key, {
	auth: {
		sign (signable) {
			return crypto.sign(signable, keyPair.secretKey)
		},
		verify (signable, signature) {
			// switch the commented lines to see what happens when verify fails
			// return false
			return crypto.verify(signable, signature, publicKey)
		}
	}
})

// wait for the core to be ready
await core.ready()

// initialize the hyperswarm module to use to find other services
const swarm = new Hyperswarm()

// listen for peer connections
swarm.on('connection', async (connection, info) => {
	console.log('connection!')
	const stream = core.replicate(connection)

	stream.on('error', (error) => {
		console.log('stream error', error)
		console.log('core.length', core.length)
		swarm.leave(core.discoveryKey)
		swarm.destroy()
	})

	// iterate through the data in a hypercore stream
	for await (const data of core.createReadStream({ live: true })) {
		console.log('data', data.toString())
	}
})

if (key) {
	// join the swarm as a client
	swarm.join(core.discoveryKey, { server: false, client: true })
} else {
	// join the swarm as a server
	swarm.join(core.discoveryKey, { server: true, client: false })

	console.log('key:', core.key.toString('hex'))
	console.log(`run this in a second terminal window passing the key as the first argument:
		node sketches/auth-hypercore.js ${core.key.toString('hex')} ${keyPair.publicKey.toString('hex')}
	`)

	// appending data
	await core.append([
		'a',
		'b',
		'c'
	])

	// appending data after 10 seconds to see it update live
	setTimeout(async () => {
		await core.append([
			'd',
			'e',
			'f'
		])
	}, 10000)
}
