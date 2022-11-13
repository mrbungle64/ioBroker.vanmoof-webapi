'use strict';

const utils = require('@iobroker/adapter-core');
const vanmoof = require('vanmoof-webapi.js');

class VanmoofWebapi extends utils.Adapter {
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'vanmoof-webapi',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		await this.setObjectNotExistsAsync('account', {
			type: 'channel',
			common: {
				name: 'Account'
			},
			native: {}
		});
		await this.setObjectNotExistsAsync('account.name', {
			type: 'state',
			common: {
				name: 'Name',
				type: 'string',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('account.email', {
			type: 'state',
			common: {
				name: 'Email',
				type: 'string',
				role: 'state',
				read: true,
				write: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('bikes', {
			type: 'channel',
			common: {
				name: 'Bikes'
			},
			native: {}
		});
		const webAPI = new vanmoof.WebAPI();
		try {
			await webAPI.authenticate(this.config.email, this.config.password);
			const data = (await webAPI.getCustomerData()).data;
			this.log.info(`Name: ${data.name}`);
			this.log.info(`Email: ${data.email}`);
			this.log.info(`Number of bikes: ${data.bikes.length}`);
			for (let i = 0; i < data.bikes.length; i++) {
				const bike = data.bikes[i];
				this.log.info(`Bike #${i + 1} (id: ${bike.id}):`);
				this.log.info(`name: ${bike.name}`);
				this.log.info(`frame number: ${bike.frameNumber}`);
				this.log.info(`mac address: ${bike.macAddress}`);
				const tripDistance = bike.tripDistance;
				const distanceKilometers = (tripDistance / 10).toFixed(1);
				this.log.info(`distance: ${distanceKilometers} km`);
				this.log.info(`firmware: ${bike.smartmoduleCurrentVersion}`);
				if (bike.smartmoduleDesiredVersion) {
					this.log.info(`new firmware available: ${bike.smartmoduleDesiredVersion}`);
				}
				this.log.info(`is tracking: ${bike.isTracking}`);
				const stolen = bike.stolen;
				this.log.info(`is stolen: ${stolen.isStolen}`);
				if (stolen.isStolen) {
					this.log.info(`date stolen: ${stolen.dateStolen}`);
					this.log.info(`latest location: ${stolen.latestLocation}`);
				}
				const modelColor = bike.modelColor;
				this.log.info(`color: ${modelColor.name}`);
				this.log.info(`color code (primary): ${modelColor.primary}`);
				this.log.info(`color code (secondary): ${modelColor.secondary}`);
			}
		} catch (e) {
			this.log.error(e.toString());
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.debug(`state ${id} deleted`);
		}
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new VanmoofWebapi(options);
} else {
	// otherwise start the instance directly
	new VanmoofWebapi();
}
