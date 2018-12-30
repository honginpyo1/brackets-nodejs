console.log('handler_info 파일 로딩됨.');

var handler_info = [
    {file : './echo', method : 'echo'},
    {file : './echo_error', method : 'echo_error'},
    {file : './echo_encrypted', method : 'echo_encrypted'},
    {file : './add', method : 'add'},
    {file : './listuser', method : 'listuser'},
];

module.exports = handler_info;