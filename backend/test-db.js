const { Client } = require("pg");

const client = new Client({
  connectionString: "postgresql://postgres.vchegkgrezlkfocryxoj:TSRDinesh%401993@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
  ssl: {
    rejectUnauthorized: false,
  },
});

(async () => {
  try {
    await client.connect();
    console.log("✅ DB Connected Successfully");
    await client.end();
  } catch (err) {
    console.error("❌ DB Connection Failed");
    console.error(err);
  }
})();