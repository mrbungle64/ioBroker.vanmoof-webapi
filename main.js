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
		if (!this.config.email || !this.config.password) {
			this.log.error('Please set email and password in the adapter settings');
			return;
		}
		await this.createChannelNotExists('account');
		await this.createChannelNotExists('bikes');
		const webAPI = new vanmoof.WebAPI();
		try {
			await webAPI.authenticate(this.config.email, this.config.password);
			const data = (await webAPI.getCustomerData()).data;

			this.log.info(`Processing data for account: '${data.name}'`);
			await this.createObjectNotExists('account.customerName', 'Customer name', 'string', 'text', false);
			await this.createObjectNotExists('account.email', 'Customer email', 'string', 'text', false);
			this.setStateConditional('account.customerName', data.name);
			this.setStateConditional('account.email', data.email);
			this.log.info(`Number of bikes: ${data.bikes.length}`);
			for (let i = 0; i < data.bikes.length; i++) {
				const bike = data.bikes[i];
				const channel = `bikes.${bike.frameNumber}`;
				this.log.info(`Processing data for Bike #${i + 1} (id: ${bike.id}):`);
				await this.createChannelNotExists(`${channel}`);
				await this.createObjectNotExists(`${channel}.name`, 'Name', 'string', 'text', false);
				this.setStateConditional(`${channel}.name`, bike.name);
				await this.createObjectNotExists(`${channel}.macAddress`, 'Mac address', 'string', 'value', false);
				this.setStateConditional(`${channel}.macAddress`, bike.macAddress);
				const tripDistance = bike.tripDistance;
				const distanceKilometers = (tripDistance / 10).toFixed(1);
				await this.createObjectNotExists(`${channel}.distanceKilometers`, 'Name', 'string', 'value', false, '', 'km');
				this.setStateConditional(`${channel}.distanceKilometers`, distanceKilometers);
				await this.createObjectNotExists(`${channel}.firmware`, 'Firmware', 'string', 'value', false);
				this.setStateConditional(`${channel}.firmware`, bike.smartmoduleCurrentVersion);
			}
		} catch (e) {
			this.log.error(e.toString());
		}
		this.stop();
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

	async createChannelNotExists(id, name) {
		await this.setObjectNotExistsAsync(id, {
			type: 'channel',
			common: {
				name: name
			},
			native: {}
		});
	}

	async createObjectNotExists(id, name, type, role, write, def, unit) {
		await this.setObjectNotExistsAsync(id, {
			type: 'state',
			common: {
				name: name,
				type: type,
				role: role,
				read: true,
				write: write,
				def: def,
				unit: unit
			},
			native: {}
		});
	}

	setStateConditional(stateId, value, ack = true) {
		this.getState(stateId, (err, state) => {
			if (!err && state) {
				if (state.val !== value) {
					this.setState(stateId, value, ack);
				}
			}
		});
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
