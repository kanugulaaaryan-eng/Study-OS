const mysql = require('mysql2/promise');
const url = 'mysql://UoK26ZbUVAmdEUp.root:rpV5ngZqw1EtfLIB@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/studyos?ssl={"rejectUnauthorized":false}';

async function check() {
  try {
    const conn = await mysql.createConnection(url);
    const [tables] = await conn.query('SHOW TABLES');
    console.log('Tables:', tables);
    
    // Check if studySessions exists
    const hasStudySessions = tables.some(t => Object.values(t).includes('studySessions'));
    console.log('studySessions exists:', hasStudySessions);
    
    if (hasStudySessions) {
      const [columns] = await conn.query('DESCRIBE studySessions');
      console.log('studySessions columns:', columns);
    }
    
    await conn.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check();