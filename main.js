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
			await this.createObjectNotExists('account.customerName',
				'Name of the customer', 'string', 'text', false);
			await this.createObjectNotExists('account.numberOfBikes',
				'Number of bikes registered', 'number', 'value', false);
			await this.setStateAsync('account.customerName', data.name, true);
			await this.setStateAsync('account.numberOfBikes', data.bikes.length, true);
			this.log.info(`Number of bikes: ${data.bikes.length}`);
			for (let i = 0; i < data.bikes.length; i++) {
				const bike = data.bikes[i];
				const channel = `bikes.${bike.frameNumber}`;
				this.log.info(`Processing data for Bike #${i + 1} (id: ${bike.id}):`);
				await this.createObjectsNotExistsForBike(channel, bike);
				await this.setStatesForBike(channel, bike);
			}
		} catch (e) {
			this.log.error(e.toString());
		}
		this.stop();
	}

	async createObjectsNotExistsForBike(channel, bike) {
		await this.createChannelNotExists(`${channel}`);
		await this.createChannelNotExists(`${channel}.firmware`);
		await this.createChannelNotExists(`${channel}.stolen`);
		await this.createChannelNotExists(`${channel}.details`);
		await this.createChannelNotExists(`${channel}.details.color`);

		await this.createObjectNotExists(`${channel}.name`,
			'Name of the bike', 'string', 'text', false, '');
		await this.createObjectNotExists(`${channel}.macAddress`,
			'MAC address', 'string', 'value', false, bike.macAddress);
		await this.createObjectNotExists(`${channel}.distanceKilometersTotal`,
			'Distance kilometers total', 'mixed', 'value', false, 0, 'km');
		await this.createObjectNotExists(`${channel}.firmware.current`,
			'Current firmware version', 'mixed', 'value', false, bike.smartmoduleCurrentVersion);
		await this.createObjectNotExists(`${channel}.firmware.available`,
			'New firmware version (if update available)', 'mixed', 'value', false, bike.smartmoduleDesiredVersion);

		await this.createObjectNotExists(`${channel}.stolen.isStolen`,
			'Is the bike stolen?', 'boolean', 'value', false, bike.stolen.isStolen);
		await this.createObjectNotExists(`${channel}.stolen.isTracking`,
			'Is the bike currently tracked?', 'boolean', 'value', false, bike.isTracking);
		await this.createObjectNotExists(`${channel}.stolen.latestLocation`,
			'Latest location (when the bike was stolen)', 'mixed', 'location', false, bike.stolen.latestLocation);

		await this.createObjectNotExists(`${channel}.details.modelDesignation`,
			'Model designation', 'string', 'value', false, bike.modelName);
		await this.createObjectNotExists(`${channel}.details.bleProfile`,
			'BLE profile', 'string', 'value', false, bike.bleProfile);
		await this.createObjectNotExists(`${channel}.details.controller`,
			'Controller', 'string', 'value', false, bike.controller);
		await this.createObjectNotExists(`${channel}.details.color.name`,
			'Model color', 'string', 'value', false, bike.modelColor.name);
		await this.createObjectNotExists(`${channel}.details.color.primary`,
			'Color code (primary)', 'string', 'value', false, bike.modelColor.primary);
		await this.createObjectNotExists(`${channel}.details.color.secondary`,
			'Color code (secondary)', 'string', 'value', false, bike.modelColor.secondary);
	}

	async setStatesForBike(channel, bike) {
		await this.setStateAsync(`${channel}.name`, bike.name, true);
		const tripDistance = bike.tripDistance;
		const distanceKilometers = (tripDistance / 10).toFixed(1);
		await this.setStateAsync(`${channel}.distanceKilometersTotal`, distanceKilometers, true);
		await this.setStateAsync(`${channel}.firmware.current`, bike.smartmoduleCurrentVersion, true);
		await this.setStateAsync(`${channel}.firmware.available`, bike.smartmoduleDesiredVersion, true);
		await this.setStateAsync(`${channel}.stolen.isStolen`, bike.stolen.isStolen, true);
		await this.setStateAsync(`${channel}.stolen.isTracking`, bike.isTracking, true);
		await this.setStateAsync(`${channel}.stolen.latestLocation`, bike.stolen.latestLocation, true);

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
