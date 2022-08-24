import Hypercore from 'hypercore'
import { MdnsDiscovery } from 'mdns-sd-discovery'
import net from 'net'
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

// initialize the mdns-sd-discovery module to use to find other services
const discovery = new MdnsDiscovery({ host: 'hypercore-experiment' })

// listen for new services
discovery.on('service', async (name, service) => {
	console.log('service', name, service)

	// create a tcp socket to connect to the service
	const socket = net.connect({
		host: service.host,
		port: service.port,
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
	// if we passed a key we'll just look for services
	discovery.lookup('hypercore-experiment')
} else {
	// otherwise this is the writable core, so we'll add data
	console.log('key:', core.key.toString('hex'))
	console.log(`run this in a second terminal window passing the key as the first argument:
		node sketches/local-network-replication.js ${core.key.toString('hex')}
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

	// create a tcp server
	const server = net.createServer((socket) => {
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
		discovery.announce('hypercore-experiment', { port: address.port })
	})
}
