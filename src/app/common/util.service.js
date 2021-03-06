'use strict';

const _ = require('lodash'),
	http = require('http'),
	https = require('https'),
	mongoose = require('mongoose'),
	platform = require('platform'),
	q = require('q'),

	deps = require('../../dependencies'),
	config = deps.config,
	errorHandler = deps.errorHandler,
	logger = deps.logger;

function getValidationErrors(err) {
	let errors = [];

	if(null != err.errors) {
		for (let field in err.errors) {
			if(err.errors[field].path) {
				const message = (err.errors[field].type === 'required')? field + ' is required' : err.errors[field].message;
				errors.push({ field: field, message: message });
			}
		}
	}

	return errors;
}

module.exports.getErrorMessage = function(err) {
	if(typeof err === 'string') {
		return err;
	}

	let msg = 'unknown error';
	if(null != err.message) {
		msg = err.message;
	}

	if(null != err.stack) {
		msg = '[' + msg + '] ' + err.stack;
	}

	return msg;
};

module.exports.getClientErrorMessage = function(err) {
	if(config.exposeServerErrors) {
		return module.exports.getErrorMessage(err);
	} else {
		return 'A server error has occurred.';
	}
};

module.exports.handleErrorResponse = function(res, errorResult) {
	// Return the error state to the client, defaulting to 500
	errorResult = errorResult || {};

	if(errorResult.name === 'ValidationError') {
		const errors = getValidationErrors(errorResult);
		errorResult = {
			status: 400,
			type: 'validation',
			message: errors.map(function(e) { return e.message; }).join(', '),
			errors: errors
		};
	}

	// If the status is missing or invalid, default to 500
	if(!(errorResult.status >= 400 && errorResult.status <= 600)) {
		errorResult.status = 500;
	}

	// If it's a server error, get the client message
	if(errorResult.status >= 500 && errorResult.status < 600) {
		// Log the error because it's a server error
		logger.error(errorResult);

		// Create the response for the client
		errorResult = {
			status: errorResult.status,
			type: 'server-error',
			message: module.exports.getClientErrorMessage(errorResult)
		};
	}

	// Send the response
	res.status(errorResult.status).json(errorResult);
};

module.exports.catchError = function(res, err, callback) {
	if (err) {
		logger.error(err);
		return this.send400Error(res, err);
	} else if (null != callback) {
		callback();
	}
};

module.exports.send400Error = function (res, err) {
	return res.status(400).json({
		message: errorHandler.getErrorMessage(err)
	});
};

module.exports.send403Error = function (res) {
	return res.status(403).json({
		message: 'User is not authorized'
	});
};

module.exports.validateNumber = function (property) {
	return (null != property && _.isNumber(property));
};

module.exports.validatePositiveNumber = function (property) {
	if (null != property && property !== 0) {
		return (_.isNumber(property) && property > 0);
	}
	return true;
};

module.exports.validateNonEmpty = function (property) {
	return (null != property && property.length > 0);
};

module.exports.validateArray = function (property) {
	return (null != property && _.isArray(property) && property.length > 0);
};

module.exports.toLowerCase = function (v){
	return (null != v)? v.toLowerCase(): undefined;
};

/**
 * Parse an input as a date. Handles various types
 * of inputs, such as Strings, Date objects, and Numbers.
 *
 * @param {date} The input representing a date / timestamp
 * @returns The timestamp in milliseconds since the Unix epoch
 */
module.exports.dateParse = function (date) {

	// Handle nil values, arrays, and functions by simply returning null
	if (_.isNil(date) || _.isArray(date) || _.isFunction(date)) {
		return null;
	}

	// Date object should return its time in milliseconds
	if (_.isDate(date)) {
		return date.getTime();
	}

	// A number that exists will be interpreted as millisecond
	if (_.isFinite(date)) {
		return date;
	}

	// Handle number string
	if (!isNaN(date)) {
		return +date;
	}

	// Handle String, Object, etc.
	const parsed = Date.parse(date);

	// A string that cannot be parsed returns NaN
	if (isNaN(parsed)) {
		return null;
	}

	return parsed;
};

/**
 * Get the limit provided by the user, if there is one.
 * Limit has to be at least 1 and no more than 100, with
 * a default value of 20.
 *
 * @param queryParams
 * @param maxSize (optional) default: 100
 * @returns {number}
 */
module.exports.getLimit = function (queryParams, maxSize) {
	const max = maxSize || 100;
	const limit = _.get(queryParams, 'size', 20);
	return isNaN(limit) ? 20 : Math.max(1, Math.min(max, Math.floor(limit)));
};

/**
 * Page needs to be positive and has no upper bound
 * @param queryParams
 * @returns {number}
 */
module.exports.getPage = function (queryParams) {
	const page = _.get(queryParams, 'page', 0);
	return isNaN(page) ? 0 : Math.max(0, page);
};

/**
 * Extract given field from request header
 */
module.exports.getHeaderField = function (header, fieldName) {
	return (null == header || null == header[fieldName]) ? null : header[fieldName];
};

/**
 * Parses user agent information from request header
 */
module.exports.getUserAgentFromHeader = function(header) {
	let userAgent = this.getHeaderField(header, 'user-agent');

	let data = {};
	if (null != userAgent) {
		let info = platform.parse(userAgent);
		data = {
			browser: `${info.name} ${info.version}`,
			os: info.os.toString()
		};
	}

	return data;
};

function propToMongoose(prop, nonMongoFunction) {
	if (typeof prop === 'object' && prop.$date != null && typeof prop.$date === 'string') {
		return new Date(prop.$date);
	} else if (typeof prop === 'object' && prop.$obj != null && typeof prop.$obj === 'string') {
		return mongoose.Types.ObjectId(prop.$obj);
	}

	if (null != nonMongoFunction) {
		return nonMongoFunction(prop);
	}

	return null;
}

function toMongoose(obj) {
	if (null != obj) {
		if (typeof obj === 'object') {
			if (Array.isArray(obj)) {
				let arr = [];

				for (let index in obj) {
					arr.push(propToMongoose(obj[index], toMongoose));
				}

				return arr;
			} else {
				let newObj = {};

				for (let prop in obj) {
					newObj[prop] = propToMongoose(obj[prop], toMongoose);
				}

				return newObj;
			}
		}
	}

	return obj;
}

exports.toMongoose = toMongoose;

/**
 * Determine if an array contains a given element by doing a deep comparison.
 * @param arr
 * @param element
 * @returns {boolean} True if the array contains the given element, false otherwise.
 */
module.exports.contains = function(arr, element) {
	for (let i = 0; i < arr.length; i++) {
		if (_.isEqual(element, arr[i])) {
			return true;
		}
	}
	return false;
};

module.exports.toProvenance = function(user) {
	let now = new Date();
	return {
		username: user.username,
		org: user.organization,
		created: now.getTime(),
		updated: now.getTime()
	};
};

module.exports.emailMatcher = /.+@.+\..+/;

module.exports.submitRequest = (httpOpts) => {
	let defer = q.defer();
	let responseBody = '';

	const httpClient = httpOpts.protocol === 'https:' ? https : http;

	httpClient.request(httpOpts, (response) => {
		response.on('data', (chunk) => responseBody += chunk);
		response.on('end', () => {
			if (response.statusCode !== 200) {
				defer.reject({ status: response.statusCode, message: response.statusMessage });
			}
			else {
				const response = (_.isEmpty(responseBody)) ? {} : JSON.parse(responseBody);
				defer.resolve(response);
			}
		});
	}).on('error', (err) => defer.reject(err)).end();

	return defer.promise;
};

module.exports.submitPostRequest = (httpOpts, postBody) => {
	let defer = q.defer();
	let responseBody = '';

	const httpClient = httpOpts.protocol === 'https:' ? https : http;

	let postRequest = httpClient.request(httpOpts, (response) => {
		response.on('data', (chunk) => responseBody += chunk);
		response.on('end', () => {
			if (response.statusCode !== 200) {
				defer.reject({ status: response.statusCode, message: response.statusMessage });
			}
			else {
				const response = (_.isEmpty(responseBody)) ? {} : JSON.parse(responseBody);
				defer.resolve(response);
			}
		});
	});

	postRequest.on('error', (err) => defer.reject(err));
	postRequest.write(JSON.stringify(postBody));
	postRequest.end();

	return defer.promise;
};
