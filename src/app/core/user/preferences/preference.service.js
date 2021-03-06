'use strict';

const
	q = require('q'),

	deps = require('../../../../dependencies'),
	util = deps.utilService,
	dbs = deps.dbs,

	Preference = dbs.admin.model('Preference');


function doSearch(query, sortParams, page, limit) {
	let countPromise = Preference.find(query).count();
	let searchPromise = Preference.find(query);

	if (sortParams) {
		searchPromise = searchPromise.sort(sortParams);
	}

	if (limit) {
		searchPromise = searchPromise.skip(page * limit).limit(limit);
	}

	return q.all([ countPromise, searchPromise ])
		.then((results) => {
			return q({
				totalSize: results[0],
				pageNumber: page,
				pageSize: limit,
				totalPages: Math.ceil(results[0] / limit),
				elements: results[1]
			});
		});
}

module.exports.searchAll = function(query) {
	return Preference.find(query).exec();
};

module.exports.search = function(query, queryParams) {
	let page = util.getPage(queryParams);
	let limit = util.getLimit(queryParams, 1000);

	let sort = queryParams.sort;
	let dir = queryParams.dir;

	// Sort can be null, but if it's non-null, dir defaults to DESC
	if (sort && !dir) { dir = 'ASC'; }

	let sortParams;
	if (sort) {
		sortParams = {};
		sortParams[sort] = dir === 'ASC' ? 1 : -1;
	}

	return doSearch(query, sortParams, page, limit);
};
