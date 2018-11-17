var fs = require('fs');
var http = require('http');
var inname = './output';
var outstream = fs.createWriteStream(inname);
var instream = fs.createReadStream(inname);
var str = '인표 29 1234\n지은 28 1234\n';
var temp = ' ';

outstream.on('finish',function(){
    console.log('데이터 쓴당!');
});
outstream.write(str);
outstream.end();

instream.on('data', function(data) {
    instream.pipe(split(' '));
})


var server = http.createServer(function(req, res) {
    
});
server.listen(7070,'127.0.0.1');

