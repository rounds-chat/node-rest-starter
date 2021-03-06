'use strict';

const
	_ = require('lodash'),
	mongoose = require('mongoose'),
	q = require('q'),
	should = require('should'),

	User = mongoose.model('User'),

	userProfileController = require('./user-profile.controller');

/**
 * Helpers
 */

function clearDatabase() {
	return q.all([
		User.remove()
	]);
}

function userSpec(key) {
	return {
		name: key + ' Name',
		email: key + '@mail.com',
		username: key + '_username',
		password: 'password',
		provider: 'local',
		organization: key + ' Organization'
	};
}

/**
 * Unit tests
 */
describe('User Profile Controller:', () => {
	// specs for tests
	let spec = { user: {} };

	// Basic Users
	spec.user.user1 = userSpec('basic1');
	spec.user.user2 = userSpec('basic2');
	spec.user.user3 = userSpec('basic3');

	let user = {};

	before(() => {
		return clearDatabase().then(() => {
			let defers = [];

			defers = defers.concat(_.keys(spec.user).map((k) => {
				return (new User(spec.user[k])).save().then((e) => { user[k] = e; });
			}));

			return q.all(defers);
		});
	});

	after(() => {
		return clearDatabase();
	});


	describe('adminGetAll', () => {

		it('should return all usernames', (done) => {
			let req = {
				body: { field: 'username', query: {}},
				query: {}
			};
			let res = {
				status : (status) => {
					should(status).equal(200);
					return {
						json: (results) => {
							should(results).be.an.Array();
							should(results).have.length(3);
							should(results).containDeep([ spec.user.user1.username, spec.user.user2.username, spec.user.user3.username ]);

							done();
						}
					};
				}
			};

			userProfileController.adminGetAll(req, res);
		});

		it('getting one username should return the 1 expected', (done) => {
			let req = {
				body: { field: 'username', query: { username: spec.user.user1.username }},
				query: {}
			};
			let res = {
				status : (status) => {
					should(status).equal(200);
					return {
						json: (results) => {
							should(results).be.an.Array();
							should(results).have.length(1);
							should(results).containDeep([ spec.user.user1.username ]);

							done();
						}
					};
				}
			};

			userProfileController.adminGetAll(req, res);
		});

		it('getting one _id should return the 1 expected', (done) => {
			let req = {
				body: { field: 'username', query: { _id: { $obj: user.user1._id.toString() } }},
				query: {}
			};
			let res = {
				status : (status) => {
					should(status).equal(200);
					return {
						json: (results) => {
							should(results).be.an.Array();
							should(results).have.length(1);
							should(results).containDeep([ spec.user.user1.username ]);

							done();
						}
					};
				}
			};

			userProfileController.adminGetAll(req, res);
		});

	});

	describe('canEditProfile', () => {

		it('local auth and undef bypass should be able to edit', () => {
			let user = { };
			let result = userProfileController.canEditProfile('local', user);
			result.should.equal(true);
		});

		it('local auth and no bypass should be able to edit', () => {
			let user = { bypassAccessCheck: false };
			let result = userProfileController.canEditProfile('local', user);
			result.should.equal(true);
		});

		it('local auth and bypass should be able to edit', () => {
			let user = { bypassAccessCheck: true };
			let result = userProfileController.canEditProfile('local', user);
			result.should.equal(true);
		});

		it('proxy-pki auth and undef bypass should not be able to edit', () => {
			let user = { };
			let result = userProfileController.canEditProfile('proxy-pki', user);
			result.should.equal(false);
		});

		it('proxy-pki auth and no bypass should not be able to edit', () => {
			let user = { bypassAccessCheck: false };
			let result = userProfileController.canEditProfile('proxy-pki', user);
			result.should.equal(false);
		});

		it('proxy-pki auth and bypass should be able to edit', () => {
			let user = { bypassAccessCheck: true };
			let result = userProfileController.canEditProfile('proxy-pki', user);
			result.should.equal(true);
		});

	});

});
