import net from 'net'
import Hypercore from 'hypercore'
import { Discovery } from 'mdns-sd-discovery'
import ram from 'random-access-memory'

/*
Run this in one terminal window: 
`node sketches/local-network-replication.js`

Copy the key that is logged.

Run this in a second terminal window passing the key as the first argument:
`node sketches/local-network-replication.js <key>`

Run that second command within a few seconds and you'll see a live update of the data being logged.
*/

// get the key
const key = process.argv[2]

// create a hypercore. if a key was passed it'll be used to create a readable core, otherwise it'll be writable
const core = new Hypercore(ram, key)

// wait for the core to be ready
await core.ready()

// initialize the mdns-sd-discovery module to use to find other peers
const discovery = new Discovery()

// listen for new peers
discovery.on('peer', async (name, peer) => {
	console.log('peer', peer)

	// create a tcp socket to connect to the peer
	const socket = net.connect({
		host: peer.host,
		port: peer.port,
		allowHalfOpen: true
	})

	// listen for errors on the socket
	socket.on('error', (err) => {
		console.error('tcp error', err)
	})

	// listen for the socket to make a connection
	socket.on('connect', async () => {
		// create a replication stream from the core and pipe the socket stream into the replication stream and back again
		// the socket stream is a remote hypercore replication stream
		socket.pipe(core.replicate(true)).pipe(socket)
	
		// iterate through the data in a hypercore stream
		for await (const data of core.createReadStream({ live: true })) {
			console.log('data', data.toString())
		}
	})
})

if (key) {
	// if we passed a key we'll just look for peers
	discovery.lookup('test')
} else {
	// otherwise this is the writable core, so we'll add data
	console.log('key:', core.key.toString('hex'))

	// appending data
	core.append([
		'a',
		'b',
		'c'
	])

	// appending data after 6 seconds to see it update live
	setTimeout(() => {
		core.append([
			'd',
			'e',
			'f'
		])
	}, 6000)

	// create a tcp server
	const server = net.createServer((socket) => {
		console.log('server core length', core.length)

		// this is the other side of the replication that the tcp client streams to earlier in this file
		socket.pipe(core.replicate(false)).pipe(socket)
	})

	// listen for errors on the server
	server.on('error', (err) => {
		console.log('net server error', err)
	})

	// start the server
	server.listen(() => {
		const address = server.address()
		// announce this server via mdns
		discovery.announce('test', address.port)
	})
}
