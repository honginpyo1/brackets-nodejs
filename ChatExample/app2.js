// Express 기본 모듈 불러오기
var express = require('express'), http = require('http'), path = require('path');

// Express의 미들웨어 불러오기
var bodyParser = require('body-parser'), cookieParser = require('cookie-parser'), static = require('serve-static'), errorHandler = require('errorhandler');

// 오류 핸들러 모듈 사용
var expressErrorHandler = require('express-error-handler');

// Session 미들웨어 불러오기
var expressSession = require('express-session');

// 다른 파일 불러오기
var user = require('./routes/user');
var config = require('./config/config');
var route_loader = require('./routes/route_loader');
var database = require('./database/database')

// Passport 사용
var passport = require('passport');
var flash = require('connect-flash');
var LocalStrategy = require('passport-local').Strategy;

// socket.it 모듈 불러오기
var socketio = require('socket.io');

// cors  사용 - 클라이언트에서 ajax로 요청하면 CORS 지원
var cors = require('cors');

var app = express();

console.log('config.server_port : %d', config.server_port);
app.set('port', process.env.PORT || config.server_port);

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

// Passport 사용 설정
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// 뷰 엔진 설정
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
console.log('뷰 엔진이 ejs로 설정되었습니다.');

app.set('database',database);

// cors를 미들웨어로 사용하도록 등록
app.use(cors());

var configPassport = require('./config/passport');
configPassport(app, passport);

var userPassport = require('./routes/user_passport');
userPassport(app, passport);

var router = express.Router();
route_loader.init(app,router);

var errorHandler = expressErrorHandler({
    static: {
        '404' : './public/404.html'
    }
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);

var server = http.createServer(app).listen(app.get('port'), function() {
    console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));
	
	database.init(app, config);
});

// socket io 서버를 시작합니다.
var io = socketio.listen(server);
console.log('socket.io 요청을 받아들일 준비가 되었습니다.');

io.sockets.on('connection', function(socket) {
	console.log('connection info : ', socket.request.connection._peername);
	
	// 소켓 객체에 클라이언트 Host Port 정보 속성으로 추가
	socket.remoteAddress = socket.request.connection._peername.address;
	socket.remotePort = socket.request.connection._peername.port;
	
	socket.on('message', function(message) {
		console.log('message 이벤트를 받았습니다');
		console.dir(message);

		if(message.recepient == 'ALL') {
			// 나를 포함한 모든 클라이언트에게 메시지 전달
			console.dir('나를 포함한 모든 클라이언트에게 message 이벤트를 전송합니다.');
			io.sockets.emit('message', message);
		}
	});
});