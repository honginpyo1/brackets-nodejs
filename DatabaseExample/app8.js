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

// MySQL 데이터베이스를 사용할 수 있는 mysql 모듈 불러오기
var mysql = require('mysql');

// MySQL 데이터베이스 연결 설정
var pool = mysql.createPool({
	connectionLimit : 10,
	host : 'localhost',
	user : 'melong',
	password : '0000',
	database : 'test',
	debug : false,
	insecureAuth : true
});

var addUser = function(id, name, age, password, callback) {
	console.log('addUser 호출 됨.');
	
	pool.getConnection(function(err, conn) {
		if(err) {
			if(conn) {
				conn.release();
			}
			
			callback(err, null);
			return;
		}
		console.log('데이터베이스 연결 스레드 아이디 : ' + conn.threadId);
		
		// 데이터를 객체로 만듭니다.
		var data = {id:id, name:name, age:age, password:password};
		
		// SQL 문 실행
		var exec = conn.query('insert into users set ?', data, function(err, result) {
			conn.release(); // 반드시 헤재
			console.log('실행 대상 SQL : ' + exec.sql);
			
			if(err) {
				console.log('SQL 실행 시 오류 발생함.');
				console.dir(err);
				
				callback(err, null);
				
				return ;
			}
			
			callback(null, result);
		});
	}
)};
					   

var authUser = function(database, id, password, callback) {
    console.log('authUser 호출됨.');
    
	pool.getConnection(function(err, conn) {
		if(err) {
			if(conn) {
				conn.release();
			}
			callback(err, null);
			return;
 		}
		console.log('데이터베이스 연결 스레드 아이디 : ' + conn.threadId);
		
		var columns = ['id', 'name', 'age'];
		var tablename = 'users';
		
		// SQL 문 실행
		var exec = conn.query("select ?? from ?? where id = ? and password = ?", [columns, tablename, id, password], function(err, rows) {
			conn.release();
			
			console.log('실행 대상 SQL : ' + exec.sql);
			
			if(rows.length > 0) {
				console.log('아이디 [%s], 패스워드 [%s] 가 일치하는 사용자 찾음', id, password);
				callback(null, rows);
			} else {
				console.log("일치하는 사용자를 찾지 못함.");
				callback(null, null);
			}
		});
	});
}

var router = express.Router();
	
router.route('/process/adduser').post(function(req, res) {
    console.log('/process/adduser 호출됨');
    
    var paramId =  req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;
	var paramAge = req.body.age || req.query.age;
    
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword + ', ' + paramName + ', ' + paramAge);
    
	if(pool) {
		addUser(paramId, paramName, paramAge, paramPassword, function(err, addedUser) {
			
			// 동일한 id로 추가할 때 오류 발생 - 클라이언트로 오류 전송
			if(err) {
				console.error('사용자 추가 중 오류 발생 : ' + err.stack);
				
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 중 오류 발생</h2>');
				res.write('<p>' + err.stack + '</p>');
                res.end();
				
				return;
			}
			
			// 결과 객체 있으면 성공 응답 전송
			if(addedUser) {
				console.dir(addedUser);
				
				console.log('inserted ' + addedUser.affectedRows + 'rows');
				
				var insertId = addedUser.insertId;
				console.log('추가한 레코드의 아이디 : ' + insertId);
				
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 성공</h2>');
                res.end();
			} else {
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
                res.write('<h2>사용자 추가 실패</h2>');
                res.end();
			}
		});
	} else { // 데이터 베이스 객체가 초기화되지 않은 경우 실패 응답 전송
		res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
		res.write('<h2>데이터베이스 연결 실패</h2>');
		res.end();
	}

});

app.post('/process/login', function(req, res) {
    console.log('/process/login 호출됨.');
        
    var paramId = req.param('id');
    var paramPassword = req.param('password');
    
	console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword);
	
	if(pool) {
		authUser(paramId,paramPassword, function(err, rows) {
			if(err) {
				console.error('사용자 로그인 중 오류 발생 : ' + err.stack);
				
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h1>사용자 로그인 중 오류 발생</h1>');
				res.write('<p>' + err.stack + '</p>');
				res.end();
				
				return;
			}
			
			if(rows) {
				console.dir(rows);
				
				var username = rows[0].name;
				res.writeHead('200', {'Content-Type':'text/html;charset=utf8'});
				res.write('<h1>로그인 성공</h1>');
				res.write('<div><p>사용자 아이디 :' + paramId + '</p></div>');
				res.write('<div><p>사용자 이름 :' + username + '</p></div>');
				res.write("<br><br><a href='/public/login2.html'>다시 로그인하기</a>");
				res.end();	
			}
		})
	}
});

app.use('/', router);

var errorHandler = expressErrorHandler({
    static: {
        '404' : './public/404.html'
    }
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);

http.createServer(app).listen(app.get('port'), function() {
    console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));
    
});