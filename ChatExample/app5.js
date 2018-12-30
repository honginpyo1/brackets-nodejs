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

// 로그인 아이디 매핑(로그인 ID -> 소켓 ID)
var login_ids = {};

// 응답 메시지 전송 메소드
function sendResponse(socket, command, code, message) {
	var statusObj = {command : command, code : code, message : message};
	socket.emit('response', statusObj);
}

function getRoomList() {
	console.dir(io.sockets.adapter.rooms);
	
	var roomList = [];
	
	Object.keys(io.sockets.adapter.rooms).forEach(function(roomId) {
		console.log('current room id : ' + roomId);
		var outRoom = io.sockets.adapter.rooms[roomId];
		
		// find default room using all attributes
		var foundDefault = false;
		var index = 0;
		Object.keys(outRoom.sockets).forEach(function(key) {
			console.log('#' + index + ' : ' + key + ', ' + outRoom.sockets[key]);
			
			if(roomId == key) { // default room
				foundDefault = true;
				console.log('this is default room.');
			}
			index++;
		});
		
		if(!foundDefault) {
			roomList.push(outRoom);
		}
	});
	
	console.log('[ROOM LIST]');
	console.dir(roomList);
	
	return roomList;
}

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
		} else {
			// command 속성으로 일대일 채팅과 그룹 채팅 구별
            if(message.command == 'chat') {
                // 일대일 채팅 대상에게 메시지 전달
                if(login_ids[message.recepient]) {
                    io.sockets.connected[login_ids[message.recepient]].emit('message', message);

                    // 응답 메시지 전송
                    sendResponse(socket, 'message', '200', '메시지를 전송했습니다.');
                } else {
                    // 응답 메시지 전송
                    sendResponse(socket, 'login', '404', '상대방의 로그인 ID를 찾을 수 없습니다.');
                }
            } else if(message.command == 'groupchat') {
                // 방에 들어 있는 모든 사용자에게 메시지 전달
                io.sockets.in(message.recepient).emit('message', message);
                
                // 응답 메시지 전송
                sendResponse(socket, 'message', '200', '방 [' + message.recepient + ']의 모든 사용자들에게 메시지를 전송했습니다.');
            }
		}
	});
	
	socket.on('login', function(login) {
		console.log('login 이벤트를 받았습니다');
		console.dir(login);

		// 기존 클라이언트 ID가 없으면 클라이언트 ID를 앱에 추가
		console.log('접속한 소켓의 ID : ' + socket.id);
		login_ids[login.id] = socket.id;
		socket.login_id = login.id;
		
		console.log('접속한 클라이언트 ID 개수 : %d', Object.keys(login_ids).length);
		
		// 응답 메시지 전송
		sendResponse(socket, 'login', '200', '로그인되었습니다.');
	});
	
	socket.on('logout', function(logout) {
		console.log('logout 이벤트를 받았습니다');
		console.dir(logout);

		// login 된 id 삭제
		delete login_ids[logout.id];
		
		console.log('Logout 사용자 : ' + logout.id);
		console.log('접속한 클라이언트 ID 개수 : %d', Object.keys(login_ids).length);
		
		// 응답 메시지 전송
		sendResponse(socket, 'logout', '200', '로그아웃 되었습니다.');
	});
	
	socket.on('response', function(response) {
		console.log(JSON.stringify(response));
		println('응답 메시지를 받았습니다. : ' + response.command + ', ' + response.code + ', ' + response.message);
	});
	
	socket.on('room', function(room) {
		console.log('room 이벤트를 받았습니다');
		console.dir(room);

		if(room.command == 'create') {
			if(io.sockets.adapter.rooms[room.roomId]) { // 방이 이미 만들어져 있는 경우
				console.log('방이 이미 만들어져 있습니다.');
				
			} else {
				console.log('방을 새로 만듭니다.');
				
				socket.join(room.roomId);
				
				var curRoom = io.sockets.adapter.rooms[room.roomId];
				curRoom.id = room.roomId;
				curRoom.name = room.roomName;
				curRoom.owner = room.roomOwner;
			} 
		} else if(room.command == 'update') {
				var curRoom = io.sockets.adapter.rooms[room.roomId];
				curRoom.id = room.roomId;
				curRoom.name = room.roomName;
				curRoom.owner = room.roomOwner;
		} else if(room.command == 'delete') {
			socket.leave(room.roomId);
			
			if(io.sockets.adapter.rooms[room.roomId]) { // 방이 만들어져 있는 경우
				delete io.sockets.adapter.rooms[room.roomId];
			} else { // 방이 만들어져 있지 않은 경우
				console.log('방이 만들어져 있지 않습니다.');
			}
		} else if(room.command == 'join') {
            socket.join(room.roomId);
            
            // 응답 메시지 전송
            sendResponse(socket, 'room', '200', '방에 입장했습니다.');
        } else if(room.command == 'leave') {
            socket.leave(room.roomId);
            
            // 응답 메시지 전송
            sendResponse(socket, 'room', '200', '방에서 나갔습니다.');
        }
		
		var roomList = getRoomList();
		
		var output = {command : 'list', rooms : roomList};
		console.log('클라이언트로 보낼 데이터 : ' + JSON.stringify(output));
		
		io.sockets.emit('room', output);
	});
});