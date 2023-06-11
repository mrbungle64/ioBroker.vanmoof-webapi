'use strict';

const utils = require('@iobroker/adapter-core');
const vanmoof = require('vanmoof-webapi.js');
const helper = require('./lib/helper');

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
		await this.createChannelNotExists('account', 'Account data');
		await this.createChannelNotExists('bikes', 'Bike data');
		const webAPI = new vanmoof.WebAPI();
		try {
			await webAPI.authenticate(this.config.email, this.config.password);
			const data = (await webAPI.getCustomerData(true)).data;

			this.log.info(`Processing data for account: '${data.name}'`);
			await this.createObjectNotExists('account.customerName',
				'Name of the customer', 'string', 'text', false);
			await this.createObjectNotExists('account.numberOfBikes',
				'Number of bikes registered', 'number', 'value', false);
			await this.setStateAsync('account.customerName', data.name, true);
			await this.setStateAsync('account.numberOfBikes', data.bikes.length, true);
			this.log.info(`Number of bikes: ${data.bikeDetails.length}`);
			for (let i = 0; i < data.bikeDetails.length; i++) {
				const bike = data.bikeDetails[i];
				const channel = `bikes.${bike.frameNumber}`;
				this.log.info(`Processing data for Bike #${i + 1} (id: ${bike.id}):`);
				await this.createObjectsNotExistsForBike(channel, bike);
				await this.setStatesForBike(channel, bike);
				await this.updateChannelNames(channel);
			}
		} catch (e) {
			this.log.error(e.toString());
		}
		this.stop();
	}

	async createObjectsNotExistsForBike(channel, bike) {
		await this.createChannelNotExists(`${channel}`, `Data for Bike with frameNumber ${bike.frameNumber}`);
		await this.createChannelNotExists(`${channel}.firmware`, 'Firmware information');
		await this.createChannelNotExists(`${channel}.tripData`, 'Trip data');
		for (let d = 0; d <= 7; d++) {
			let name = (d > 0) ? `Day ${d}` : 'Today';
			await this.createChannelNotExists(`${channel}.tripData.${d}`, name);
			name = (d > 0) ? 'Distance covered on this day' : 'Distance kilometers (so far)';
			await this.createObjectNotExists(`${channel}.tripData.${d}.distance`,
				name, 'mixed', 'value', false, 0, 'km');
			await this.createObjectNotExists(`${channel}.tripData.${d}.date`,
				'Date', 'mixed', 'value.date', false, helper.getPreviousDay(d).toLocaleDateString('de'));
			name = (d > 0) ? 'Mileage (at the end of the day)' : 'Mileage';
			await this.createObjectNotExists(`${channel}.tripData.${d}.mileage`,
				name, 'mixed', 'value', false, 0, 'km');
		}
		await this.createChannelNotExists(`${channel}.stolen`, 'Information if the bike is stolen');
		await this.createChannelNotExists(`${channel}.details`, 'Model detail information');
		await this.createChannelNotExists(`${channel}.details.color`, 'Model color information');
		await this.createChannelNotExists(`${channel}.details.key`, 'Encryption key and passcode');

		await this.createObjectNotExists(`${channel}.name`,
			'Name of the bike', 'string', 'text', false, '');
		await this.createObjectNotExists(`${channel}.macAddress`,
			'MAC address', 'string', 'value', false, bike.macAddress);
		await this.createObjectNotExists(`${channel}.mileageTotal`,
			'Mileage total (distance kilometers total)', 'mixed', 'value', false, 0, 'km');
		await this.createObjectNotExists(`${channel}.firmware.current`,
			'Current firmware version', 'mixed', 'value', false, bike.smartmoduleCurrentVersion);
		await this.createObjectNotExists(`${channel}.firmware.available`,
			'New firmware version (if available)', 'mixed', 'value', false, bike.smartmoduleDesiredVersion);

		await this.createObjectNotExists(`${channel}.stolen.isStolen`,
			'Is the bike stolen?', 'boolean', 'value', false, bike.stolen.isStolen);
		await this.createObjectNotExists(`${channel}.stolen.isTracking`,
			'Is the bike currently tracked?', 'boolean', 'value', false, bike.isTracking);
		await this.createObjectNotExists(`${channel}.stolen.latestLocation`,
			'Latest location (when the bike was stolen)', 'mixed', 'location', false, bike.stolen.latestLocation);

		await this.createObjectNotExists(`${channel}.details.modelDesignation`,
			'Model designation', 'string', 'text', false, bike.modelName);
		await this.createObjectNotExists(`${channel}.details.bleProfile`,
			'BLE profile', 'string', 'text', false, bike.bleProfile);
		await this.createObjectNotExists(`${channel}.details.controller`,
			'Controller', 'string', 'text', false, bike.controller);
		await this.createObjectNotExists(`${channel}.details.customerRole`,
			'Customer role', 'string', 'text', false, bike.customerRole);
		await this.createObjectNotExists(`${channel}.details.gears`,
			'Gears', 'string', 'text', false, bike.modelDetails['Gears']);
		await this.createObjectNotExists(`${channel}.details.motor`,
			'Motor', 'string', 'text', false, bike.modelDetails['Motor']);
		await this.createObjectNotExists(`${channel}.details.topSpeed`,
			'Top Speed', 'string', 'text', false, bike.modelDetails['Top Speed']);
		await this.createObjectNotExists(`${channel}.details.range`,
			'Range', 'string', 'text', false, bike.modelDetails['Range']);
		await this.createObjectNotExists(`${channel}.details.edition`,
			'Edition', 'string', 'text', false, bike.modelDetails['Edition']);
		await this.createObjectNotExists(`${channel}.details.color.name`,
			'Model color', 'string', 'text', false, bike.modelColor.name);
		await this.createObjectNotExists(`${channel}.details.color.primary`,
			'Color code (primary)', 'string', 'text', false, bike.modelColor.primary);
		await this.createObjectNotExists(`${channel}.details.color.secondary`,
			'Color code (secondary)', 'string', 'text', false, bike.modelColor.secondary);
		await this.createObjectNotExists(`${channel}.details.key.encryptionKey`,
			'Encryption key', 'string', 'value', false, bike.key.encryptionKey);
		await this.createObjectNotExists(`${channel}.details.key.passcode`,
			'Passcode', 'string', 'value', false, bike.key.passcode);
		await this.createObjectNotExists(`${channel}.details.key.userKeyId`,
			'User key id', 'number', 'value', false, bike.key.userKeyId);
		await this.createObjectNotExists(`${channel}.details.thumbnail`,
			'Thumbnail (link)', 'string', 'value', false, bike.links.thumbnail);

		await this.createChannelNotExists(`${channel}.maintenance`, 'Maintenance related data');
		await this.createChannelNotExists(`${channel}.maintenance.lastInspection`, 'Last inspection');
		await this.createObjectNotExists(`${channel}.maintenance.lastInspection.kilometer`,
			'Last inspection (kilometer)', 'number', 'value', true, 0);
		await this.createObjectNotExists(`${channel}.maintenance.lastInspection.kilometerDrivenSince`,
			'Kilometer driven since last inspection', 'number', 'value', false, 0, 'km');
		await this.createChannelNotExists(`${channel}.maintenance.lastCheckBrakes`, 'Last check of the brakes');
		await this.createObjectNotExists(`${channel}.maintenance.lastCheckBrakes.kilometerFrontWheel`,
			'Last check of the front wheel brakes (kilometer)', 'number', 'value', true, 0);
		await this.createObjectNotExists(`${channel}.maintenance.lastCheckBrakes.kilometerFrontWheelDrivenSince`,
			'Kilometer driven since last check of the front wheel brakes', 'number', 'value', false, 0, 'km');
		await this.createObjectNotExists(`${channel}.maintenance.lastCheckBrakes.kilometerRearWheel`,
			'Last check of the rear wheel brakes (kilometer)', 'number', 'value', true, 0, 'km');
		await this.createObjectNotExists(`${channel}.maintenance.lastCheckBrakes.kilometerRearWheelDrivenSince`,
			'Kilometer driven since last check of the rear wheel brakes', 'number', 'value', false, 0, 'km');
	}

	async setStatesForBike(channel, bike) {
		await this.setStateAsync(`${channel}.name`, bike.name, true);
		const tripDistance = bike.tripDistance;
		const distanceKilometers = (tripDistance / 10).toFixed(1);
		await this.setStateAsync(`${channel}.mileageTotal`, distanceKilometers, true);
		await this.updateTripData(channel, distanceKilometers);
		await this.updateMaintenanceData(channel, distanceKilometers);
		await this.setStateAsync(`${channel}.firmware.current`, bike.smartmoduleCurrentVersion, true);
		await this.setStateAsync(`${channel}.firmware.available`, bike.smartmoduleDesiredVersion, true);
		await this.setStateAsync(`${channel}.stolen.isStolen`, bike.stolen.isStolen, true);
		await this.setStateAsync(`${channel}.stolen.isTracking`, bike.isTracking, true);
		await this.setStateAsync(`${channel}.stolen.latestLocation`, bike.stolen.latestLocation, true);
	}

	async updateTripData(channel, distanceKilometers) {
		await this.setStateAsync(`${channel}.tripData.0.mileage`, distanceKilometers, true);
		const dateState = await this.getStateAsync(`${channel}.tripData.0.date`);
		if ((new Date().toLocaleDateString('de')) !== dateState.val.toString()) {
			await this.handleChangeOfDay(channel);
		}
		const mileageState = await this.getStateAsync(`${channel}.tripData.1.mileage`);
		if (mileageState && mileageState.val) {
			const distance = Number((Number(distanceKilometers) - Number(mileageState.val)).toFixed(1));
			await this.setStateAsync(`${channel}.tripData.0.distance`, distance, true);
		}
	}

	async updateMaintenanceData(channel, distanceKilometers) {
		const lastInspectionState = await this.getStateAsync(`${channel}.maintenance.lastInspection.kilometer`);
		const lastCheckedFrontWheelState = await this.getStateAsync(`${channel}.maintenance.lastCheckBrakes.kilometerFrontWheel`);
		const lastCheckedRearWheelState = await this.getStateAsync(`${channel}.maintenance.lastCheckBrakes.kilometerRearWheel`);
		if (lastInspectionState && lastInspectionState.val) {
			const drivenSince = Number(distanceKilometers) - Number(lastInspectionState.val);
			await this.setStateAsync(`${channel}.maintenance.lastInspection.kilometerDrivenSince`, drivenSince, true);
		}
		if (lastCheckedFrontWheelState && lastCheckedFrontWheelState.val) {
			const frontWheelDrivenSince = Number(distanceKilometers) - Number(lastCheckedFrontWheelState.val);
			await this.setStateAsync(`${channel}.maintenance.lastCheckBrakes.kilometerFrontWheelDrivenSince`, frontWheelDrivenSince, true);
		}
		if (lastCheckedRearWheelState && lastCheckedRearWheelState.val) {
			const rearWheelDrivenSince = Number(distanceKilometers) - Number(lastCheckedRearWheelState.val);
			await this.setStateAsync(`${channel}.maintenance.lastCheckBrakes.kilometerRearWheelDrivenSince`, rearWheelDrivenSince, true);
		}
	}

	async handleChangeOfDay(channel) {
		for (let d = 7; d >= 1; d--) {
			const dayNumber = d - 1;
			const mileageState = await this.getStateAsync(`${channel}.tripData.${dayNumber}.mileage`);
			if (mileageState && mileageState.val) {
				await this.setStateAsync(`${channel}.tripData.${d}.mileage`, mileageState.val, true);
			}
			const distanceState = await this.getStateAsync(`${channel}.tripData.${dayNumber}.distance`);
			if (distanceState && distanceState.val) {
				await this.setStateAsync(`${channel}.tripData.${d}.distance`, distanceState.val, true);
			}
			const dateState = await this.getStateAsync(`${channel}.tripData.${dayNumber}.date`);
			if (dateState && dateState.val) {
				await this.setStateAsync(`${channel}.tripData.${d}.date`, dateState.val, true);
			}
		}
		await this.setStateAsync(`${channel}.tripData.0.date`, new Date().toLocaleDateString('de'), true);
		await this.setStateAsync(`${channel}.tripData.0.distance`, 0.0, true);
	}

	async updateChannelNames(channel) {
		for (let d = 1; d <= 7; d++) {
			const folderDate = new Date();
			folderDate.setDate(folderDate.getDate() - d);
			const name = folderDate.toLocaleDateString('de');
			const folderObj = await this.getObjectAsync(`${channel}.tripData.${d}`);
			if (folderObj && folderObj.common && (folderObj.common.name !== name)) {
				folderObj.common.name = name;
				await this.extendObjectAsync(`${channel}.tripData.${d}`, folderObj);
			}
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
