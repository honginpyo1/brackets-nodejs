module.exports = {
	
	server_port : 3000,
	db_url : 'mongodb://localhost:27017/shopping',
	
	db_schemas : [
		{file:'./user_schema', collection:'user6', schemaName:'UserSchema', modelName:'UserModel'}
	],
	
	route_info : [
	],
	facebook : {
		clientID : '265861377438921',
		clientSecret : '18268b85e63965c6f0d1519a296b8c7d',
		callbackURL : '/auth/facebook/callback'
	}
}