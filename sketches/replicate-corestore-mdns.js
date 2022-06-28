import net from 'net'

import Corestore from 'corestore'
import { MdnsDiscovery } from 'mdns-sd-discovery'
import ram from 'random-access-memory'

/*
Run this in one terminal window:
`node sketches/replicate-corestore-mdns.js`

Copy the key that is logged.

Run this in a second terminal window passing the key as the first argument:
`node sketches/replicate-corestore-mdns.js <key1> <key2>`
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

// initialize the mdns-sd-discovery module to use to find other services
const discovery = new MdnsDiscovery({ host: 'hypercore-experiment' })

// listen for new services
discovery.on('service', async (service) => {
	// create a tcp socket to connect to the service
	const socket = net.connect({
		host: service.addresses[0],
		port: service.port,
		allowHalfOpen: true
	})

	// listen for errors on the socket
	socket.on('error', (err) => {
		console.error('tcp error', err)
	})

	// listen for the socket to make a connection
	socket.on('connect', async () => {
		console.log('connect?')
		// create a replication stream from the core and pipe the socket stream into the replication stream and back again
		// the socket stream is a remote hypercore replication stream
		
		socket.pipe(store.replicate(true)).pipe(socket)
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
})

if (key) {
	// if we passed a key we'll just look for services
	discovery.lookup('hypercore-experiment')
} else {
	// otherwise this is the writable core, so we'll add data
	console.log('key:', core1.key.toString('hex'))
	console.log(`run this in a second terminal window passing the key as the first argument:
		node sketches/replicate-corestore-mdns.js ${core1.key.toString('hex')} ${core2.key.toString('hex')}
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

	// create a tcp server
	const server = net.createServer((socket) => {
		console.log('connection')
		// this is the other side of the replication that the tcp client streams to earlier in this file
		socket.pipe(store.replicate(false)).pipe(socket)
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
