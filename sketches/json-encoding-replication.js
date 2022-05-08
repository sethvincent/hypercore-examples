import Hypercore from 'hypercore'
import ram from 'random-access-memory'

// create a hypercore with values encoded as json
const core1 = new Hypercore(ram, {
	valueEncoding: 'json'
})

// wait for the hypercore to be ready so that its key can be used
await core1.ready()

// create the second hypercore with the first core's key
const core2 = new Hypercore(ram, core1.key, {
	valueEncoding: 'json'
})

// wait for the second hypercore to be ready
await core2.ready()

// add some data to the first core
await core1.append([
	{ a: 1 },
	{ b: 2 },
	{ c: 3 }
])

// create replication streams for both cores. the first argument indicates whether the core initiated replication
const replicate1 = core1.replicate(true, { keepAlive: false })
const replicate2 = core2.replicate(false, { keepAlive: false })

// pipe the replication streams into each other
replicate1.pipe(replicate2).pipe(replicate1)

// get a stream of data from the first core
const stream1 = core1.createReadStream({ live: false })

// append more data
await core1.append([
	{ d: 4 }
])

// log data from the first core's stream
stream1.on('data', (data) => {
	console.log('stream1', data)
})

// create a live stream of data from the second core
const stream2 = core2.createReadStream({ live: true })

// log data from the second core
stream2.on('data', (data) => {
	console.log('stream2', data)
})
