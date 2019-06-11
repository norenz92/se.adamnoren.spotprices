'use strict';

const Homey = require('homey');
var ua = require('universal-analytics');
var uniqid = require('uniqid');

// Nordpool constants
const nordpool = require('nordpool');
const prices = new nordpool.Prices();
var visitor = ua('UA-87214486-6', uniqid());

var d = new Date();

const cronInterval = "0 * * * *";
const cronName = 'EveryHour';

const logOptions = {
	'title': 'Price history',
	'type': 'number',
	'chart': 'line',
	'units': 'price/kWh',
	'decimals': 2
}

class SpotPrices extends Homey.App {
	
	async onInit() {
		
		this.log('SpotPrices app is running...');
		
		visitor.event("Events", "App initiated").send();
		
		//Register crontask
		Homey.ManagerCron.getTask(cronName)
			.then(task => {
				this.log("This crontask is already registred: " + cronName);
				task.on('run', () => this.getPrice());
			})
			.catch(err => {
				if (err.code == 404) {
					this.log("This crontask has not been registered yet, registering task: " + cronName);
					Homey.ManagerCron.registerTask(cronName, cronInterval, null)
					.then(task => {
						task.on('run', () => this.getPrice());
					})
					.catch(err => {
						this.log(`problem with registering crontask: ${err.message}`);
					});
				} else {
					this.log(`other cron error: ${err.message}`);
				}
			});
			
			this.initFlows();
			this.getPrice();
			console.log(visitor);
			
	}
	
	initFlows() {
		this._priceUpdatedTrigger = new Homey.FlowCardTrigger('price_changed').register();
		
		this.priceCondition = new Homey.FlowCardCondition('price_condition').register().registerRunListener((args, state) => {
			var currentPrice = state.price_per_kwh;
			var targetPrice = args.my_number;
			console.log('State object: ' + state);
			console.log('State: ' + currentPrice);
			console.log('Args: ' + targetPrice);
			let result = (currentPrice < targetPrice)
			return Promise.resolve(result);
		});
    }
    
    triggerFlow(newPrice){
		var tokens = {'price_per_kwh': newPrice};
		var state = {'price_per_kwh': newPrice};
		this._priceUpdatedTrigger.trigger(tokens, state).then(this.log("Price updated")).catch(this.error)
	}
		
    getPrice() {

		
		var currentPrice;

		var currentSettingArea = Homey.ManagerSettings.get('area');
		var currentSettingCurrency = Homey.ManagerSettings.get('currency');
		
		visitor.event("Get prices", currentSettingArea).send();
		visitor.event("Get prices", currentSettingCurrency).send();
		
		var opts = {
			area: currentSettingArea, // See http://www.nordpoolspot.com/maps/
			currency: currentSettingCurrency, // can also be 'DKK', 'NOK', 'SEK', 'EUR'
		}
		
		var timezone = '';
		if (opts.area == 'GB') {
			timezone = 'Europe/London';
		}
		if (opts.currency == 'FI') {
			timezone = 'Europe/Helsiniki';
		}
		else {
			timezone = 'Europe/Stockholm';
		}
		
		var me = this;

		prices.hourly(opts, function (error, results) {
			if (error) console.error(error)
			for (var i=0; i<results.length; i++) {
				var date = results[i].date;
				var dataDate = new Date(date);
				var dataMonth = dataDate.getMonth();
				var dataDay = dataDate.getDay();
				var dataHour = dataDate.getHours();
				var price = results[i].value;
				var time = date.tz(timezone).format("D.M. H:mm");
				
				if (dataMonth == d.getMonth() && dataDay == d.getDay() && dataHour == d.getHours()) {
					currentPrice = parseFloat((price/1000).toFixed(2));
					console.log(currentPrice);
					me.triggerFlow(currentPrice);
					visitor.event("Price", currentPrice).send();
				}
			}
		})
	}
}

module.exports = SpotPrices;
