// src/server.js
import { app } from "./app.js";
import { getMailer } from "./lib/mailer.js";
import 'dotenv/config';


const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});


const mailer = getMailer();
if (mailer) {
  mailer.verify().then(ok => console.log(ok ? "SMTP ready (Mailtrap)" : "SMTP configured but not verified"));
} else {
  console.log("SMTP disabled (no SMTP_* env vars)");
}