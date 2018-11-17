var Users = [{name:'소녀시대', age:20}, {name:'걸스데이', age:22}];

var add = function(a,b) {
    return a+b;
}

Users.push(add);

console.log('사용자 수 : %d', Users.length);
console.log('세 번째 요소 : %d', Users[2](10,10));