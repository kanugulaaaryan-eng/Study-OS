const mysql = require('mysql2/promise');
const url = 'mysql://UoK26ZbUVAmdEUp.root:rpV5ngZqw1EtfLIB@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/studyos?ssl={"rejectUnauthorized":false}';

async function check() {
  try {
    const conn = await mysql.createConnection(url);
    const [sessions] = await conn.query('SELECT * FROM chatSessions WHERE userId = 60001');
    console.log('Sessions:', sessions);
    await conn.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check();