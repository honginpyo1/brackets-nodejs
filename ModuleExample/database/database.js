var mongoose = require('mongoose');
var user = require('../routes/user');

var database = {};

database.init = function(app, config) {
	console.log('init() 호출됨.');
	
	connect(app,config);
}

function connect(app, config) {
	console.log('connect() 호출됨.');
	
	var databaseUrl = 'mongodb://localhost:27017/local';
    
    // 데이터베이스 연결
    console.log('데이터베이스 연결을 시도합니다.');
    mongoose.Promise = global.Promise;
    mongoose.connect(databaseUrl);
    database = mongoose.connection;
    
    database.on('error', console.error.bind(console, 'mongoose connection error.'));
    database.on('open', function() {
        console.log('데이터베이스에 연결되었습니다. : ' + databaseUrl);
		
		createSchema(app, config);
       
    });
    
    database.on('disconnected', function() {
        console.log('연결이 끊어졌습니다. 5초 후 다시 연결합니다.');
        setInterval(connectDB, 5000);
    })
}

function createSchema(app, config) {
	var schemalLen = config.db_schemas.length;
	console.log('설정에 정의된 스키마의 수 : %d', schemalLen);
	
	for(var i = 0;i < schemalLen; i++) {
		var curItem = config.db_schemas[i];
		
		// 모듈 파일에서 모듈 불러온 후 createSchema() 함수 호출하기
		var curSchema = require(curItem.file).createSchema(mongoose);
		console.log('%s 모듈을 불러들인 후 스키마 정의함.', curItem.file);
		
		// user 모델 정리
		var curModel = mongoose.model(curItem.collection, curSchema);
		console.log('%s 컬렉션을 위해 모델 정의함.', curItem.collection);
		
		database[curItem.schemaName] = curSchema;
		database[curItem.modelName] = curModel;
		console.log('스키마 이름 [%s], 모델 이름 [%s]이 database 객체의 속성으로 추가됨.', curItem.schemaName, curItem.modelName);
	}
	
	app.set('database', database);
	user.init(database, database.UserSchema, database.UserModel);
	console.log('database 객체가 app 객체의 속성으로 추가됨.');
}

module.exports = database;