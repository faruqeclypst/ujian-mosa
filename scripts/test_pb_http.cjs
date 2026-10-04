const http = require('http');

http.get('http://127.0.0.1:8090/api/health', (res) => {
  console.log("Pocketbase running:", res.statusCode);
});
