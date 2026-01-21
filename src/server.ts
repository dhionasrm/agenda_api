import { app } from "./app";
import "dotenv/config";

const PORT = Number(process.env.PORT) || 3333;

app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  console.log(`🚀 HTTP Server Running on http://localhost:${PORT}`);
  console.log(`📜 Swagger UI: http://localhost:${PORT}/docs`);
});