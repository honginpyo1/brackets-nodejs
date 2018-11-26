// require() 메소드는 exports 객체를 반환함.
var user = require('./user2');

console.dir(user);

function showUser() {
	return user.getUser().name + ', ' + user.group.name;
}

console.log('사용자 정보 : %s', showUser());