import Diffy from 'diffy'
import Hypercore from 'hypercore'
import Hyperswarm from 'hyperswarm'
import trim from 'outdent'
import ram from 'random-access-memory'

const output = Diffy()

/*
Run this in one terminal window:
`node sketches/compare-bitfields.js`

Copy the key that is logged.

Run this in a second terminal window passing the key as the first argument:
`node sketches/compare-bitfields.js <key>`

Run that second command within a few seconds and you'll see a live update of the data being logged.
*/

// get the key
const key = process.argv[2]

// state for cli rendering
let state = {
	appendedBlocks: 0,
	totalBlocks: 50000,
	status: 'updating',
	key,
	shareKey: null
}

update(state)

// create a hypercore. if a key was passed it'll be used to create a readable core, otherwise it'll be writable
const core = new Hypercore(ram, key)

// wait for the core to be ready
await core.ready()

update({ shareKey: core.key })

if (!key) {
	let i = 1
	for (i; i <= state.totalBlocks; i++) {
		await core.append(`${i}${i}${i}`)
		update({ appendedBlocks: i })
	}
}

setInterval(async () => {
	const localBitfield = core.core.bitfield.pages.tiny.b.map((arr) => {
		return arr.bitfield
	}).filter((arr) => {
		return !!arr
	})

	for (const peer of core.peers) {
		const remoteBitfield = peer.remoteBitfield.pages.tiny.b.filter((arr) => {
			return !!arr
		})

		const downloaded = isDownloaded(remoteBitfield, localBitfield)

		if (downloaded) {
			update({ status: 'downloaded' })
		} else {
			// TODO: ideally we'd get a diff of the two bitfields
			// TODO: visualize the difference between the two bitfields
			for (const index in localBitfield) {
				const local = localBitfield[index]
				const remote = remoteBitfield[index]

				if (!local || !remote) {
					update({ status: 'updating' })
				} else {
					const updated = isUpdated(remoteBitfield, localBitfield)
					if (updated) {
						update({ status: 'syncing' })
					}
				}
			}
		}
	}
}, 1)

// if lengths match in each array that means the local core is updated with the remote core tree
function isUpdated (remoteBitfield, localBitfield) {
	const percents = []

	for (const index in remoteBitfield) {
		const remote = remoteBitfield[index]
		const local = localBitfield[index]
		percents[index] = (local || []).length / (remote || []).length
	}

	return percents.every((percent) => {
		return percent === 1
	})
}

// if this returns true it means all data has been downloaded from the remote core
function isDownloaded (intArrays1, intArrays2) {
	if (intArrays1.length !== intArrays2.length) {
		return false
	}

	const checks = new Array(intArrays1.length).fill(false)

	for (const index in intArrays1) {
		const intArray1 = intArrays1[index]
		const intArray2 = intArrays2[index]
		if (intArray1.length !== intArray2.length) {
			checks[index] = false
			continue
		}

		checks[index] = intArray1.every((value, valueIndex) => {
			return value === intArray2[valueIndex]
		})
	}

	return checks.every((check) => {
		return check === true
	})
}

// initialize the hyperswarm module to use to find other services
const swarm = new Hyperswarm()

// listen for peer connections
swarm.on('connection', async (connection, info) => {
	core.replicate(connection)
	core.download()
})

if (key) {
	// join the swarm as a client
	swarm.join(core.discoveryKey, { server: false, client: true })
} else {
	// join the swarm as a server
	swarm.join(core.discoveryKey, { server: true, client: false })
}

// cli rendering
function update (props) {
	state = { ...state, ...props }
	render(state)
}

function render (state) {
	output.render(() => {
		return trim`
			${renderCount(state)}
			${renderStatus(state)}
			${renderInstructions(state)}
		`
	})
}

function renderCount (state) {
	if (state.key) {
		return ''
	}

	return `${state.appendedBlocks}/${state.totalBlocks}`
}

function renderStatus (state) {
	return `status: ${state.status}`
}

function renderInstructions (state) {
	if (state.key) {
		return ''
	}

	if (!state.key && !state.shareKey) {
		return ''
	}

	if (state.appendedBlocks !== state.totalBlocks) {
		return ''
	}

	return trim`
		run this in a second terminal window passing the key as the first argument:

		node sketches/compare-bitfields.js ${core?.key?.toString('hex') || ''}
	`
}
