'use strict';

const
	_ = require('lodash'),
	q = require('q'),

	deps = require('../../../dependencies'),
	util = deps.utilService;

/**
 * Extend user's controller
 */
module.exports = _.extend(
	require('./auth/user-authentication.controller'),
	require('./auth/user-authorization.controller'),
	require('./auth/user-password.controller'),
	require('./profile/user-profile.controller'),
	require('./eua/eua.controller'),
	require('./user-export.controller')
);

/*=====================================
 * Auth Middleware
 *====================================*/

/**
 * Apply the auth requirements as authorization middleware
 * @param requirement The requirement function to invoke
 */
module.exports.has = (requirement) => {

	// Return a function that adapts the requirements to middleware
	return (req, res, next) => {
		requirement(req).then((result) => {
			next();
		}, (errorResult) => {
			util.handleErrorResponse(res, errorResult);
		}).done();
	};
};

/**
 * Apply the array of auth functions in order, using AND logic
 */
module.exports.hasAll = function() {
	let requirements = arguments;
	return (req, res, next) => {
		module.exports.requiresAll(requirements)(req).then((result) => {
			next();
		}, (errorResult) => {
			util.handleErrorResponse(res, errorResult);
		}).done();
	};
};

module.exports.requiresAll = (requirements) => {
	return (req) => {

		// Apply the requirements
		let applyRequirement = (i) => {
			if (i < requirements.length) {
				return requirements[i](req).then((result) => {
					// Success means try the next one
					return applyRequirement(++i);
				});
			} else {
				// Once they all pass, we're good
				return q();
			}
		};

		return applyRequirement(0);
	};
};

/**
 * Apply the array of auth functions in order, using OR logic
 */
module.exports.hasAny = function() {
	let requirements = arguments;
	return (req, res, next) => {
		module.exports.requiresAny(requirements)(req).then((result) => {
			next();
		}, (errorResult) => {
			util.handleErrorResponse(res, errorResult);
		}).done();
	};
};

module.exports.requiresAny = (requirements) => {
	return (req) => {

		// Apply the requirements
		let error;
		let applyRequirement = (i) => {
			if (i < requirements.length) {
				return requirements[i](req).then((result) => {
					// Success means we're done
					return q();
				}, (errorResult) => {
					// Failure means keep going
					error = errorResult;
					return applyRequirement(++i);
				});
			} else {
				// If we run out of requirements, fail with the last error
				return q.reject(error);
			}
		};

		if (requirements.length > 0) {
			return applyRequirement(0);
		}
		else {
			// Nothing to check passes
			return q();
		}
	};
};


/**
 * Checks that the user has base access
 * 	1. The user is logged in
 * 	2. The user has accepted the EUA if applicable
 * 	3. The user has the 'user' role
 */
module.exports.hasAccess = (req, res, next) => {
	module.exports.hasAll(
			module.exports.requiresLogin,
			module.exports.requiresEua,
			module.exports.requiresOrganizationLevels,
			module.exports.requiresUserRole,
			module.exports.requiresExternalRoles
			)(req, res, next);
};

/**
 * Checks that the user has editor access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'editor' role
 */
module.exports.hasEditorAccess = (req, res, next) => {
	module.exports.hasAll(
			module.exports.requiresLogin,
			module.exports.requiresEua,
			module.exports.requiresOrganizationLevels,
			module.exports.requiresUserRole,
			module.exports.requiresExternalRoles,
			module.exports.requiresEditorRole
			)(req, res, next);
};

/**
 * Checks that the user has auditor access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'auditor' role
 */
module.exports.hasAuditorAccess = (req, res, next) => {
	module.exports.hasAll(
			module.exports.requiresLogin,
			module.exports.requiresEua,
			module.exports.requiresOrganizationLevels,
			module.exports.requiresUserRole,
			module.exports.requiresExternalRoles,
			module.exports.requiresAuditorRole
			)(req, res, next);
};

/**
 * Checks that the user has admin access
 * 	1. The user has met the base access requirements
 * 	2. The user has the 'admin' role
 */
module.exports.hasAdminAccess = (req, res, next) => {
	module.exports.hasAll(
			module.exports.requiresLogin,
			module.exports.requiresAdminRole
			)(req, res, next);
};

