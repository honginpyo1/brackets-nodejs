// Express 기본 모듈 불러오기
var express = require('express'), http = require('http'), path = require('path');

// Express의 미들웨어 불러오기
var bodyParser = require('body-parser'), cookieParser = require('cookie-parser'), static = require('serve-static'), errorHandler = require('errorhandler');

// 오류 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

// Session 미들웨어 불러오기
var expressSession = require('express-session');

var app = express();

app.set('port', process.env.PORT || 3000);

// body-parser를 사용해 application/x-www-form-urlencoded 파싱
app.use(bodyParser.urlencoded({ extended: false}));

// body-parser를 사용해 application/json 파싱
app.use(bodyParser.json());

// public 폴더를 static으로 오픈
app.use('/public', static(path.join(__dirname, 'public')));

// cookie-parser 설정
app.use(cookieParser());

// 세션 설정
app.use(expressSession( {
    secret:'my key',
    resave:true,
    saveUninitialized:true
}));


var mongodb = require('mongodb');
var mongoose = require('mongoose');

var database;
var UserSchema;
var UserModel;

function connectDB() {
	var databaseUrl = 'mongodb://localhost:27017/local';
	
    mongoose.connect(databaseUrl);
    database = mongoose.connection;
    
    database.on('err', console.error.bind(console, 'mongoose connection error.'));
    database.on('open', function() {
        console.log('데이터베이스에 연결되었습니다. : ' + databaseUrl);
        
        // user 스키마 및 모델 객체 생성
        createUserSchema();
        
        doTest();
        
    });
    database.on('disconnected', connectDB);
}

function createUserSchema() {
    
    // 스키마 정의
    // password를 hashed_password로 변경, default 속성 모두 추가, salt 속성 추가
    UserSchema = mongoose.Schema({
        id : { type : String, required : true, unique : true},
        name : {type : String, index : 'hashed', 'default' :''},
        age : {type : Number, 'default' : -1},
        create_at : {type : Date, index : {unique : false}, 'default' : Date.now},
        updated_at : {type : Date, index : {unique : false}, 'default' : Date.now}
    });
    
    // info를 virtual 메소드로 정의
    UserSchema
    .virtual('info')
    .set(function(info) {
        var splitted = info.split(' ');
        this.id = splitted[0];
        this.name = splitted[1];
        console.log('virtual info 설정함 : %s, %s', this.id, this.name);
    })
    .get(function() {return this.id + ' ' + this.name});
    
    console.log('UserSchema 정의함.');
    
    // UserModel 모델 정의
    UserModel = mongoose.model("users4", UserSchema);
    console.log('UserModel 정의함.');
}

function doTest() {
    var user = new UserModel({"info" : 'test01 소녀시대'});
    
    user.save(function(err) {
        if(err) {throw err;}
        
        console.log("사용자 데이터 추가함.");
        
        findAll();
    });
    
    console.log('info 속성에 값 할당함. ');
    console.log('id : %s, name : %s',user.id, user.name);
}

function findAll() {
    UserModel.find({}, function(err, results) {
        if(err) {throw err;}
        
        if(results) {
            console.log('조회된 user 문서 객체 #0 -> id : %s, name : %s', results[0]._doc.id, results[0]._doc.name);
        }
    });
}

var addUser = function(database, id, password, name, callback) {
    console.log('addUser 호출됨 : ' + id + ', ' + password);
    
    var user = new UserModel({"id" : id, "password" : password, "name" : name});
    
    user.save(function(err) {
        if(err) {
            callback(err, null);
            return;
        }
        
        console.log("사용자 데이터 추가함.");
        callback(null, user);
    });
}

var router = express.Router();

app.post('/process/login', function(req, res) {
    console.log('/process/login 호출됨.');
        
    var paramId = req.param('id');
    var paramPassword = req.param('password');
    
    if(database) {
        authUser(database, paramId, paramPassword, function(err, docs) {
            if(err) {throw err;}
    if(docs) {
        console.dir(docs);
        var username = docs[0].name;
        
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h1>로그인 성공</h1>');
        res.write('<div><p>사용자 아이디 :' + paramId + '</p></div>');
        res.write('<div><p>사용자 이름 :' + username + '</p></div>');
        res.write("<br><br><a href='/public/login.html'>다시 로그인하기</a>");
        res.end();
    } else {
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h1>로그인 실패</h1>');
        res.write('<div><p>아이디와 비밀번호를 다시 확인하십시오.</p></div>');
        res.write("<br><br><a href='/public/login.html'>다시 로그인하기</a>");
        res.end();
    }
    });
    } else {
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>데이터베이스 연결 실패</h2>');
        res.write('<div><p>데이터베이스에 연결하지 못했습니다.</p></div>');
        res.end();
    }
});

app.use('/', router);

router.route('/process/adduser').post(function(req, res) {
    console.log('/process/adduser 호출됨');
    
    var paramId =  req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;
    
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword + ', ' + paramName);
    
    if(database) {
        addUser(database, paramId, paramPassword, paramName, function(err, result) {
            if(err) {throw err;}
            
            if(result) {
                console.dir(result);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 성공</h2>');
                res.end();
            } else {
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 실패</h2>');
                res.end();
            }
        });
    } else {
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>데이터베이스 연결 실패</h2>');
        res.end();
    }
});

router.route('/process/listuser').post(function(req, res) {
    console.log('/process/listuser 호출됨.');
    
    // 데이터베이스 객체가 초기화된 경우, 모델 객체의 findAll 메소드 호출
    if(database) {
        // 1. 모든 사용자 검색
        UserModel.findAll(function(err, results) {
            // 오류가 발생했을 때 클라이언트로 오류 전송
            if(err) {
                console.error('사용자 리스트 조회 중 오류 발생 : ' + err.stack);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 리스트 조회 중 오류 발생</h2>');
                res.write('<p>' + err.stack + '</p>');
                res.end();
                
                return;
            }
            
            if(results) {
                console.dir(results);
                
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 리스트</h2>');
                res.write('<div><ul>');
                
                for(var i=0; i< results.length; i++) {
                    var curId = results[i]._doc.id;
                    var curName = results[i]._doc.name;
                    res.write(' <li>#' + i + ' : ' + curId + ', ' + curName + '</li>')
                }
                
                res.write('</ul></div>');
                res.end();
            } else {
                res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 리스트 조회 실패</h2>');
                res.end();
            }
        });
    } else {
        res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
        res.write('<h2>데이터베이스 연결 실패</h2>');
        res.end();
    }
        
});

var errorHandler = expressErrorHandler({
    static: {
        '404' : './public/404.html'
    }
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);

http.createServer(app).listen(app.get('port'), function() {
    console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));
    
    connectDB();
});
