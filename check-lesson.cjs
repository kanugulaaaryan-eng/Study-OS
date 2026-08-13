const mysql = require('mysql2/promise');
const url = 'mysql://UoK26ZbUVAmdEUp.root:rpV5ngZqw1EtfLIB@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/studyos?ssl={"rejectUnauthorized":false}';

async function check() {
  try {
    const conn = await mysql.createConnection(url);
    const [lessons] = await conn.query('SELECT id, userId, subjectId, title, excerpt, beginnerExplanation, collegeExplanation, keyTerms, analogies, takeaways, examples, misconceptions FROM lessons WHERE id = 60001');
    console.log('Lesson:', JSON.stringify(lessons, null, 2));
    await conn.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check();