import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'
import ram from 'random-access-memory'

/*
Run this in one terminal window:
`node sketches/contiguous-length.js`

Copy the key that is logged.

Run this in a second terminal window passing the key as the first argument:
`node sketches/contiguous-length.js <key>`

Run that second command within a few seconds and you'll see a live update of the data being logged.
*/

// get the key
const key = process.argv[2]

// create a hypercore. if a key was passed it'll be used to create a readable core, otherwise it'll be writable
const core = new Hypercore(ram, key)

// wait for the core to be ready
await core.ready()

let updating = false
setInterval(() => {
	for (const peer of core.peers) {
		if (peer.remoteLength < core.contiguousLength) {
			updating = true
			console.log('peer needs data', peer.remoteLength, core.contiguousLength, core.byteLength)
		} else if (peer.remoteLength > core.contiguousLength) {
			updating = true
			console.log('peer has data', peer.remoteLength, core.contiguousLength, core.byteLength)
		} else if (peer.remoteLength === core.contiguousLength) {
			if (updating) {
				console.log('peer done updating', peer.remoteLength, core.contiguousLength, core.byteLength)
				updating = false
			}
		}
	}
}, 1)

// initialize the hyperswarm module to use to find other services
const swarm = new Hyperswarm()

// listen for peer connections
swarm.on('connection', async (connection, info) => {
	console.log('connection!')
	core.replicate(connection)

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
		node sketches/contiguous-length.js ${core.key.toString('hex')}
	`)

	// appending data
	core.append([
		'a',
		'b',
		'c'
	])

	// appending data after 10 seconds to see it update live
	setTimeout(() => {
		core.append([
			'd',
			'e',
			'f'
		])
	}, 10000)

	// appending data after 20 seconds to see it update live
	setTimeout(() => {
		core.append([
			'g',
			'h',
			'i'
		])
	}, 20000)
}
