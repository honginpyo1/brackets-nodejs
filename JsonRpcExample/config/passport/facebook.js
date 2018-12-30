var FacebookStrategy = require('passport-facebook').Strategy;
var config = require('../config');

module.exports = function(app, passport) {
	return new FacebookStrategy({
		clientID : config.facebook.clientID,
		clientSecret : config.facebook.clientSecret,
		callbackURL : config.facebook.callbackURL,
		profileFields: ['id', 'emails', 'name'] 
	}, function(accessToken, refreshToken, profile, done) {
		console.log('passport의 facebook 호출됨.');
		console.dir(profile);
		
		var options = {
			criteria : {'facebook.id' : profile.id}
		};

		var database = app.get('database');
		database.UserModel.findOne(options, function(err, user) {
			if(err) {return done(err);}

			// 등록된 사용자가 없는 경우
			if(!user) {
				var user = new database.UserModel({
					name : profile.name.givenName + " " + profile.name.familyName,
					email : profile.emails[0].value,
					provider : 'facebook',
					facebook : profile._json
				});
				
				user.save(function(err) {
					if(err) console.log(err);
					return done(err,user);
				});
			} else {
				return done(err, user)
			}
		});
	});
};