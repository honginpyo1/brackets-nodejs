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
var config = require('./config');
var route_loader = require('./routes/route_loader');
var database = require('./database/database')

// Passport 사용
var passport = require('passport');
var flash = require('connect-flash');
var LocalStrategy = require('passport-local').Strategy;

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

passport.use('local-login', new LocalStrategy({
	usernameField : 'email',
	passwordField : 'password',
	passReqToCallback : true
}, function(req, email, password, done) {
	console.log('passport의 local-login 호출됨 : ' + email + ', ' + password);
	
	var database = app.get('database');
	database.UserModel.findOne({'email' : email}, function(err, user) {
		if(err) {return done(err);}
		
		// 등록된 사용자가 없는 경우
		if(!user) {
			console.log('계정이 일치하지 않음.');
			return done(null, false, req.flash('loginMessage', '등록된 계정이 없습니다.'));
		}
		
		// 비밀번호를 비교하여 맞지 않는 경우
		var authenticated = user.authenticate(password, user._doc.salt, user._doc.hashed_password);
		if(!authenticated) {
			console.log('비밀번호 일치하지 않음');
			return done(null, false, req.flash('loginMessage', '비밀번호가 일치하지 않습니다.'));
		}
		
		// 정상인 경우
		console.log('계정과 비밀번호가 일치함.');
		return done(null, user);
	});
}));

passport.use('local-signup', new LocalStrategy({
	usernameField : 'email',
	passwordField : 'password',
	passReqToCallback : true
}, function(req, email, password, done) {
	var paramName = req.body.name || req.query.name;
	console.log('passport의 local-signup 호출됨 : ' + email + ', ' + password + ', ' + paramName);
	
	process.nextTick(function() {
		var database = app.get('database');
		database.UserModel.findOne({'email' : email}, function(err, user) {
			if(err) {return done(err);}

			// 기존에 이메일이 있다면
			if(user) {
				console.log('기존에 계정이 있음.');
				return done(null, false, req.flash('signupMessage', '계정이 이미 있습니다..'));
			} else {
				var user = new database.UserModel({'email' : email, 'password' : password, 'name' : paramName});
				user.save(function(err) {
					if(err) {throw err;}
					console.log("사용자 데이터 추가함.");
					return done(null, user);
				});
			}
		});
	});
}));

// 사용자 인증에 성공했을 때 호출
passport.serializeUser(function(user, done) {
	console.log('serializeUser() 호출됨.');
	console.dir(user);
	
	done(null, user);
});

// 사용자 인증 이후 사용자 요청이 있을 때마다 호출
passport.deserializeUser(function(user, done) {
	console.log('deserializeUser() 호출됨.');
	console.dir(user);
	
	done(null, user);
});

var router = express.Router();
route_loader.init(app,router);

// 홈화면
router.route('/').get(function(req, res) {
	console.log('/ 패스 요청됨.');
	res.render('index.ejs');
});

// 홈화면
app.get('/', function(req, res) {
	console.log('/ 패스 요청됨.');
	res.render('index.ejs');
});

// 로그인 폼 링크
app.get('/login', function(req, res) {
	console.log('/login 패스 요청됨.');
	res.render('login.ejs', {message : req.flash('loginMessage')});
});

app.post('/login', passport.authenticate('local-login', {
	successRedirect : '/profile',
	failureRedirect : '/login',
	failureFlash : true
}));

// 회원가입 폼 링크
app.get('/signup', function(req, res) {
	console.log('/signup 패스 요청됨.');
	res.render('signup.ejs', {message : req.flash('signupMessage')});
});

app.post('/signup', passport.authenticate('local-signup', {
	successRedirect : '/profile',
	failureRedirect : '/signup',
	failureFlash : true
}));

var errorHandler = expressErrorHandler({
    static: {
        '404' : './public/404.html'
    }
});

// 프로필 화면 - 로그인 여부를 확인할 수 있도록 먼저 isLoggedIn 미들웨어 실행
app.get('/profile', function(req, res) {
	console.log('/profile 패스 요청됨.');
	
	// 인증된 경우 req.user 객체에 사용자 정보 있으며, 인증이 안 된 경우 req.user는 false 값임
	console.log('req.user 객체의 값');
	console.dir(req.user);
	
	// 인증이 안 된 경우
	if(!req.user) {
		console.log('사용자 인증이 안 된 상태임.');
		res.redirect('/');
		return;
	}
	
	console.log('사용자 인증된 상태임.');
	if(Array.isArray(req.user)) {
		res.render('profile.ejs', {user: req.user[0]._doc});
	} else {
		res.render('profile.ejs', {user: req.user});
	}
});

// 로그아웃
app.get('/logout', function(req, res) {
	console.log('/logout 패스 요청됨.');
	req.logout();
	res.redirect('/');
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);

http.createServer(app).listen(app.get('port'), function() {
    console.log('서버가 시작되었습니다. 포트 : ' + app.get('port'));
	
	database.init(app, config);
});