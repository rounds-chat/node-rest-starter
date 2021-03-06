'use strict';

const
	deps = require('../../../dependencies'),

	config = deps.config,
	emailService = deps.emailService,
	logger = deps.logger;

function buildEmailContent(resource) {
	let emailData = {
		appName: config.app.instanceName,
		welcomeUrl: config.app.clientUrl,
		helpUrl: `${config.app.clientUrl}/help`,
		name: resource.name,
		contactEmail: config.contactEmail
	};

	return emailService.buildEmailContent('util/templates/new-user-email', emailData);
}

module.exports.emailNewUser = (user) => {
	return buildEmailContent(user).then((emailContent) => {
		let mailOptions = {
			from: config.mailer.from,
			replyTo: config.mailer.from,
			to: user.email,
			subject: emailService.getSubject(`Your ${config.app.instanceName} account has been approved!`),
			html: emailContent
		};
		return emailService.sendMail(mailOptions)
			.then(() => {
				logger.debug('Sent email');
			});
	});
};

